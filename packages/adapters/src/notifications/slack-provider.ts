import {createHash, createHmac, timingSafeEqual} from "node:crypto"

import {
    ErrorCode,
    WebClient,
    type WebAPIHTTPError,
    type WebAPIPlatformError,
    type WebAPIRateLimitedError,
    type WebAPIRequestError,
} from "@slack/web-api"
import {
    NOTIFICATION_CHANNEL,
    SLACK_EVENT_ENVELOPE_TYPE,
    isNotificationEvent,
    isNotificationUrgency,
    type INotificationPayload,
    type ISlackEventBodyDTO,
    type ISlackEventEnvelopeDTO,
    type ISlackProvider,
    type IWebhookEventDTO,
    type NotificationEvent,
    type NotificationUrgency,
} from "@codenautic/core"

import {
    SLACK_PROVIDER_ERROR_CODE,
    SlackProviderError,
    type SlackProviderErrorCode,
} from "./slack-provider.error"

const DEFAULT_RETRY_MAX_ATTEMPTS = 3
const DEFAULT_RETRY_BASE_DELAY_MS = 250
const DEFAULT_SIGNATURE_TOLERANCE_MS = 5 * 60 * 1000

/**
 * Minimal Slack message request used by the adapter.
 */
export interface ISlackPostMessageRequest {
    /**
     * Slack destination identifier.
     */
    readonly channel: string

    /**
     * Plain or mrkdwn-compatible message text.
     */
    readonly text: string

    /**
     * Optional parent thread timestamp.
     */
    readonly thread_ts?: string

    /**
     * Optional broadcast flag for threaded replies.
     */
    readonly reply_broadcast?: boolean

    /**
     * Optional Slack markdown toggle.
     */
    readonly mrkdwn?: boolean

    /**
     * Optional link unfurl toggle.
     */
    readonly unfurl_links?: boolean

    /**
     * Optional media unfurl toggle.
     */
    readonly unfurl_media?: boolean
}

/**
 * Minimal Slack message response used by the adapter.
 */
export interface ISlackPostMessageResponse {
    /**
     * Slack success flag.
     */
    readonly ok?: boolean

    /**
     * Slack error code when request failed.
     */
    readonly error?: string

    /**
     * Destination channel for posted message.
     */
    readonly channel?: string

    /**
     * Posted message timestamp.
     */
    readonly ts?: string
}

/**
 * Minimal Slack Web API client contract used by the adapter.
 */
export interface ISlackWebApiClient {
    /**
     * Chat methods used by Slack provider.
     */
    readonly chat: {
        /**
         * Sends one message to Slack.
         *
         * @param request Slack chat request.
         * @returns Slack API response.
         */
        postMessage(request: ISlackPostMessageRequest): Promise<ISlackPostMessageResponse>
    }
}

/**
 * Slack provider constructor options.
 */
export interface ISlackProviderOptions {
    /**
     * Slack bot token used when SDK client is created internally.
     */
    readonly token?: string

    /**
     * Slack signing secret used for Events API request verification.
     */
    readonly signingSecret?: string

    /**
     * Optional injected Slack-compatible client for tests.
     */
    readonly client?: ISlackWebApiClient

    /**
     * Maximum retry attempts for retryable upstream failures.
     */
    readonly retryMaxAttempts?: number

    /**
     * Optional sleep implementation used between retries.
     */
    readonly sleep?: (delayMs: number) => Promise<void>

    /**
     * Optional timestamp tolerance for signature verification.
     */
    readonly signatureToleranceMs?: number

    /**
     * Optional clock used for deterministic signature verification tests.
     */
    readonly now?: () => Date
}

interface ISlackMessageOptions {
    readonly threadTs?: string
    readonly replyBroadcast?: boolean
    readonly mrkdwn?: boolean
    readonly unfurlLinks?: boolean
    readonly unfurlMedia?: boolean
}

interface INormalizedSlackSendRequest {
    readonly dedupeKey: string
    readonly recipients: readonly string[]
    readonly request: Omit<ISlackPostMessageRequest, "channel">
}

/**
 * Slack implementation of notification delivery and Events API verification.
 */
export class SlackProvider implements ISlackProvider {
    public readonly channel = NOTIFICATION_CHANNEL.SLACK

    private readonly client: ISlackWebApiClient
    private readonly signingSecret?: string
    private readonly retryMaxAttempts: number
    private readonly sleep: (delayMs: number) => Promise<void>
    private readonly signatureToleranceMs: number
    private readonly now: () => Date
    private readonly sentDedupeKeys: Set<string>
    private readonly inFlightByDedupeKey: Map<string, Promise<void>>

