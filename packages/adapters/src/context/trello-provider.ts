import type {
    ExternalContextSource,
    IExternalContext,
    IExternalContextProvider,
    ITrelloCard,
    ITrelloProvider,
} from "@codenautic/core"

import {TrelloCardAcl, TrelloContextAcl} from "./acl"
import {TrelloProviderError} from "./trello-provider.error"

const DEFAULT_TRELLO_API_URL = "https://api.trello.com"
const DEFAULT_RETRY_MAX_ATTEMPTS = 3
const DEFAULT_RETRY_BASE_DELAY_MS = 250
const DEFAULT_TRELLO_CARD_FIELDS = [
    "id",
    "name",
    "desc",
    "closed",
    "due",
    "dueComplete",
    "idList",
    "labels",
    "idMembers",
    "dateLastActivity",
] as const
const DEFAULT_TRELLO_LIST_FIELDS = [
    "id",
    "name",
    "closed",
] as const
const DEFAULT_TRELLO_MEMBER_FIELDS = [
    "id",
    "fullName",
    "username",
] as const
const DEFAULT_TRELLO_LABEL_FIELDS = [
    "id",
    "name",
    "color",
] as const

type TrelloCardPayload = Readonly<Record<string, unknown>>
type TrelloListPayload = Readonly<Record<string, unknown>>

/**
 * Response headers returned by Trello API client.
 */
export interface ITrelloResponseHeaders {
    readonly [key: string]: string | undefined
}

/**
 * Generic Trello API response envelope.
 */
export interface ITrelloApiResponse<TData> {
    /**
     * HTTP status code.
     */
    readonly status: number

    /**
     * Lower-cased HTTP headers.
     */
    readonly headers: ITrelloResponseHeaders

    /**
     * Decoded JSON body when available.
     */
    readonly data?: TData
}

/**
 * Parameters for Trello card fetch.
 */
export interface ITrelloGetCardRequest {
    /**
     * Trello card identifier.
     */
    readonly cardId: string

    /**
     * Requested Trello card fields.
     */
    readonly fields: readonly string[]

    /**
     * Requested Trello member fields.
     */
    readonly memberFields: readonly string[]

    /**
     * Requested Trello label fields.
     */
    readonly labelFields: readonly string[]
}

/**
 * Parameters for Trello list fetch.
 */
export interface ITrelloGetListRequest {
    /**
     * Trello list identifier.
     */
    readonly listId: string

    /**
     * Requested Trello list fields.
     */
    readonly fields: readonly string[]
}

/**
 * Minimal Trello client contract used by provider.
 */
export interface ITrelloApiClient {
    /**
     * Loads a single Trello card.
     *
     * @param request Card request parameters.
     * @returns API response envelope.
     */
    getCard(request: ITrelloGetCardRequest): Promise<ITrelloApiResponse<TrelloCardPayload>>

    /**
     * Loads a single Trello list.
     *
     * @param request List request parameters.
     * @returns API response envelope.
     */
    getList(request: ITrelloGetListRequest): Promise<ITrelloApiResponse<TrelloListPayload>>
}

/**
 * Trello provider constructor options.
 */
export interface ITrelloProviderOptions {
    /**
     * Base Trello API URL.
     */
    readonly baseUrl?: string

    /**
     * Trello API key.
     */
    readonly apiKey?: string

    /**
     * Trello API key alias.
     */
    readonly key?: string

    /**
     * Trello token.
     */
    readonly token?: string

    /**
     * Trello access token alias.
     */
    readonly accessToken?: string

    /**
     * Alternative auth token alias.
     */
    readonly authToken?: string

    /**
     * Optional injected Trello-compatible client for tests.
     */
    readonly client?: ITrelloApiClient

    /**
     * Optional custom fetch implementation.
     */
    readonly fetchImplementation?: typeof fetch

    /**
     * Maximum retry attempts for retryable upstream failures.
     */
    readonly retryMaxAttempts?: number

