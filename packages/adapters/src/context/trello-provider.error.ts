/**
 * Normalized error metadata exposed by Trello provider.
 */
export interface ITrelloProviderErrorDetails {
    /**
     * HTTP status code when available.
     */
    readonly statusCode?: number

    /**
     * Provider-specific machine-readable error code.
     */
    readonly code?: string

    /**
     * Suggested retry delay in milliseconds.
     */
    readonly retryAfterMs?: number

    /**
     * Indicates whether request is retryable.
     */
    readonly isRetryable: boolean
}

/**
 * Error thrown by Trello provider after request normalization and retry evaluation.
 */
export class TrelloProviderError extends Error {
    /**
     * HTTP status code when available.
     */
    public readonly statusCode?: number

    /**
     * Provider-specific machine-readable error code.
     */
    public readonly code?: string

    /**
     * Suggested retry delay in milliseconds.
     */
    public readonly retryAfterMs?: number

    /**
     * Indicates whether request is retryable.
     */
    public readonly isRetryable: boolean

    /**
     * Creates Trello provider error.
     *
     * @param message Human-readable error message.
     * @param details Normalized error details.
     */
    public constructor(message: string, details: ITrelloProviderErrorDetails) {
        super(message)
        this.name = "TrelloProviderError"
        this.statusCode = details.statusCode
        this.code = details.code
        this.retryAfterMs = details.retryAfterMs
        this.isRetryable = details.isRetryable
    }
}