    /**
     * Creates Slack provider.
     *
     * @param options Provider configuration.
     */
    public constructor(options: ISlackProviderOptions) {
        this.client = options.client ?? createSlackWebApiClient(options)
        this.signingSecret = normalizeOptionalText(options.signingSecret)
        this.retryMaxAttempts = normalizeRetryMaxAttempts(options.retryMaxAttempts)
        this.sleep = options.sleep ?? defaultSleep
        this.signatureToleranceMs = normalizeSignatureToleranceMs(options.signatureToleranceMs)
        this.now = options.now ?? (() => new Date())
        this.sentDedupeKeys = new Set<string>()
        this.inFlightByDedupeKey = new Map<string, Promise<void>>()
    }

    /**
     * Sends Slack notification idempotently by dedupe key.
     *
     * @param payload Shared notification payload.
     * @returns Completion promise.
     */
    public async send(payload: INotificationPayload): Promise<void> {
        const normalized = normalizeSlackSendRequest(payload)

        if (this.sentDedupeKeys.has(normalized.dedupeKey)) {
            return
        }

        const existingRequest = this.inFlightByDedupeKey.get(normalized.dedupeKey)
        if (existingRequest !== undefined) {
            await existingRequest
            return
        }

        const requestPromise = this.dispatchSlackRequest(normalized)
        this.inFlightByDedupeKey.set(normalized.dedupeKey, requestPromise)

        try {
            await requestPromise
            this.sentDedupeKeys.add(normalized.dedupeKey)
        } finally {
            this.inFlightByDedupeKey.delete(normalized.dedupeKey)
        }
    }

    /**
     * Verifies Slack request signature against configured signing secret.
     *
     * @param event Webhook event DTO.
     * @param rawBody Optional raw request body.
     * @returns True when signature is valid and timestamp is inside tolerance.
     */
    public verifyEventSignature(event: IWebhookEventDTO, rawBody?: string): boolean {
        const signingSecret = requireSigningSecret(this.signingSecret)

        if (normalizeOptionalText(event.platform)?.toLowerCase() !== "slack") {
            return false
        }

        if (!(event.timestamp instanceof Date) || Number.isFinite(event.timestamp.getTime()) === false) {
            return false
        }

        const actualSignature = normalizeOptionalText(event.signature)
        if (actualSignature === undefined) {
            return false
        }

        const timestampSeconds = Math.floor(event.timestamp.getTime() / 1000)
        const ageMs = Math.abs(this.now().getTime() - event.timestamp.getTime())
        if (ageMs > this.signatureToleranceMs) {
            return false
        }

        const payload = rawBody ?? JSON.stringify(event.payload)
        const expectedSignature = buildSlackRequestSignature(
            signingSecret,
            timestampSeconds,
            payload,
        )

        return safeCompareSignatures(expectedSignature, actualSignature)
    }

    /**
     * Parses generic webhook DTO into normalized Slack Events API envelope.
     *
     * @param event Webhook event DTO.
     * @returns Normalized Slack event envelope.
     */
    public parseEventEnvelope(event: IWebhookEventDTO): ISlackEventEnvelopeDTO {
        const platform = normalizeOptionalText(event.platform)?.toLowerCase()
        if (platform !== "slack") {
            throw new SlackProviderError("Webhook event platform must be slack", {
                code: SLACK_PROVIDER_ERROR_CODE.INVALID_EVENT,
                isRetryable: false,
            })
        }

        const payload = toRecord(event.payload)
        if (payload === null) {
            throw new SlackProviderError("Slack event payload must be an object", {
                code: SLACK_PROVIDER_ERROR_CODE.INVALID_EVENT,
                isRetryable: false,
            })
        }

        const type = normalizeOptionalText(readString(payload, "type"))
            ?? normalizeOptionalText(event.eventType)
        if (type === undefined) {
            throw new SlackProviderError("Slack event type is required", {
                code: SLACK_PROVIDER_ERROR_CODE.INVALID_EVENT,
                isRetryable: false,
            })
        }

        if (type === SLACK_EVENT_ENVELOPE_TYPE.URL_VERIFICATION) {
            const challenge = normalizeOptionalText(readString(payload, "challenge"))
            if (challenge === undefined) {
                throw new SlackProviderError("Slack url_verification challenge is required", {
                    code: SLACK_PROVIDER_ERROR_CODE.INVALID_EVENT,
                    isRetryable: false,
                })
            }

            return {
                type,
                challenge,
                token: normalizeOptionalText(readString(payload, "token")),
            }
        }

        return {
            type,
            token: normalizeOptionalText(readString(payload, "token")),
            challenge: normalizeOptionalText(readString(payload, "challenge")),
            teamId: normalizeOptionalText(readString(payload, "team_id")),
            apiAppId: normalizeOptionalText(readString(payload, "api_app_id")),
            eventId: normalizeOptionalText(readString(payload, "event_id")),
            eventTime: readFiniteNumber(payload, "event_time"),
            event: normalizeSlackInnerEvent(readOptionalRecord(payload, "event"), type),
            authedUsers: readStringArray(payload, "authed_users"),
            authorizations: readRecordArray(payload, "authorizations"),
        }
    }