    /**
     * Optional sleep implementation used between retries.
     */
    readonly sleep?: (delayMs: number) => Promise<void>

    /**
     * Requested Trello card fields.
     */
    readonly cardFields?: readonly string[]

    /**
     * Requested Trello list fields.
     */
    readonly listFields?: readonly string[]

    /**
     * Requested Trello member fields.
     */
    readonly memberFields?: readonly string[]

    /**
     * Requested Trello label fields.
     */
    readonly labelFields?: readonly string[]

    /**
     * Enables additional list lookup for list name/status enrichment.
     */
    readonly includeListDetails?: boolean
}

/**
 * Trello implementation of shared external-context provider contracts.
 */
export class TrelloProvider implements IExternalContextProvider, ITrelloProvider {
    public readonly source: ExternalContextSource

    private readonly client: ITrelloApiClient
    private readonly cardAcl: TrelloCardAcl
    private readonly contextAcl: TrelloContextAcl
    private readonly retryMaxAttempts: number
    private readonly sleep: (delayMs: number) => Promise<void>
    private readonly cardFields: readonly string[]
    private readonly listFields: readonly string[]
    private readonly memberFields: readonly string[]
    private readonly labelFields: readonly string[]
    private readonly includeListDetails: boolean

    /**
     * Creates Trello provider.
     *
     * @param options Provider options.
     */
    public constructor(options: ITrelloProviderOptions) {
        this.source = "TRELLO"
        this.client = options.client ?? createTrelloApiClient(options)
        this.cardAcl = new TrelloCardAcl()
        this.contextAcl = new TrelloContextAcl()
        this.retryMaxAttempts = normalizeRetryMaxAttempts(options.retryMaxAttempts)
        this.sleep = options.sleep ?? defaultSleep
        this.cardFields = normalizeFieldList(options.cardFields, DEFAULT_TRELLO_CARD_FIELDS)
        this.listFields = normalizeFieldList(options.listFields, DEFAULT_TRELLO_LIST_FIELDS)
        this.memberFields = normalizeFieldList(options.memberFields, DEFAULT_TRELLO_MEMBER_FIELDS)
        this.labelFields = normalizeFieldList(options.labelFields, DEFAULT_TRELLO_LABEL_FIELDS)
        this.includeListDetails = options.includeListDetails ?? true
    }

    /**
     * Loads Trello card by identifier.
     *
     * @param cardId Trello card identifier.
     * @returns Normalized Trello card or null when not found.
     */
    public async getCard(cardId: string): Promise<ITrelloCard | null> {
        const payload = await this.resolveCardPayload(cardId)
        if (payload === null) {
            return null
        }

        return this.cardAcl.toDomain(payload)
    }

    /**
     * Loads Trello context and normalizes it to shared external-context payload.
     *
     * @param identifier Trello card identifier.
     * @returns Normalized external context or null when not found.
     */
    public async loadContext(identifier: string): Promise<IExternalContext | null> {
        const payload = await this.resolveCardPayload(identifier)
        if (payload === null) {
            return null
        }

        return this.contextAcl.toDomain(payload)
    }

    /**
     * Resolves canonical Trello card payload by identifier.
     *
     * @param identifier Trello card identifier.
     * @returns Canonical Trello card payload or null.
     */
    private async resolveCardPayload(identifier: string): Promise<TrelloCardPayload | null> {
        const normalizedIdentifier = normalizeOptionalText(identifier)
        if (normalizedIdentifier === undefined) {
            return null
        }

        const payload = await this.executeRequest<TrelloCardPayload>(
            () => {
                return this.client.getCard({
                    cardId: normalizedIdentifier,
                    fields: this.cardFields,
                    memberFields: this.memberFields,
                    labelFields: this.labelFields,
                })
            },
            true,
        )

        if (payload === null) {
            return null
        }

        const canonicalCardPayload = canonicalizePayload(payload)
        if (this.includeListDetails === false) {
            return canonicalCardPayload
        }

        const listId = readCardListIdentifier(canonicalCardPayload)
        if (listId === undefined) {
            return canonicalCardPayload
        }

        const listPayload = await this.executeRequest<TrelloListPayload>(
            () => {
                return this.client.getList({
                    listId,
                    fields: this.listFields,
                })
            },
            false,
        )

        if (listPayload === null) {
            return canonicalCardPayload
        }

        return mergeCardWithList(canonicalCardPayload, canonicalizePayload(listPayload))
    }

