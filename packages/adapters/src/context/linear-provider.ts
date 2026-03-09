import type {
    ExternalContextSource,
    IExternalContext,
    IExternalContextProvider,
    ILinearIssue,
    ILinearProvider,
} from "@codenautic/core"

import {LinearContextAcl, LinearIssueAcl} from "./acl"
import {LinearProviderError} from "./linear-provider.error"

const DEFAULT_LINEAR_API_URL = "https://api.linear.app/graphql"
const DEFAULT_RETRY_MAX_ATTEMPTS = 3
const DEFAULT_RETRY_BASE_DELAY_MS = 250
const DEFAULT_SEARCH_PAGE_SIZE = 25
const DEFAULT_SUB_ISSUE_PAGE_SIZE = 25
const RETRYABLE_LINEAR_CODES = new Set([
    "Ratelimited",
    "NetworkError",
    "InternalError",
    "Unknown",
    "LockTimeout",
    "BootstrapError",
])
const LINEAR_ISSUE_SELECTION = `
    id
    identifier
    title
    description
    priority
    priorityLabel
    updatedAt
    state {
        name
        type
    }
    cycle {
        id
        name
    }
    project {
        id
        name
        description
        state
        priority
        priorityLabel
    }
    children(first: ${String(DEFAULT_SUB_ISSUE_PAGE_SIZE)}) {
        nodes {
            id
            identifier
            title
            priority
            priorityLabel
            state {
                name
                type
            }
        }
    }
`
const LINEAR_ISSUE_QUERY = `
    query ContextLinearIssue($id: String!) {
        issue(id: $id) {
            ${LINEAR_ISSUE_SELECTION}
        }
    }
`
const LINEAR_SEARCH_QUERY = `
    query ContextLinearSearchIssues($term: String!, $first: Int!, $after: String) {
        searchIssues(term: $term, first: $first, after: $after) {
            nodes {
                ${LINEAR_ISSUE_SELECTION}
            }
            pageInfo {
                hasNextPage
                endCursor
            }
        }
    }
`
type LinearIssuePayload = Readonly<Record<string, unknown>>

/**
 * Response headers returned by Linear GraphQL client.
 */
export interface ILinearResponseHeaders {
    readonly [key: string]: string | undefined
}

/**
 * GraphQL error extensions returned by Linear API.
 */
export interface ILinearGraphqlErrorExtensions {
    /**
     * Machine-readable Linear error type.
     */
    readonly type?: string

    /**
     * Indicates whether the error is caused by user input.
     */
    readonly userError?: boolean

    /**
     * Human-readable message intended for users.
     */
    readonly userPresentableMessage?: string
}

/**
 * Minimal GraphQL error shape used by the provider.
 */
export interface ILinearGraphqlError {
    /**
     * Human-readable GraphQL error message.
     */
    readonly message?: string

    /**
     * GraphQL path that failed.
     */
    readonly path?: readonly string[]

    /**
     * Additional Linear-specific error metadata.
     */
    readonly extensions?: ILinearGraphqlErrorExtensions
}

/**
 * Generic Linear GraphQL response envelope.
 */
export interface ILinearApiResponse<TData> {
    /**
     * HTTP status code.
     */
    readonly status: number

    /**
     * Lower-cased HTTP headers.
     */
    readonly headers: ILinearResponseHeaders

    /**
     * Decoded GraphQL data payload when available.
     */
    readonly data?: TData

    /**
     * GraphQL errors returned by upstream.
     */
    readonly errors?: readonly ILinearGraphqlError[]
}

/**
 * Parameters for direct Linear issue fetch.
 */
export interface ILinearGetIssueRequest {
    /**
     * Linear issue identifier candidate.
     */
    readonly id: string
}

/**
 * Parameters for paginated Linear search.
 */
export interface ILinearSearchIssuesRequest {
    /**
     * Search term used by Linear search API.
     */
    readonly term: string

    /**
     * Page size for search results.
     */
    readonly first: number

    /**
     * Cursor for next page.
     */
    readonly after?: string
}

/**
 * Minimal Linear issue query response shape.
 */
export interface ILinearIssueQueryResponse {
    /**
     * Direct issue query result.
     */
    readonly issue?: unknown
}

/**
 * Minimal Linear search page-info shape.
 */