    /**
     * Resolves Slack URL verification challenge.
     *
     * @param envelope Normalized Slack envelope.
     * @returns Challenge string or null.
     */
    public resolveUrlVerificationChallenge(envelope: ISlackEventEnvelopeDTO): string | null {
        if (envelope.type !== SLACK_EVENT_ENVELOPE_TYPE.URL_VERIFICATION) {
            return null
        }

        return envelope.challenge ?? null
    }

    /**
     * Dispatches one deduplicated notification request to all recipients.
     *
     * @param normalized Normalized Slack send request.
     * @returns Completion promise.
     */
    private async dispatchSlackRequest(normalized: INormalizedSlackSendRequest): Promise<void> {
        for (const recipient of normalized.recipients) {
            await this.executeRequest(async () => {
                const response = await this.client.chat.postMessage({
                    channel: recipient,
                    ...normalized.request,
                })

                assertSlackPostMessageResponse(response, normalized.dedupeKey)
            }, normalized.dedupeKey)
        }
    }

    /**
     * Executes Slack request with retry semantics.
     *
     * @param operation Deferred Slack API call.
     * @param dedupeKey Delivery dedupe key.
     * @returns Completion promise.
     */
    private async executeRequest(
        operation: () => Promise<void>,
        dedupeKey: string,
    ): Promise<void> {
        let attempt = 1

        while (true) {
            try {
                await operation()
                return
            } catch (error: unknown) {
                const normalizedError = normalizeSlackError(error, dedupeKey)
                if (normalizedError.isRetryable === false || attempt >= this.retryMaxAttempts) {
                    throw normalizedError
                }

                await this.sleep(resolveRetryDelayMs(normalizedError, attempt))
                attempt += 1
            }
        }
    }
}

/**
 * Creates Slack SDK-backed client.
 *
 * @param options Provider options.
 * @returns Slack-compatible client.
 */
function createSlackWebApiClient(options: ISlackProviderOptions): ISlackWebApiClient {
    const token = normalizeOptionalText(options.token)
    if (token === undefined) {
        throw new SlackProviderError("Slack token is required when client is not provided", {
            code: SLACK_PROVIDER_ERROR_CODE.CONFIGURATION,
            isRetryable: false,
        })
    }

    return new WebClient(token) as unknown as ISlackWebApiClient
}

/**
 * Validates and normalizes Slack send request.
 *
 * @param payload Shared notification payload.
 * @returns Normalized Slack request.
 */
function normalizeSlackSendRequest(payload: INotificationPayload): INormalizedSlackSendRequest {
    validateSlackChannel(payload.channel)
    const event = validateNotificationEvent(payload.event)
    const urgency = validateNotificationUrgency(payload.urgency)
    const recipients = normalizeRecipients(payload.recipients)
    const title = requireText(payload.title, "title")
    const body = requireText(payload.body, "body")
    const metadata = normalizeMetadata(payload.metadata)
    const slackOptions = extractSlackMessageOptions(metadata)
    const dedupeKey =
        normalizeOptionalText(payload.dedupeKey)
        ?? buildSlackDeliveryDedupeKey({
            event,
            urgency,
            recipients,
            title,
            body,
            metadata,
        })

    return {
        dedupeKey,
        recipients,
        request: buildSlackPostMessageRequest(title, body, slackOptions),
    }
}

/**
 * Formats Slack-compatible message text from title and body.
 *
 * @param title Notification title.
 * @param body Notification body.
 * @returns Formatted message text.
 */
function formatSlackMessageText(title: string, body: string): string {
    return `*${title}*\n${body}`
}

/**
 * Builds Slack postMessage request body from normalized message text and options.
 *
 * @param title Notification title.
 * @param body Notification body.
 * @param options Slack-specific options.
 * @returns Slack postMessage request.
 */
function buildSlackPostMessageRequest(
    title: string,
    body: string,
    options: ISlackMessageOptions,
): Omit<ISlackPostMessageRequest, "channel"> {
    return {
        text: formatSlackMessageText(title, body),
        ...(options.threadTs !== undefined ? {thread_ts: options.threadTs} : {}),
        ...(options.threadTs !== undefined && options.replyBroadcast !== undefined
            ? {reply_broadcast: options.replyBroadcast}
            : {}),
        ...(options.mrkdwn !== undefined ? {mrkdwn: options.mrkdwn} : {}),
        ...(options.unfurlLinks !== undefined ? {unfurl_links: options.unfurlLinks} : {}),
        ...(options.unfurlMedia !== undefined ? {unfurl_media: options.unfurlMedia} : {}),
    }
}

/**
 * Extracts optional Slack-specific request settings from metadata.
 *
 * @param metadata Normalized notification metadata.
 * @returns Slack message options.
 */
