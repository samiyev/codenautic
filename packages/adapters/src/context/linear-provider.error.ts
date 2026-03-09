/**
 * Normalized error metadata exposed by Linear provider.
 */
export interface ILinearProviderErrorDetails {
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

    /**
     * GraphQL error paths associated with the failure.
     */
    readonly graphqlPaths?: readonly string[]

    /**
     * Indicates whether upstream returned partial data.
     */
    readonly hasPartialData?: boolean
}

/**
 * Error thrown by Linear provider after request normalization and retry evaluation.
 */
export class LinearProviderError extends Error {
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
     * GraphQL error paths associated with the failure.
     */
    public readonly graphqlPaths?: readonly string[]

    /**
     * Indicates whether upstream returned partial data.
     */
    public readonly hasPartialData?: boolean

    /**
     * Creates Linear provider error.
     *
     * @param message Human-readable error message.
     * @param details Normalized error details.
     */
    public constructor(message: string, details: ILinearProviderErrorDetails) {
        super(message)
        this.name = "LinearProviderError"
        this.statusCode = details.statusCode
        this.code = details.code
        this.retryAfterMs = details.retryAfterMs
        this.isRetryable = details.isRetryable
        this.graphqlPaths = details.graphqlPaths
        this.hasPartialData = details.hasPartialData
    }
}