export interface ILinearSearchPageInfo {
    /**
     * Indicates whether more results are available.
     */
    readonly hasNextPage?: boolean

    /**
     * Cursor for the next page.
     */
    readonly endCursor?: string | null
}

/**
 * Minimal Linear search page shape.
 */
export interface ILinearSearchIssuesPage {
    /**
     * Search payload returned by Linear.
     */
    readonly searchIssues?: {
        readonly nodes?: readonly unknown[]
        readonly pageInfo?: ILinearSearchPageInfo
    }
}

/**
 * Minimal Linear client contract used by provider.
 */
export interface ILinearApiClient {
    /**
     * Loads a single issue by identifier candidate.
     *
     * @param request Issue request parameters.
     * @returns API response envelope.
     */
    getIssue(request: ILinearGetIssueRequest): Promise<ILinearApiResponse<ILinearIssueQueryResponse>>

    /**
     * Executes paginated issue search.
     *
     * @param request Search request parameters.
     * @returns API response envelope.
     */
    searchIssues(
        request: ILinearSearchIssuesRequest,
    ): Promise<ILinearApiResponse<ILinearSearchIssuesPage>>
}

/**
 * Linear provider constructor options.
 */
export interface ILinearProviderOptions {
    /**
     * Base Linear GraphQL URL.
     */
    readonly apiUrl?: string

    /**
     * Linear API key.
     */
    readonly apiKey?: string

    /**
     * Alternative OAuth access token.
     */
    readonly accessToken?: string

    /**
     * Optional injected Linear-compatible client for tests.
     */
    readonly client?: ILinearApiClient

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
     * Search page size used for identifier fallback lookup.
     */
    readonly searchPageSize?: number
}

/**
 * Linear implementation of shared external-context provider contracts.
 */
export class LinearProvider implements IExternalContextProvider, ILinearProvider {
    public readonly source: ExternalContextSource

    private readonly client: ILinearApiClient
    private readonly issueAcl: LinearIssueAcl
    private readonly contextAcl: LinearContextAcl
    private readonly retryMaxAttempts: number
    private readonly sleep: (delayMs: number) => Promise<void>
    private readonly searchPageSize: number

    /**
     * Creates Linear provider.
     *
     * @param options Provider options.
     */
    public constructor(options: ILinearProviderOptions) {
        this.source = "LINEAR"
        this.client = options.client ?? createLinearApiClient(options)
        this.issueAcl = new LinearIssueAcl()
        this.contextAcl = new LinearContextAcl()
        this.retryMaxAttempts = normalizeRetryMaxAttempts(options.retryMaxAttempts)
        this.sleep = options.sleep ?? defaultSleep
        this.searchPageSize = normalizeSearchPageSize(options.searchPageSize)
    }

    /**
     * Loads Linear issue by identifier or id.
     *
     * @param issueId Linear issue identifier.
     * @returns Normalized Linear issue or null when not found.
     */
    public async getIssue(issueId: string): Promise<ILinearIssue | null> {
        const payload = await this.resolveIssuePayload(issueId)
        if (payload === null) {
            return null
        }

        return this.issueAcl.toDomain(payload)
    }

    /**
     * Loads Linear context and normalizes it to shared external-context payload.
     *
     * @param identifier Linear issue identifier.
     * @returns Normalized external context or null when not found.
     */
    public async loadContext(identifier: string): Promise<IExternalContext | null> {
        const payload = await this.resolveIssuePayload(identifier)
        if (payload === null) {
            return null
        }

        return this.contextAcl.toDomain(payload)
    }

    /**
     * Resolves Linear issue payload using direct lookup first and paginated search as fallback.
     *
     * @param identifier Issue identifier candidate.
     * @returns Canonical Linear issue payload or null.
     */
    private async resolveIssuePayload(identifier: string): Promise<LinearIssuePayload | null> {
        const normalizedIdentifier = normalizeOptionalText(identifier)
        if (normalizedIdentifier === undefined) {
            return null
        }

        const directResponse = await this.executeRequest<ILinearIssueQueryResponse>(() => {
            return this.client.getIssue({
                id: normalizedIdentifier,
            })
        }, true)
        const directIssue = resolveDirectIssueResponse(directResponse)
        if (directIssue !== undefined) {
            return directIssue
        }

        return this.searchIssuePayload(normalizedIdentifier)
    }