function extractSlackMessageOptions(
    metadata: Readonly<Record<string, unknown>> | undefined,
): ISlackMessageOptions {
    if (metadata === undefined) {
        return {}
    }

    const slackRecord = readOptionalRecord(metadata, "slack") ?? metadata

    return {
        threadTs: normalizeOptionalText(readString(slackRecord, "threadTs"))
            ?? normalizeOptionalText(readString(slackRecord, "thread_ts")),
        replyBroadcast:
            readBoolean(slackRecord, "replyBroadcast") ?? readBoolean(slackRecord, "reply_broadcast"),
        mrkdwn: readBoolean(slackRecord, "mrkdwn"),
        unfurlLinks:
            readBoolean(slackRecord, "unfurlLinks") ?? readBoolean(slackRecord, "unfurl_links"),
        unfurlMedia:
            readBoolean(slackRecord, "unfurlMedia") ?? readBoolean(slackRecord, "unfurl_media"),
    }
}

/**
 * Builds deterministic Slack delivery dedupe key from normalized payload.
 *
 * @param input Normalized payload fragments.
 * @returns Stable dedupe key.
 */
function buildSlackDeliveryDedupeKey(input: {
    readonly event: NotificationEvent
    readonly urgency: NotificationUrgency
    readonly recipients: readonly string[]
    readonly title: string
    readonly body: string
    readonly metadata?: Readonly<Record<string, unknown>>
}): string {
    const serialized = stableSerialize({
        event: input.event,
        urgency: input.urgency,
        recipients: [...input.recipients],
        title: input.title,
        body: input.body,
        metadata: input.metadata,
    })

    return `slack:${createHash("sha256").update(serialized).digest("hex")}`
}

/**
 * Converts Slack API response payload into typed error when `ok !== true`.
 *
 * @param response Slack API response.
 * @param dedupeKey Delivery dedupe key.
 */
function assertSlackPostMessageResponse(
    response: ISlackPostMessageResponse,
    dedupeKey: string,
): void {
    if (response.ok === true) {
        return
    }

    const errorCode = normalizeOptionalText(response.error) ?? "slack_api_error"
    throw createPlatformResponseError(errorCode, dedupeKey)
}

/**
 * Normalizes thrown Slack SDK or transport errors into SlackProviderError.
 *
 * @param error Unknown thrown error.
 * @param dedupeKey Delivery dedupe key.
 * @returns Normalized Slack provider error.
 */
function normalizeSlackError(error: unknown, dedupeKey: string): SlackProviderError {
    if (error instanceof SlackProviderError) {
        return error
    }

    if (isSlackRateLimitedError(error)) {
        return createSlackRateLimitError(error.retryAfter * 1000, dedupeKey)
    }

    if (isSlackHttpError(error)) {
        return normalizeSlackHttpFailure(error, dedupeKey)
    }

    if (isSlackPlatformError(error)) {
        return createPlatformResponseError(error.data.error, dedupeKey)
    }

    if (isSlackRequestError(error)) {
        return new SlackProviderError("Slack request failed before reaching API", {
            code: SLACK_PROVIDER_ERROR_CODE.REQUEST_FAILED,
            isRetryable: true,
            dedupeKey,
        })
    }

    return new SlackProviderError("Slack request failed unexpectedly", {
        code: SLACK_PROVIDER_ERROR_CODE.REQUEST_FAILED,
        isRetryable: false,
        dedupeKey,
    })
}

/**
 * Maps Slack platform error string into adapter-specific error.
 *
 * @param errorCode Slack platform error code.
 * @param dedupeKey Delivery dedupe key.
 * @returns Normalized Slack provider error.
 */
function createPlatformResponseError(
    errorCode: string,
    dedupeKey: string,
): SlackProviderError {
    const normalizedErrorCode = normalizeOptionalText(errorCode) ?? "slack_api_error"
    const providerCode = mapSlackPlatformErrorCode(normalizedErrorCode)

    return new SlackProviderError(
        `Slack API rejected request: ${normalizedErrorCode}`,
        {
            code: providerCode,
            isRetryable: providerCode === SLACK_PROVIDER_ERROR_CODE.RATE_LIMITED,
            dedupeKey,
        },
    )
}

/**
 * Creates normalized rate-limit error payload.
 *
 * @param retryAfterMs Retry delay in milliseconds.
 * @param dedupeKey Delivery dedupe key.
 * @param statusCode Optional HTTP status code.
 * @returns Slack provider error.
 */
function createSlackRateLimitError(
    retryAfterMs: number | undefined,
    dedupeKey: string,
    statusCode?: number,
): SlackProviderError {
    return new SlackProviderError("Slack API rate limit exceeded", {
        code: SLACK_PROVIDER_ERROR_CODE.RATE_LIMITED,
        isRetryable: true,
        retryAfterMs,
        statusCode,
        dedupeKey,
    })
}