    /**
     * Executes Trello API request with retry handling for retryable statuses.
     *
     * @param operation Deferred client request.
     * @param allowNotFound Whether 404 should return null.
     * @returns Successful payload or null for allowed 404.
     */
    private async executeRequest<TData>(
        operation: () => Promise<ITrelloApiResponse<TData>>,
        allowNotFound: boolean,
    ): Promise<TData | null> {
        for (let attempt = 1; attempt <= this.retryMaxAttempts; attempt += 1) {
            try {
                const response = await operation()
                const resolution = resolveResponseData(response, allowNotFound)
                if (resolution !== undefined) {
                    return resolution
                }

                const error = createResponseError(response)
                if (await this.retryIfNeeded(error, attempt)) {
                    continue
                }

                throw error
            } catch (error: unknown) {
                const normalizedError = normalizeRequestError(error)
                if (await this.retryIfNeeded(normalizedError, attempt)) {
                    continue
                }

                throw normalizedError
            }
        }

        throw new TrelloProviderError("Trello request failed after exhausting retries", {
            code: "RETRY_EXHAUSTED",
            isRetryable: false,
        })
    }

    /**
     * Retries request when error is retryable and retry budget is still available.
     *
     * @param error Normalized provider error.
     * @param attempt Current attempt number.
     * @returns True when request should be retried.
     */
    private async retryIfNeeded(error: TrelloProviderError, attempt: number): Promise<boolean> {
        if (shouldRetryRequest(error, attempt, this.retryMaxAttempts) === false) {
            return false
        }

        await this.sleep(resolveRetryDelayMs(error, attempt))
        return true
    }
}

/**
 * Internal options for REST-backed Trello client.
 */
interface ITrelloRestApiClientOptions {
    readonly baseUrl: string
    readonly authQuery: Readonly<Record<string, string>>
    readonly fetchImplementation: typeof fetch
}

/**
 * Fetch-backed Trello REST API client.
 */
class TrelloRestApiClient implements ITrelloApiClient {
    private readonly baseUrl: string
    private readonly authQuery: Readonly<Record<string, string>>
    private readonly fetchImplementation: typeof fetch

    /**
     * Creates fetch-backed Trello client.
     *
     * @param options Client options.
     */
    public constructor(options: ITrelloRestApiClientOptions) {
        this.baseUrl = options.baseUrl
        this.authQuery = options.authQuery
        this.fetchImplementation = options.fetchImplementation
    }

    /**
     * Loads Trello card via REST API.
     *
     * @param request Card request parameters.
     * @returns API response envelope.
     */
    public getCard(request: ITrelloGetCardRequest): Promise<ITrelloApiResponse<TrelloCardPayload>> {
        return this.requestJson<TrelloCardPayload>("/1/cards/" + encodeURIComponent(request.cardId), {
            ...this.authQuery,
            fields: request.fields.join(","),
            members: "true",
            member_fields: request.memberFields.join(","),
            labels: "all",
            label_fields: request.labelFields.join(","),
        })
    }

    /**
     * Loads Trello list via REST API.
     *
     * @param request List request parameters.
     * @returns API response envelope.
     */
    public getList(request: ITrelloGetListRequest): Promise<ITrelloApiResponse<TrelloListPayload>> {
        return this.requestJson<TrelloListPayload>("/1/lists/" + encodeURIComponent(request.listId), {
            ...this.authQuery,
            fields: request.fields.join(","),
        })
    }

