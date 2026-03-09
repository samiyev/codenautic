/**
 * Machine-readable Slack provider error codes.
 */
export const SLACK_PROVIDER_ERROR_CODE = {
    CONFIGURATION: "CONFIGURATION",
    INVALID_PAYLOAD: "INVALID_PAYLOAD",
    INVALID_EVENT: "INVALID_EVENT",
    AUTHENTICATION: "AUTHENTICATION",
    PERMISSION_DENIED: "PERMISSION_DENIED",
    NOT_FOUND: "NOT_FOUND",
    RATE_LIMITED: "RATE_LIMITED",
    UPSTREAM_UNAVAILABLE: "UPSTREAM_UNAVAILABLE",
    REQUEST_FAILED: "REQUEST_FAILED",
} as const

/**
 * Slack provider error code.
 */
export type SlackProviderErrorCode =
    (typeof SLACK_PROVIDER_ERROR_CODE)[keyof typeof SLACK_PROVIDER_ERROR_CODE]

/**
 * Normalized error metadata exposed by Slack provider.
 */
export interface ISlackProviderErrorDetails {
    /**
     * Machine-readable error code.
     */
    readonly code: SlackProviderErrorCode

    /**
     * Indicates whether request may be retried safely.
     */
    readonly isRetryable: boolean

    /**
     * HTTP status code when available.
     */
    readonly statusCode?: number

    /**
     * Suggested retry delay in milliseconds.
     */
    readonly retryAfterMs?: number

    /**
     * Delivery deduplication key associated with the failure.
     */
    readonly dedupeKey?: string
}

/**
 * Error thrown by Slack provider after normalization and retry evaluation.
 */
export class SlackProviderError extends Error {
    /**
     * Machine-readable error code.
     */
    public readonly code: SlackProviderErrorCode

    /**
     * Indicates whether request may be retried safely.
     */
    public readonly isRetryable: boolean

    /**
     * HTTP status code when available.
     */
    public readonly statusCode?: number

    /**
     * Suggested retry delay in milliseconds.
     */
    public readonly retryAfterMs?: number

    /**
     * Delivery deduplication key associated with the failure.
     */
    public readonly dedupeKey?: string

    /**
     * Creates Slack provider error.
     *
     * @param message Human-readable message.
     * @param details Normalized error details.
     */
    public constructor(message: string, details: ISlackProviderErrorDetails) {
        super(message)
        this.name = "SlackProviderError"
        this.code = details.code
        this.isRetryable = details.isRetryable
        this.statusCode = details.statusCode
        this.retryAfterMs = details.retryAfterMs
        this.dedupeKey = details.dedupeKey
    }
}