/**
 * Normalizes Slack HTTP transport failures.
 *
 * @param error Slack HTTP error.
 * @param dedupeKey Delivery dedupe key.
 * @returns Normalized provider error.
 */
function normalizeSlackHttpFailure(
    error: WebAPIHTTPError,
    dedupeKey: string,
): SlackProviderError {
    if (error.statusCode === 429) {
        return createSlackRateLimitError(readRetryAfterMs(error), dedupeKey, error.statusCode)
    }

    if (error.statusCode >= 500) {
        return new SlackProviderError("Slack API is temporarily unavailable", {
            code: SLACK_PROVIDER_ERROR_CODE.UPSTREAM_UNAVAILABLE,
            isRetryable: true,
            statusCode: error.statusCode,
            dedupeKey,
        })
    }

    if (error.statusCode === 401) {
        return new SlackProviderError("Slack authentication failed", {
            code: SLACK_PROVIDER_ERROR_CODE.AUTHENTICATION,
            isRetryable: false,
            statusCode: error.statusCode,
            dedupeKey,
        })
    }

    if (error.statusCode === 403) {
        return new SlackProviderError("Slack request was forbidden", {
            code: SLACK_PROVIDER_ERROR_CODE.PERMISSION_DENIED,
            isRetryable: false,
            statusCode: error.statusCode,
            dedupeKey,
        })
    }

    if (error.statusCode === 404) {
        return new SlackProviderError("Slack channel was not found", {
            code: SLACK_PROVIDER_ERROR_CODE.NOT_FOUND,
            isRetryable: false,
            statusCode: error.statusCode,
            dedupeKey,
        })
    }

    return new SlackProviderError(`Slack request failed with status ${error.statusCode}`, {
        code: SLACK_PROVIDER_ERROR_CODE.REQUEST_FAILED,
        isRetryable: false,
        statusCode: error.statusCode,
        dedupeKey,
    })
}

/**
 * Maps Slack platform error code into provider-level code.
 *
 * @param errorCode Slack platform error code.
 * @returns Provider-level error code.
 */
function mapSlackPlatformErrorCode(errorCode: string): SlackProviderErrorCode {
    if (["invalid_auth", "not_authed", "account_inactive", "token_revoked"].includes(errorCode)) {
        return SLACK_PROVIDER_ERROR_CODE.AUTHENTICATION
    }

    if (["missing_scope", "not_in_channel", "is_archived"].includes(errorCode)) {
        return SLACK_PROVIDER_ERROR_CODE.PERMISSION_DENIED
    }

    if (["channel_not_found", "thread_not_found"].includes(errorCode)) {
        return SLACK_PROVIDER_ERROR_CODE.NOT_FOUND
    }

    if (
        ["invalid_arguments", "msg_too_long", "no_text", "too_many_attachments"].includes(
            errorCode,
        )
    ) {
        return SLACK_PROVIDER_ERROR_CODE.INVALID_PAYLOAD
    }

    if (errorCode === "ratelimited") {
        return SLACK_PROVIDER_ERROR_CODE.RATE_LIMITED
    }

    return SLACK_PROVIDER_ERROR_CODE.REQUEST_FAILED
}

/**
 * Resolves retry delay with explicit `retryAfterMs` preference.
 *
 * @param error Normalized provider error.
 * @param attempt Current attempt number.
 * @returns Delay in milliseconds.
 */
function resolveRetryDelayMs(error: SlackProviderError, attempt: number): number {
    if (
        typeof error.retryAfterMs === "number"
        && Number.isFinite(error.retryAfterMs)
        && error.retryAfterMs > 0
    ) {
        return error.retryAfterMs
    }

    return DEFAULT_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1)
}

/**
 * Creates Slack request signature for verification.
 *
 * @param secret Slack signing secret.
 * @param timestampSeconds Unix timestamp.
 * @param payload Raw request body.
 * @returns Slack signature header value.
 */
function buildSlackRequestSignature(
    secret: string,
    timestampSeconds: number,
    payload: string,
): string {
    return `v0=${createHmac("sha256", secret)
        .update(`v0:${timestampSeconds}:${payload}`)
        .digest("hex")}`
}

/**
 * Compares expected and actual signatures using timing-safe comparison.
 *
 * @param expected Expected signature.
 * @param actual Actual signature.
 * @returns True when signatures match.
 */
function safeCompareSignatures(expected: string, actual: string): boolean {
    const expectedBuffer = Buffer.from(expected)
    const actualBuffer = Buffer.from(actual)
    if (expectedBuffer.length !== actualBuffer.length) {
        return false
    }

    return timingSafeEqual(expectedBuffer, actualBuffer)
}

/**
 * Ensures signing secret is available for webhook verification.
 *
 * @param signingSecret Optional signing secret.
 * @returns Normalized signing secret.
 */