    /**
     * Performs paginated Linear search to recover issue payload by identifier.
     *
     * @param identifier Identifier used to build fallback search term.
     * @returns Canonical issue payload or null.
     */
    private async searchIssuePayload(identifier: string): Promise<LinearIssuePayload | null> {
        let after: string | undefined

        while (true) {
            const response = await this.executeRequest<ILinearSearchIssuesPage>(() => {
                return this.client.searchIssues({
                    term: identifier,
                    first: this.searchPageSize,
                    ...(after !== undefined ? {after} : {}),
                })
            }, false)
            const searchIssues = resolveSearchResponse(response)
            const nodes = toArray(searchIssues?.nodes)

            for (const node of nodes) {
                const issue = toRecord(node)
                if (issue === null) {
                    continue
                }

                if (matchesLinearIdentifier(issue, identifier)) {
                    return issue
                }
            }

            const nextCursor = resolveNextSearchCursor(searchIssues?.pageInfo)
            if (nextCursor === undefined) {
                return null
            }

            after = nextCursor
        }
    }

    /**
     * Executes Linear GraphQL request with retry handling for retryable failures.
     *
     * @param operation Deferred client request.
     * @param allowNotFound Whether 404 should be returned to caller for fallback handling.
     * @returns API response envelope.
     */
    private async executeRequest<TData>(
        operation: () => Promise<ILinearApiResponse<TData>>,
        allowNotFound: boolean,
    ): Promise<ILinearApiResponse<TData>> {
        for (let attempt = 1; attempt <= this.retryMaxAttempts; attempt += 1) {
            try {
                const response = await operation()
                if (
                    (response.status >= 200 && response.status < 300)
                    || (allowNotFound && response.status === 404)
                ) {
                    return response
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

        throw new LinearProviderError("Linear request failed after exhausting retries", {
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
    private async retryIfNeeded(error: LinearProviderError, attempt: number): Promise<boolean> {
        if (shouldRetryRequest(error, attempt, this.retryMaxAttempts) === false) {
            return false
        }

        await this.sleep(resolveRetryDelayMs(error, attempt))
        return true
    }
}

/**
 * Internal raw GraphQL response shape.
 */
interface ILinearRawGraphqlResponse<TData> {
    readonly data?: TData
    readonly errors?: readonly ILinearGraphqlError[]
}

/**
 * Internal options for fetch-backed Linear client.
 */
interface ILinearGraphqlApiClientOptions {
    readonly apiUrl: string
    readonly authorizationHeader: string
    readonly fetchImplementation: typeof fetch
}

/**
 * Fetch-backed Linear GraphQL client.
 */
class LinearGraphqlApiClient implements ILinearApiClient {
    private readonly apiUrl: string
    private readonly authorizationHeader: string
    private readonly fetchImplementation: typeof fetch

    /**
     * Creates fetch-backed Linear client.
     *
     * @param options Client options.
     */
    public constructor(options: ILinearGraphqlApiClientOptions) {
        this.apiUrl = options.apiUrl
        this.authorizationHeader = options.authorizationHeader
        this.fetchImplementation = options.fetchImplementation
    }

    /**
     * Loads Linear issue via GraphQL API.
     *
     * @param request Issue request parameters.
     * @returns API response envelope.
     */
    public getIssue(
        request: ILinearGetIssueRequest,
    ): Promise<ILinearApiResponse<ILinearIssueQueryResponse>> {
        return this.requestGraphql<ILinearIssueQueryResponse>(LINEAR_ISSUE_QUERY, {
            id: request.id,
        })
    }

    /**
     * Executes Linear issue search via GraphQL API.
     *
     * @param request Search request parameters.
     * @returns API response envelope.
     */
    public searchIssues(
        request: ILinearSearchIssuesRequest,
    ): Promise<ILinearApiResponse<ILinearSearchIssuesPage>> {
        return this.requestGraphql<ILinearSearchIssuesPage>(LINEAR_SEARCH_QUERY, {
            term: request.term,
            first: request.first,
            ...(request.after !== undefined ? {after: request.after} : {}),
        })
    }

    /**
     * Executes GraphQL request against Linear API.
     *
     * @param query GraphQL document.
     * @param variables GraphQL variables.
     * @returns Response envelope with decoded body.
     */
    private async requestGraphql<TData>(
        query: string,
        variables: Readonly<Record<string, unknown>>,
    ): Promise<ILinearApiResponse<TData>> {
        const response = await this.fetchImplementation(this.apiUrl, {
            method: "POST",
            headers: {
                Accept: "application/json",
                Authorization: this.authorizationHeader,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                query,
                variables,
            }),
        })
        const body = await readJsonResponse<ILinearRawGraphqlResponse<TData>>(response)

        return {
            status: response.status,
            headers: readHeaders(response.headers),
            data: body?.data,
            errors: body?.errors,
        }
    }
}

/**
 * Creates fetch-backed Linear API client from provider options.
 *
 * @param options Provider options.
 * @returns Linear API client.
 */
function createLinearApiClient(options: ILinearProviderOptions): ILinearApiClient {
    const apiUrl = normalizeOptionalText(options.apiUrl) ?? DEFAULT_LINEAR_API_URL

    return new LinearGraphqlApiClient({
        apiUrl,
        authorizationHeader: createAuthorizationHeader(options),
        fetchImplementation: options.fetchImplementation ?? fetch,
    })
}

/**
 * Builds Linear authorization header from supported auth strategies.
 *
 * @param options Provider options.
 * @returns HTTP authorization header value.
 */
function createAuthorizationHeader(options: ILinearProviderOptions): string {
    const accessToken = normalizeOptionalText(options.accessToken)
    if (accessToken !== undefined) {
        return accessToken.startsWith("Bearer ") ? accessToken : `Bearer ${accessToken}`
    }

    const apiKey = normalizeOptionalText(options.apiKey)
    if (apiKey !== undefined) {
        return apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`
    }

    throw new LinearProviderError("Linear apiKey or accessToken is required when no client is provided", {
        code: "CONFIGURATION",
        isRetryable: false,
    })
}

/**
 * Resolves direct issue response into payload, null sentinel, or failure marker.
 *
 * @param response Direct issue response.
 * @returns Payload when found, null when definitively not found, undefined when search fallback should run.
 */
function resolveDirectIssueResponse(
    response: ILinearApiResponse<ILinearIssueQueryResponse>,
): LinearIssuePayload | null | undefined {
    const issue = toRecord(response.data?.issue)
    if (issue !== null) {
        return issue
    }

    if (response.data?.issue === null && hasGraphqlErrors(response) === false) {
        return undefined
    }

    if (isNotFoundResponse(response)) {
        return undefined
    }

    if (hasGraphqlErrors(response)) {
        throw createGraphqlError(response)
    }

    return undefined
}

/**
 * Resolves search response into payload or throws normalized GraphQL failure.
 *
 * @param response Search response.
 * @returns Search payload when available.
 */
function resolveSearchResponse(
    response: ILinearApiResponse<ILinearSearchIssuesPage>,
): ILinearSearchIssuesPage["searchIssues"] | null {
    const searchIssues = toRecord(response.data?.searchIssues)
    if (searchIssues !== null) {
        const pageInfo = normalizeSearchPageInfo(toRecord(searchIssues["pageInfo"]))

        return {
            nodes: toArray(searchIssues["nodes"]),
            ...(pageInfo !== undefined ? {pageInfo} : {}),
        }
    }

    if (hasGraphqlErrors(response)) {
        throw createGraphqlError(response)
    }

    return null
}

/**
 * Creates normalized Linear provider error from non-success HTTP response.
 *
 * @param response Linear API response.
 * @returns Normalized Linear provider error.
 */
function createResponseError(response: ILinearApiResponse<unknown>): LinearProviderError {
    const statusCode = response.status
    const retryAfterMs = readRetryAfterMs(response.headers)
    const code = readGraphqlErrorCode(response.errors) ?? `HTTP_${String(statusCode)}`
    const message =
        readGraphqlErrorMessage(response.errors)
        ?? `Linear request failed with status ${String(statusCode)}`

    return new LinearProviderError(message, {
        statusCode,
        code,
        retryAfterMs,
        isRetryable: statusCode === 429 || statusCode >= 500 || RETRYABLE_LINEAR_CODES.has(code),
        graphqlPaths: collectGraphqlPaths(response.errors),
        hasPartialData: response.data !== undefined,
    })
}

/**
 * Creates normalized Linear provider error from GraphQL errors with unusable data.
 *
 * @param response Linear API response.
 * @returns Normalized Linear provider error.
 */
function createGraphqlError(response: ILinearApiResponse<unknown>): LinearProviderError {
    const code = readGraphqlErrorCode(response.errors) ?? "GraphqlError"
    const message = readGraphqlErrorMessage(response.errors) ?? "Linear GraphQL request failed"

    return new LinearProviderError(message, {
        statusCode: response.status,
        code,
        retryAfterMs: readRetryAfterMs(response.headers),
        isRetryable: response.status === 429 || RETRYABLE_LINEAR_CODES.has(code),
        graphqlPaths: collectGraphqlPaths(response.errors),
        hasPartialData: response.data !== undefined,
    })
}

/**
 * Normalizes thrown request errors into LinearProviderError.
 *
 * @param error Unknown thrown error.
 * @returns Normalized provider error.
 */
function normalizeRequestError(error: unknown): LinearProviderError {
    if (error instanceof LinearProviderError) {
        return error
    }

    if (error instanceof Error) {
        return new LinearProviderError(error.message, {
            code: "NETWORK_ERROR",
            isRetryable: true,
        })
    }

    return new LinearProviderError("Linear request failed", {
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
function resolveRetryDelayMs(error: LinearProviderError, attempt: number): number {
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
 * Determines whether request should be retried.
 *
 * @param error Normalized provider error.
 * @param attempt Current attempt number.
 * @param retryMaxAttempts Maximum retry attempts.
 * @returns True when request should be retried.
 */
function shouldRetryRequest(
    error: LinearProviderError,
    attempt: number,
    retryMaxAttempts: number,
): boolean {
    return error.isRetryable && attempt < retryMaxAttempts
}

/**
 * Resolves next search cursor from page-info payload.
 *
 * @param pageInfo Search page-info payload.
 * @returns Next cursor or undefined when pagination is exhausted.
 */
function resolveNextSearchCursor(pageInfo: ILinearSearchPageInfo | undefined): string | undefined {
    if (pageInfo?.hasNextPage !== true) {
        return undefined
    }

    return normalizeOptionalText(pageInfo.endCursor)
}

/**
 * Normalizes raw page-info record to typed search-page-info payload.
 *
 * @param pageInfo Raw page-info record.
 * @returns Normalized page-info when available.
 */
function normalizeSearchPageInfo(
    pageInfo: Readonly<Record<string, unknown>> | null,
): ILinearSearchPageInfo | undefined {
    if (pageInfo === null) {
        return undefined
    }

    const hasNextPage = pageInfo["hasNextPage"] === true
    const endCursor = normalizeOptionalText(pageInfo["endCursor"])

    return {
        hasNextPage,
        ...(endCursor !== undefined ? {endCursor} : {}),
    }
}

/**
 * Reads GraphQL error message from normalized error array.
 *
 * @param errors GraphQL errors.
 * @returns Human-readable message.
 */
function readGraphqlErrorMessage(errors: readonly ILinearGraphqlError[] | undefined): string | undefined {
    const messages = (errors ?? [])
        .map((error) => {
            return normalizeOptionalText(
                error.extensions?.userPresentableMessage ?? error.message,
            )
        })
        .filter((message): message is string => {
            return message !== undefined
        })

    return messages.length > 0 ? messages.join("; ") : undefined
}

/**
 * Reads GraphQL error code from normalized error array.
 *
 * @param errors GraphQL errors.
 * @returns Machine-readable error code.
 */
function readGraphqlErrorCode(errors: readonly ILinearGraphqlError[] | undefined): string | undefined {
    for (const error of errors ?? []) {
        const code = normalizeOptionalText(error.extensions?.type)
        if (code !== undefined) {
            return code
        }
    }

    return undefined
}

/**
 * Collects GraphQL error paths into stable string representation.
 *
 * @param errors GraphQL errors.
 * @returns GraphQL path list.
 */
function collectGraphqlPaths(errors: readonly ILinearGraphqlError[] | undefined): readonly string[] | undefined {
    const paths = (errors ?? [])
        .map((error) => {
            const segments = error.path ?? []
            return segments.length > 0 ? segments.join(".") : undefined
        })
        .filter((path): path is string => {
            return path !== undefined
        })

    return paths.length > 0 ? paths : undefined
}

/**
 * Parses retry-after header into milliseconds.
 *
 * @param headers Response headers.
 * @returns Retry delay in milliseconds.
 */
function readRetryAfterMs(headers: ILinearResponseHeaders): number | undefined {
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
 * Determines whether response contains GraphQL errors.
 *
 * @param response API response envelope.
 * @returns True when errors are present.
 */
function hasGraphqlErrors(response: ILinearApiResponse<unknown>): boolean {
    return Array.isArray(response.errors) && response.errors.length > 0
}

/**
 * Determines whether response represents a not-found branch.
 *
 * @param response API response envelope.
 * @returns True when issue should be treated as missing.
 */
function isNotFoundResponse(response: ILinearApiResponse<unknown>): boolean {
    if (response.status === 404) {
        return true
    }

    return (response.errors ?? []).some((error) => {
        const message = (
            error.extensions?.userPresentableMessage
            ?? error.message
            ?? ""
        ).toLowerCase()

        return message.includes("not found")
    })
}

/**
 * Matches candidate Linear issue payload against requested identifier.
 *
 * @param issue Candidate issue payload.
 * @param identifier Requested identifier.
 * @returns True when payload matches identifier.
 */
function matchesLinearIdentifier(
    issue: Readonly<Record<string, unknown>>,
    identifier: string,
): boolean {
    const normalizedIdentifier = identifier.trim().toLowerCase()
    const candidates = [
        readIdentifier(issue, ["identifier", "id", "issueId"]),
        normalizeOptionalText(issue["identifier"]),
        normalizeOptionalText(issue["id"]),
    ].filter((candidate): candidate is string => {
        return candidate !== undefined && candidate.length > 0
    })

    return candidates.some((candidate) => {
        return candidate.toLowerCase() === normalizedIdentifier
    })
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
function readHeaders(headers: Headers): ILinearResponseHeaders {
    const collected: Record<string, string | undefined> = {}

    headers.forEach((value, key) => {
        collected[key.toLowerCase()] = value
    })

    return collected
}

/**
 * Converts unknown to plain object record.
 *
 * @param value Candidate value.
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
 * @param value Candidate value.
 * @returns Array or empty list.
 */
function toArray(value: unknown): readonly unknown[] {
    return Array.isArray(value) ? value : []
}

/**
 * Reads identifier value by candidate keys.
 *
 * @param source Source record.
 * @param keys Candidate keys.
 * @param fallback Fallback value.
 * @returns Normalized identifier.
 */
function readIdentifier(
    source: Readonly<Record<string, unknown>> | null,
    keys: readonly string[],
    fallback = "",
): string {
    for (const key of keys) {
        const value = source?.[key]

        if (typeof value === "string") {
            const normalized = value.trim()
            if (normalized.length > 0) {
                return normalized
            }
        }

        if (typeof value === "number" && Number.isFinite(value)) {
            return String(value)
        }
    }

    return fallback
}

/**
 * Normalizes optional text values to non-empty strings.
 *
 * @param value Candidate value.
 * @returns Normalized non-empty string or undefined.
 */
function normalizeOptionalText(value: unknown): string | undefined {
    if (typeof value !== "string") {
        return undefined
    }

    const normalized = value.trim()
    return normalized.length > 0 ? normalized : undefined
}

/**
 * Normalizes retry-attempt configuration.
 *
 * @param value Retry-attempt candidate.
 * @returns Normalized retry attempts.
 */
function normalizeRetryMaxAttempts(value: number | undefined): number {
    if (typeof value !== "number" || Number.isFinite(value) === false) {
        return DEFAULT_RETRY_MAX_ATTEMPTS
    }

    return Math.max(1, Math.trunc(value))
}

/**
 * Normalizes search-page-size configuration.
 *
 * @param value Search page-size candidate.
 * @returns Normalized search page size.
 */
function normalizeSearchPageSize(value: number | undefined): number {
    if (typeof value !== "number" || Number.isFinite(value) === false) {
        return DEFAULT_SEARCH_PAGE_SIZE
    }

    return Math.max(1, Math.trunc(value))
}

/**
 * Sleeps for requested delay.
 *
 * @param delayMs Delay in milliseconds.
 * @returns Promise resolved after timeout.
 */
function defaultSleep(delayMs: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, delayMs)
    })
}
