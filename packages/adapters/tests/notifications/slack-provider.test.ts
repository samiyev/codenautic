import {createHmac} from "node:crypto"

import {describe, expect, test} from "bun:test"
import {
    ErrorCode,
    type WebAPIHTTPError,
    type WebAPIPlatformError,
    type WebAPIRateLimitedError,
    type WebAPIRequestError,
} from "@slack/web-api"
import {
    NOTIFICATION_CHANNEL,
    NOTIFICATION_EVENT,
    NOTIFICATION_URGENCY,
    SLACK_EVENT_ENVELOPE_TYPE,
    type INotificationPayload,
    type IWebhookEventDTO,
} from "@codenautic/core"

import {
    SLACK_PROVIDER_ERROR_CODE,
    SlackProvider,
    SlackProviderError,
    type ISlackPostMessageRequest,
    type ISlackPostMessageResponse,
    type ISlackWebApiClient,
} from "../../src/notifications"

class FakeSlackClient implements ISlackWebApiClient {
    public readonly calls: ISlackPostMessageRequest[]
    private readonly responses: Array<
        ISlackPostMessageResponse | Error | (() => Promise<ISlackPostMessageResponse>)
    >

    public constructor(
        responses: Array<ISlackPostMessageResponse | Error | (() => Promise<ISlackPostMessageResponse>)>,
    ) {
        this.calls = []
        this.responses = [...responses]
    }

    public readonly chat = {
        postMessage: async (request: ISlackPostMessageRequest): Promise<ISlackPostMessageResponse> => {
            this.calls.push(request)
            const next = this.responses.shift()

            if (isSlackErrorCandidate(next)) {
                throw next
            }

            if (typeof next === "function") {
                return next()
            }

            return next ?? {ok: true}
        },
    }
}

function isSlackErrorCandidate(
    candidate: unknown,
): candidate is Error | WebAPIHTTPError | WebAPIPlatformError | WebAPIRateLimitedError | WebAPIRequestError {
    if (candidate instanceof Error) {
        return true
    }

    if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) {
        return false
    }

    const record = candidate as Record<string, unknown>
    return typeof record["code"] === "string" && typeof record["message"] === "string"
}

function createSlackPayload(
    overrides: Partial<INotificationPayload> = {},
): INotificationPayload {
    return {
        channel: NOTIFICATION_CHANNEL.SLACK,
        event: NOTIFICATION_EVENT.REVIEW_COMPLETED,
        recipients: ["C123", "C456", "C123"],
        title: "Review completed",
        body: "Merge request is ready",
        urgency: NOTIFICATION_URGENCY.NORMAL,
        ...overrides,
    }
}

function createRateLimitedError(retryAfterSeconds: number): WebAPIRateLimitedError {
    return {
        name: "WebAPIRateLimitedError",
        code: ErrorCode.RateLimitedError,
        retryAfter: retryAfterSeconds,
        message: "rate limited",
    }
}

function createHttpError(statusCode: number): WebAPIHTTPError {
    return {
        name: "WebAPIHTTPError",
        code: ErrorCode.HTTPError,
        statusCode,
        statusMessage: `HTTP ${statusCode}`,
        headers: {},
        message: `http ${statusCode}`,
    }
}

function createRequestError(): WebAPIRequestError {
    return {
        name: "WebAPIRequestError",
        code: ErrorCode.RequestError,
        original: new Error("network down"),
        message: "request failed",
    }
}

function createPlatformError(errorCode: string): WebAPIPlatformError {
    return {
        name: "WebAPIPlatformError",
        code: ErrorCode.PlatformError,
        data: {
            ok: false,
            error: errorCode,
        },
        message: errorCode,
    }
}

function createSignedSlackEvent(
    payload: Readonly<Record<string, unknown>>,
    options: {
        readonly eventType?: string
        readonly secret?: string
        readonly timestamp?: Date
    } = {},
): {
    readonly event: IWebhookEventDTO
    readonly rawBody: string
} {
    const rawBody = JSON.stringify(payload)
    const timestamp = options.timestamp ?? new Date("2026-03-09T10:00:00.000Z")
    const timestampSeconds = Math.floor(timestamp.getTime() / 1000)
    const secret = options.secret ?? "signing-secret"
    const signature = `v0=${createHmac("sha256", secret)
        .update(`v0:${timestampSeconds}:${rawBody}`)
        .digest("hex")}`

    return {
        rawBody,
        event: {
            eventType: options.eventType ?? "event_callback",
            payload,
            signature,
            platform: "slack",
            timestamp,
        },
    }
}