    /**
     * Executes JSON request against Trello REST API.
     *
     * @param path API path.
     * @param query Query parameters.
     * @returns Response envelope with decoded body.
     */
    private async requestJson<TData>(
        path: string,
        query: Readonly<Record<string, string>>,
    ): Promise<ITrelloApiResponse<TData>> {
        const url = buildRequestUrl(this.baseUrl, path, query)
        const response = await this.fetchImplementation(url, {
            method: "GET",
            headers: {
                Accept: "application/json",
            },
        })
        const data = await readJsonResponse<TData>(response)

        return {
            status: response.status,
            headers: readHeaders(response.headers),
            data,
        }
    }
}

/**
 * Creates fetch-backed Trello API client from provider options.
 *
 * @param options Provider options.
 * @returns Trello API client.
 */
function createTrelloApiClient(options: ITrelloProviderOptions): ITrelloApiClient {
    const baseUrl = normalizeOptionalText(options.baseUrl) ?? DEFAULT_TRELLO_API_URL

    return new TrelloRestApiClient({
        baseUrl,
        authQuery: createAuthQuery(options),
        fetchImplementation: options.fetchImplementation ?? fetch,
    })
}

/**
 * Creates Trello auth query from supported options.
 *
 * @param options Provider options.
 * @returns Query parameters with key and token.
 */
function createAuthQuery(options: ITrelloProviderOptions): Readonly<Record<string, string>> {
    const apiKey = normalizeOptionalText(options.apiKey ?? options.key)
    if (apiKey === undefined) {
        throw new TrelloProviderError("Trello apiKey is required when no client is provided", {
            code: "CONFIGURATION",
            isRetryable: false,
        })
    }

    const token = normalizeOptionalText(options.token ?? options.accessToken ?? options.authToken)
    if (token === undefined) {
        throw new TrelloProviderError("Trello token is required when no client is provided", {
            code: "CONFIGURATION",
            isRetryable: false,
        })
    }

    return {
        key: apiKey,
        token,
    }
}

/**
 * Reads JSON response body when available.
 *
 * @param response Fetch response.
 * @returns Parsed JSON payload or undefined.
 */
async function readJsonResponse<TData>(response: Response): Promise<TData | undefined> {
    const text = await response.text()
    if (text.trim().length === 0) {
        return undefined
    }

    try {
        return JSON.parse(text) as TData
    } catch {
        return undefined
    }
}

/**
 * Converts Headers object to lower-cased record.
 *
 * @param headers Fetch headers.
 * @returns Plain headers record.
 */
function readHeaders(headers: Headers): ITrelloResponseHeaders {
    const collected: Record<string, string | undefined> = {}

    headers.forEach((value, key) => {
        collected[key.toLowerCase()] = value
    })

    return collected
}

/**
 * Creates normalized Trello provider error from HTTP response envelope.
 *
 * @param response Trello API response.
 * @returns Normalized Trello provider error.
 */
function createResponseError(response: ITrelloApiResponse<unknown>): TrelloProviderError {
    const statusCode = response.status
    const retryAfterMs = readRetryAfterMs(response.headers)
    const message = readErrorMessage(response.data) ?? `Trello request failed with status ${String(statusCode)}`
    const code = readErrorCode(response.data) ?? `HTTP_${String(statusCode)}`

    return new TrelloProviderError(message, {
        statusCode,
        code,
        retryAfterMs,
        isRetryable: statusCode === 429 || statusCode >= 500,
    })
}

/**
 * Resolves response payload for success and allowed not-found branches.
 *
 * @param response Trello API response.
 * @param allowNotFound Whether 404 should return null.
 * @returns Response payload or null when 404 is allowed.
 */
function resolveResponseData<TData>(
    response: ITrelloApiResponse<TData>,
    allowNotFound: boolean,
): TData | null | undefined {
    if (response.status >= 200 && response.status < 300) {
        return response.data ?? null
    }

    if (allowNotFound && response.status === 404) {
        return null
    }

    return undefined
}