function requireSigningSecret(signingSecret: string | undefined): string {
    const normalizedSecret = normalizeOptionalText(signingSecret)
    if (normalizedSecret === undefined) {
        throw new SlackProviderError(
            "Slack signing secret is required for webhook signature verification",
            {
                code: SLACK_PROVIDER_ERROR_CODE.CONFIGURATION,
                isRetryable: false,
            },
        )
    }

    return normalizedSecret
}

/**
 * Validates and deduplicates recipient identifiers.
 *
 * @param recipients Raw recipients.
 * @returns Normalized recipients.
 */
function normalizeRecipients(recipients: readonly string[]): readonly string[] {
    if (recipients.length === 0) {
        throw new SlackProviderError("At least one Slack recipient is required", {
            code: SLACK_PROVIDER_ERROR_CODE.INVALID_PAYLOAD,
            isRetryable: false,
        })
    }

    const normalizedRecipients = new Set<string>()
    for (const candidate of recipients) {
        const recipient = normalizeOptionalText(candidate)
        if (recipient === undefined) {
            throw new SlackProviderError("Slack recipient cannot be empty", {
                code: SLACK_PROVIDER_ERROR_CODE.INVALID_PAYLOAD,
                isRetryable: false,
            })
        }

        normalizedRecipients.add(recipient)
    }

    return [...normalizedRecipients]
}

/**
 * Validates required text input.
 *
 * @param value Raw text.
 * @param fieldName Field name for error messages.
 * @returns Normalized text.
 */
function requireText(value: string, fieldName: "title" | "body"): string {
    const normalized = normalizeOptionalText(value)
    if (normalized === undefined) {
        throw new SlackProviderError(`${fieldName} cannot be empty`, {
            code: SLACK_PROVIDER_ERROR_CODE.INVALID_PAYLOAD,
            isRetryable: false,
        })
    }

    return normalized
}

/**
 * Validates that notification channel matches Slack provider.
 *
 * @param channel Raw notification channel.
 */
function validateSlackChannel(channel: string): void {
    if (normalizeOptionalText(channel) === NOTIFICATION_CHANNEL.SLACK) {
        return
    }

    throw new SlackProviderError("Slack provider can only send SLACK channel payloads", {
        code: SLACK_PROVIDER_ERROR_CODE.INVALID_PAYLOAD,
        isRetryable: false,
    })
}

/**
 * Validates notification event.
 *
 * @param event Raw event value.
 * @returns Validated notification event.
 */
function validateNotificationEvent(event: string): NotificationEvent {
    const normalizedEvent = normalizeOptionalText(event)
    if (normalizedEvent !== undefined && isNotificationEvent(normalizedEvent)) {
        return normalizedEvent
    }

    throw new SlackProviderError("Notification event is invalid", {
        code: SLACK_PROVIDER_ERROR_CODE.INVALID_PAYLOAD,
        isRetryable: false,
    })
}

/**
 * Validates notification urgency.
 *
 * @param urgency Raw urgency value.
 * @returns Validated notification urgency.
 */
function validateNotificationUrgency(urgency: string): NotificationUrgency {
    const normalizedUrgency = normalizeOptionalText(urgency)
    if (normalizedUrgency !== undefined && isNotificationUrgency(normalizedUrgency)) {
        return normalizedUrgency
    }

    throw new SlackProviderError("Notification urgency is invalid", {
        code: SLACK_PROVIDER_ERROR_CODE.INVALID_PAYLOAD,
        isRetryable: false,
    })
}

/**
 * Validates metadata payload.
 *
 * @param metadata Raw metadata.
 * @returns Cloned metadata or undefined.
 */
function normalizeMetadata(
    metadata: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> | undefined {
    if (metadata === undefined) {
        return undefined
    }

    if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) {
        throw new SlackProviderError("Slack metadata must be a plain object", {
            code: SLACK_PROVIDER_ERROR_CODE.INVALID_PAYLOAD,
            isRetryable: false,
        })
    }

    return {...metadata}
}

/**
 * Normalizes Slack inner event payload.
 *
 * @param payload Optional inner event payload.
 * @param envelopeType Envelope type used for validation.
 * @returns Normalized inner event or undefined.
 */
function normalizeSlackInnerEvent(
    payload: Readonly<Record<string, unknown>> | undefined,
    envelopeType: string,
): ISlackEventBodyDTO | undefined {
    if (payload === undefined) {
        if (envelopeType === SLACK_EVENT_ENVELOPE_TYPE.EVENT_CALLBACK) {
            throw new SlackProviderError("Slack event_callback envelope must include inner event", {
                code: SLACK_PROVIDER_ERROR_CODE.INVALID_EVENT,
                isRetryable: false,
            })
        }

        return undefined
    }

    const type = normalizeOptionalText(readString(payload, "type"))
    if (type === undefined) {
        throw new SlackProviderError("Slack inner event type is required", {
            code: SLACK_PROVIDER_ERROR_CODE.INVALID_EVENT,
            isRetryable: false,
        })
    }

    return {
        ...payload,
        type,
        subtype: normalizeOptionalText(readString(payload, "subtype")),
        channel: normalizeOptionalText(readString(payload, "channel")),
        user: normalizeOptionalText(readString(payload, "user")),
        text: normalizeOptionalText(readString(payload, "text")),
        eventTs: normalizeOptionalText(readString(payload, "event_ts")),
        ts: normalizeOptionalText(readString(payload, "ts")),
        threadTs: normalizeOptionalText(readString(payload, "thread_ts")),
        botId: normalizeOptionalText(readString(payload, "bot_id")),
    }
}