describe("SlackProvider", () => {
    test("sends one Slack message per unique recipient and suppresses duplicate dedupe key", async () => {
        const client = new FakeSlackClient([
            {ok: true, channel: "C123", ts: "1"},
            {ok: true, channel: "C456", ts: "2"},
        ])
        const provider = new SlackProvider({
            client,
            token: "xoxb-test",
        })

        const payload = createSlackPayload({
            dedupeKey: "review:123",
        })

        await provider.send(payload)
        await provider.send(payload)

        expect(client.calls).toHaveLength(2)
        expect(client.calls[0]).toMatchObject({
            channel: "C123",
            text: "*Review completed*\nMerge request is ready",
        })
        expect(client.calls[1]?.channel).toBe("C456")
    })

    test("derives deterministic dedupe key when payload does not provide one", async () => {
        const client = new FakeSlackClient([{ok: true}, {ok: true}])
        const provider = new SlackProvider({
            client,
            token: "xoxb-test",
        })

        const payload = createSlackPayload({
            recipients: ["C999"],
        })

        await provider.send(payload)
        await provider.send(payload)

        expect(client.calls).toHaveLength(1)
    })

    test("retries rate limited Slack API errors using retry-after hint", async () => {
        const sleepCalls: number[] = []
        const client = new FakeSlackClient([
            createRateLimitedError(2),
            {ok: true, channel: "C123", ts: "1"},
        ])
        const provider = new SlackProvider({
            client,
            token: "xoxb-test",
            sleep(delayMs: number): Promise<void> {
                sleepCalls.push(delayMs)
                return Promise.resolve()
            },
        })

        await provider.send(
            createSlackPayload({
                recipients: ["C123"],
                dedupeKey: "retry-after",
            }),
        )

        expect(client.calls).toHaveLength(2)
        expect(sleepCalls).toEqual([2000])
    })

    test("retries retryable HTTP and request errors before succeeding", async () => {
        const sleepCalls: number[] = []
        const client = new FakeSlackClient([
            createRequestError(),
            createHttpError(503),
            {ok: true, channel: "C123", ts: "1"},
        ])
        const provider = new SlackProvider({
            client,
            token: "xoxb-test",
            sleep(delayMs: number): Promise<void> {
                sleepCalls.push(delayMs)
                return Promise.resolve()
            },
        })

        await provider.send(
            createSlackPayload({
                recipients: ["C123"],
                dedupeKey: "retry-network",
            }),
        )

        expect(client.calls).toHaveLength(3)
        expect(sleepCalls).toEqual([250, 500])
    })

    test("throws typed error for non-retryable platform failures", async () => {
        const client = new FakeSlackClient([createPlatformError("invalid_auth")])
        const provider = new SlackProvider({
            client,
            token: "xoxb-test",
        })

        const execution = provider.send(
            createSlackPayload({
                recipients: ["C123"],
                dedupeKey: "invalid-auth",
            }),
        )

        try {
            await execution
            throw new Error("Expected SlackProviderError to be thrown")
        } catch (error: unknown) {
            expect(error).toBeInstanceOf(SlackProviderError)
            expect(error).toMatchObject({
                code: SLACK_PROVIDER_ERROR_CODE.AUTHENTICATION,
                isRetryable: false,
            })
        }
    })

    test("verifies Slack request signatures with configured signing secret", () => {
        const provider = new SlackProvider({
            client: new FakeSlackClient([]),
            signingSecret: "signing-secret",
            now: () => new Date("2026-03-09T10:02:00.000Z"),
        })
        const {event, rawBody} = createSignedSlackEvent({
            type: "event_callback",
            event: {
                type: "app_mention",
            },
        })

        expect(provider.verifyEventSignature(event, rawBody)).toBe(true)
    })

    test("rejects Slack signatures when timestamp is stale", () => {
        const provider = new SlackProvider({
            client: new FakeSlackClient([]),
            signingSecret: "signing-secret",
            now: () => new Date("2026-03-09T10:10:01.000Z"),
        })
        const {event, rawBody} = createSignedSlackEvent(
            {
                type: "event_callback",
                event: {
                    type: "app_mention",
                },
            },
            {
                timestamp: new Date("2026-03-09T10:00:00.000Z"),
            },
        )

        expect(provider.verifyEventSignature(event, rawBody)).toBe(false)
    })

    test("parses normalized event callback envelopes and resolves url challenge", () => {
        const provider = new SlackProvider({
            client: new FakeSlackClient([]),
            token: "xoxb-test",
        })
        const challengeEnvelope = provider.parseEventEnvelope({
            eventType: "url_verification",
            payload: {
                type: "url_verification",
                challenge: "challenge-token",
            },
            signature: "v0=abc",
            platform: "slack",
            timestamp: new Date("2026-03-09T10:00:00.000Z"),
        })
        const callbackEnvelope = provider.parseEventEnvelope({
            eventType: "event_callback",
            payload: {
                type: "event_callback",
                team_id: "T123",
                api_app_id: "A123",
                event_id: "Ev123",
                event_time: 1_773_020_000,
                authed_users: ["U123"],
                event: {
                    type: "app_mention",
                    channel: "C123",
                    user: "U123",
                    text: "hello bot",
                    thread_ts: "1773020000.000100",
                    event_ts: "1773020000.000100",
                },
            },
            signature: "v0=abc",
            platform: "slack",
            timestamp: new Date("2026-03-09T10:00:00.000Z"),
        })

        expect(challengeEnvelope.type).toBe(SLACK_EVENT_ENVELOPE_TYPE.URL_VERIFICATION)
        expect(provider.resolveUrlVerificationChallenge(challengeEnvelope)).toBe("challenge-token")
        expect(callbackEnvelope.type).toBe(SLACK_EVENT_ENVELOPE_TYPE.EVENT_CALLBACK)
        expect(callbackEnvelope.teamId).toBe("T123")
        expect(callbackEnvelope.eventId).toBe("Ev123")
        expect(callbackEnvelope.event?.threadTs).toBe("1773020000.000100")
    })

    test("throws configuration error when token and client are both missing", () => {
        expect(() => {
            return new SlackProvider({})
        }).toThrowError(SlackProviderError)

        try {
            new SlackProvider({})
            throw new Error("Expected SlackProviderError to be thrown")
        } catch (error: unknown) {
            expect(error).toMatchObject({
                code: SLACK_PROVIDER_ERROR_CODE.CONFIGURATION,
                isRetryable: false,
            })
        }
    })
})