/**
 * Canonicalizes Trello API payload by unwrapping optional `data` envelope.
 *
 * @param payload Raw Trello payload.
 * @returns Canonical payload.
 */
function canonicalizePayload<TPayload extends Readonly<Record<string, unknown>>>(payload: TPayload): TPayload {
    const data = toRecord(payload["data"])
    if (data !== null) {
        return data as TPayload
    }

    return payload
}

/**
 * Resolves Trello card list identifier from card payload.
 *
 * @param payload Canonical card payload.
 * @returns List identifier when available.
 */
function readCardListIdentifier(payload: TrelloCardPayload): string | undefined {
    const list = toRecord(payload["list"])
    const listId = normalizeOptionalText(list?.["id"])
    if (listId !== undefined) {
        return listId
    }

    return normalizeOptionalText(payload["idList"] ?? payload["listId"])
}

/**
 * Merges Trello card payload with list details.
 *
 * @param cardPayload Canonical card payload.
 * @param listPayload Canonical list payload.
 * @returns Enriched card payload.
 */
function mergeCardWithList(
    cardPayload: TrelloCardPayload,
    listPayload: TrelloListPayload,
): TrelloCardPayload {
    const listName = normalizeOptionalText(listPayload["name"])

    return {
        ...cardPayload,
        list: listPayload,
        ...(listName !== undefined ? {listName} : {}),
    }
}

/**
 * Reads Trello error message from common response body shapes.
 *
 * @param payload Error payload candidate.
 * @returns Human-readable error message.
 */
function readErrorMessage(payload: unknown): string | undefined {
    const record = toRecord(payload)
    if (record === null) {
        return undefined
    }

    const directMessage = normalizeOptionalText(
        record["message"] ?? record["error"] ?? record["detail"],
    )
    if (directMessage !== undefined) {
        return directMessage
    }

    const firstError = toArray(record["errors"])[0]
    if (typeof firstError === "string") {
        return normalizeOptionalText(firstError)
    }

    return normalizeOptionalText(toRecord(firstError)?.["message"])
}

/**
 * Reads provider-specific error code from common Trello error shapes.
 *
 * @param payload Error payload candidate.
 * @returns Machine-readable error code.
 */
function readErrorCode(payload: unknown): string | undefined {
    const record = toRecord(payload)
    if (record === null) {
        return undefined
    }

    const directCode = normalizeOptionalText(record["code"])
    if (directCode !== undefined) {
        return directCode
    }

    return normalizeOptionalText(toRecord(toArray(record["errors"])[0])?.["code"])
}

/**
 * Builds absolute Trello request URL with query parameters.
 *
 * @param baseUrl Trello base URL.
 * @param path API path.
 * @param query Query parameters.
 * @returns Absolute request URL.
 */