/**
 * Reads optional string field from a record.
 *
 * @param record Source record.
 * @param key Field key.
 * @returns String value or undefined.
 */
function readString(record: Readonly<Record<string, unknown>>, key: string): string | undefined {
    const value = record[key]
    if (typeof value !== "string") {
        return undefined
    }

    return value
}

/**
 * Reads optional boolean field from a record.
 *
 * @param record Source record.
 * @param key Field key.
 * @returns Boolean value or undefined.
 */
function readBoolean(
    record: Readonly<Record<string, unknown>>,
    key: string,
): boolean | undefined {
    const value = record[key]
    if (typeof value !== "boolean") {
        return undefined
    }

    return value
}

/**
 * Reads optional finite number field from a record.
 *
 * @param record Source record.
 * @param key Field key.
 * @returns Number value or undefined.
 */
function readFiniteNumber(
    record: Readonly<Record<string, unknown>>,
    key: string,
): number | undefined {
    const value = record[key]
    if (typeof value !== "number" || Number.isFinite(value) === false) {
        return undefined
    }

    return value
}

/**
 * Reads optional nested record from a record.
 *
 * @param record Source record.
 * @param key Field key.
 * @returns Nested record or undefined.
 */
function readOptionalRecord(
    record: Readonly<Record<string, unknown>>,
    key: string,
): Readonly<Record<string, unknown>> | undefined {
    const candidate = toRecord(record[key])
    return candidate ?? undefined
}

/**
 * Reads optional string array from a record.
 *
 * @param record Source record.
 * @param key Field key.
 * @returns String array or undefined.
 */
function readStringArray(
    record: Readonly<Record<string, unknown>>,
    key: string,
): readonly string[] | undefined {
    const value = record[key]
    if (Array.isArray(value) === false) {
        return undefined
    }

    const normalized: string[] = []
    for (const candidate of value) {
        if (typeof candidate !== "string") {
            continue
        }

        const item = normalizeOptionalText(candidate)
        if (item !== undefined) {
            normalized.push(item)
        }
    }

    return normalized.length === 0 ? undefined : normalized
}

/**
 * Reads optional record array from a record.
 *
 * @param record Source record.
 * @param key Field key.
 * @returns Record array or undefined.
 */
function readRecordArray(
    record: Readonly<Record<string, unknown>>,
    key: string,
): readonly Readonly<Record<string, unknown>>[] | undefined {
    const value = record[key]
    if (Array.isArray(value) === false) {
        return undefined
    }

    const normalized = value
        .map((candidate) => toRecord(candidate))
        .filter((candidate) => candidate !== null)

    return normalized.length === 0 ? undefined : normalized
}

/**
 * Converts unknown candidate into plain record.
 *
 * @param candidate Unknown candidate.
 * @returns Plain record or null.
 */
function toRecord(candidate: unknown): Readonly<Record<string, unknown>> | null {
    if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) {
        return null
    }

    return candidate as Readonly<Record<string, unknown>>
}

/**
 * Normalizes optional text.
 *
 * @param value Raw text.
 * @returns Trimmed text or undefined.
 */
function normalizeOptionalText(value: string | undefined): string | undefined {
    if (typeof value !== "string") {
        return undefined
    }

    const normalized = value.trim()
    return normalized.length === 0 ? undefined : normalized
}

/**
 * Normalizes retry attempts configuration.
 *
 * @param retryMaxAttempts Raw retry configuration.
 * @returns Positive retry attempt count.
 */
function normalizeRetryMaxAttempts(retryMaxAttempts: number | undefined): number {
    if (retryMaxAttempts === undefined) {
        return DEFAULT_RETRY_MAX_ATTEMPTS
    }

    if (
        Number.isInteger(retryMaxAttempts) === false
        || Number.isFinite(retryMaxAttempts) === false
        || retryMaxAttempts < 1
    ) {
        throw new SlackProviderError("retryMaxAttempts must be a positive integer", {
            code: SLACK_PROVIDER_ERROR_CODE.CONFIGURATION,
            isRetryable: false,
        })
    }

    return retryMaxAttempts
}

/**
 * Normalizes signature tolerance configuration.
 *
 * @param signatureToleranceMs Raw signature tolerance.
 * @returns Positive tolerance in milliseconds.
 */