function buildRequestUrl(
    baseUrl: string,
    path: string,
    query: Readonly<Record<string, string>>,
): string {
    const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`
    const url = new URL(path.replace(/^\//, ""), normalizedBaseUrl)

    for (const [key, value] of Object.entries(query)) {
        url.searchParams.set(key, value)
    }

    return url.toString()
}

/**
 * Normalizes retry attempts configuration.
 *
 * @param value Raw attempts value.
 * @returns Safe positive integer.
 */
function normalizeRetryMaxAttempts(value: number | undefined): number {
    if (typeof value !== "number" || Number.isInteger(value) === false || value < 1) {
        return DEFAULT_RETRY_MAX_ATTEMPTS
    }

    return value
}

/**
 * Normalizes configured Trello field lists.
 *
 * @param value Raw field list.
 * @param fallback Fallback field list.
 * @returns Deterministic non-empty list.
 */
function normalizeFieldList(
    value: readonly string[] | undefined,
    fallback: readonly string[],
): readonly string[] {
    if (value === undefined || value.length === 0) {
        return [
            ...fallback,
        ]
    }

    const normalized = value
        .map((entry) => {
            return entry.trim()
        })
        .filter((entry) => {
            return entry.length > 0
        })

    if (normalized.length === 0) {
        return [
            ...fallback,
        ]
    }

    return deduplicateTextList(normalized)
}

/**
 * Deduplicates text list while preserving order.
 *
 * @param items Candidate list.
 * @returns Deduplicated list.
 */
function deduplicateTextList(items: readonly string[]): readonly string[] {
    const deduplicated: string[] = []
    const seen = new Set<string>()

    for (const item of items) {
        if (seen.has(item)) {
            continue
        }

        seen.add(item)
        deduplicated.push(item)
    }

    return deduplicated
}

/**
 * Determines whether request should be retried for current attempt.
 *
 * @param error Normalized provider error.
 * @param attempt Current attempt number.
 * @param retryMaxAttempts Configured retry budget.
 * @returns True when request should be retried.
 */
function shouldRetryRequest(
    error: TrelloProviderError,
    attempt: number,
    retryMaxAttempts: number,
): boolean {
    return error.isRetryable && attempt < retryMaxAttempts
}

/**
 * Normalizes thrown request errors into TrelloProviderError.
 *
 * @param error Unknown thrown error.
 * @returns Normalized provider error.
 */
function normalizeRequestError(error: unknown): TrelloProviderError {
    if (error instanceof TrelloProviderError) {
        return error
    }

    if (error instanceof Error) {
        return new TrelloProviderError(error.message, {
            code: "NETWORK_ERROR",
            isRetryable: true,
        })
    }

    return new TrelloProviderError("Trello request failed", {
        code: "UNKNOWN_ERROR",
        isRetryable: true,
    })
}

/**
 * Resolves retry delay from provider error and current attempt number.
 *
 * @param error Normalized provider error.
 * @param attempt Current attempt number.
 * @returns Delay in milliseconds.
 */
function resolveRetryDelayMs(error: TrelloProviderError, attempt: number): number {
    if (
        typeof error.retryAfterMs === "number"
        && Number.isFinite(error.retryAfterMs)
        && error.retryAfterMs > 0
    ) {
        return error.retryAfterMs
    }

    return DEFAULT_RETRY_BASE_DELAY_MS * 2 ** Math.max(attempt - 1, 0)
}

/**
 * Parses retry-after header into milliseconds.
 *
 * @param headers Response headers.
 * @returns Retry delay in milliseconds.
 */
function readRetryAfterMs(headers: ITrelloResponseHeaders): number | undefined {
    const retryAfter = headers["retry-after"]
    if (retryAfter === undefined) {
        return undefined
    }

    const retryAfterSeconds = Number(retryAfter)
    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
        return retryAfterSeconds * 1000
    }

    const retryAt = new Date(retryAfter)
    if (Number.isNaN(retryAt.valueOf())) {
        return undefined
    }

    const delayMs = retryAt.getTime() - Date.now()
    return delayMs > 0 ? delayMs : undefined
}

/**
 * Normalizes optional string-like input.
 *
 * @param value Unknown candidate value.
 * @returns Trimmed text or undefined.
 */
function normalizeOptionalText(value: unknown): string | undefined {
    if (typeof value !== "string") {
        return undefined
    }

    const normalized = value.trim()
    return normalized.length > 0 ? normalized : undefined
}

/**
 * Converts unknown value to plain object record.
 *
 * @param value Candidate payload.
 * @returns Plain record or null.
 */
function toRecord(value: unknown): Readonly<Record<string, unknown>> | null {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return null
    }

    return value as Readonly<Record<string, unknown>>
}

/**
 * Converts unknown value to readonly array.
 *
 * @param value Candidate payload.
 * @returns Array or empty list.
 */
function toArray(value: unknown): readonly unknown[] {
    if (Array.isArray(value)) {
        return value
    }

    return []
}

/**
 * Default async sleep helper.
 *
 * @param delayMs Delay in milliseconds.
 * @returns Promise resolved after delay.
 */
function defaultSleep(delayMs: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, delayMs)
    })
}