function normalizeSignatureToleranceMs(signatureToleranceMs: number | undefined): number {
    if (signatureToleranceMs === undefined) {
        return DEFAULT_SIGNATURE_TOLERANCE_MS
    }

    if (
        Number.isFinite(signatureToleranceMs) === false
        || signatureToleranceMs <= 0
        || Number.isInteger(signatureToleranceMs) === false
    ) {
        throw new SlackProviderError("signatureToleranceMs must be a positive integer", {
            code: SLACK_PROVIDER_ERROR_CODE.CONFIGURATION,
            isRetryable: false,
        })
    }

    return signatureToleranceMs
}

/**
 * Reads retry-after header from Slack HTTP error.
 *
 * @param error Slack HTTP error.
 * @returns Retry delay in milliseconds or undefined.
 */
function readRetryAfterMs(error: WebAPIHTTPError): number | undefined {
    return parseRetryAfterHeaderValue(error.headers["retry-after"])
}

/**
 * Parses retry-after header value into milliseconds.
 *
 * @param headerValue Raw retry-after header.
 * @returns Delay in milliseconds or undefined.
 */
function parseRetryAfterHeaderValue(
    headerValue: unknown,
): number | undefined {
    if (typeof headerValue === "string") {
        return parseRetryAfterText(headerValue)
    }

    if (Array.isArray(headerValue) === false || headerValue.length === 0) {
        return undefined
    }

    const firstHeaderValue = headerValue.find((candidate: unknown): candidate is string => {
        return typeof candidate === "string"
    })
    if (firstHeaderValue === undefined) {
        return undefined
    }

    return parseRetryAfterText(firstHeaderValue)
}

/**
 * Parses string retry-after header into milliseconds.
 *
 * @param value Retry-after header text.
 * @returns Delay in milliseconds or undefined.
 */
function parseRetryAfterText(value: string): number | undefined {
    const retryAfterSeconds = Number(value)
    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
        return retryAfterSeconds * 1000
    }

    const retryAfterDate = new Date(value)
    if (Number.isFinite(retryAfterDate.getTime()) === false) {
        return undefined
    }

    const delayMs = retryAfterDate.getTime() - Date.now()
    return delayMs > 0 ? delayMs : undefined
}

/**
 * Creates stable JSON payload with sorted object keys.
 *
 * @param value Arbitrary input.
 * @returns Stable JSON string.
 */
function stableSerialize(value: unknown): string {
    return JSON.stringify(sortValue(value))
}

/**
 * Recursively sorts object keys for deterministic serialization.
 *
 * @param value Arbitrary input.
 * @returns Sorted structure.
 */
function sortValue(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map((item) => sortValue(item))
    }

    if (typeof value !== "object" || value === null) {
        return value
    }

    const record = value as Record<string, unknown>
    const sorted = Object.keys(record)
        .sort((left, right) => left.localeCompare(right))
        .reduce<Record<string, unknown>>((accumulator, key) => {
            accumulator[key] = sortValue(record[key])
            return accumulator
        }, {})

    return sorted
}

/**
 * Type guard for Slack rate-limit error.
 *
 * @param error Unknown error candidate.
 * @returns True when candidate matches Slack rate-limit error shape.
 */
function isSlackRateLimitedError(error: unknown): error is WebAPIRateLimitedError {
    return readErrorCode(error) === ErrorCode.RateLimitedError
}

/**
 * Type guard for Slack HTTP error.
 *
 * @param error Unknown error candidate.
 * @returns True when candidate matches Slack HTTP error shape.
 */
function isSlackHttpError(error: unknown): error is WebAPIHTTPError {
    return readErrorCode(error) === ErrorCode.HTTPError
}

/**
 * Type guard for Slack platform error.
 *
 * @param error Unknown error candidate.
 * @returns True when candidate matches Slack platform error shape.
 */
function isSlackPlatformError(error: unknown): error is WebAPIPlatformError {
    return readErrorCode(error) === ErrorCode.PlatformError
}

/**
 * Type guard for Slack request error.
 *
 * @param error Unknown error candidate.
 * @returns True when candidate matches Slack request error shape.
 */
function isSlackRequestError(error: unknown): error is WebAPIRequestError {
    return readErrorCode(error) === ErrorCode.RequestError
}

/**
 * Reads coded error string from an unknown error candidate.
 *
 * @param error Unknown error candidate.
 * @returns Slack SDK error code or undefined.
 */
function readErrorCode(error: unknown): ErrorCode | undefined {
    const record = toRecord(error)
    const code = record?.["code"]
    return typeof code === "string" ? (code as ErrorCode) : undefined
}

/**
 * Default async sleep helper.
 *
 * @param delayMs Delay in milliseconds.
 * @returns Completion promise.
 */
function defaultSleep(delayMs: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, delayMs)
    })
}
