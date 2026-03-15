/**
 * Typed error codes for AST streaming metrics collector.
 */
export const AST_STREAMING_METRICS_COLLECTOR_ERROR_CODE = {
    INVALID_LOGGER: "INVALID_LOGGER",
    INVALID_LOG_EVERY_BATCHES: "INVALID_LOG_EVERY_BATCHES",
    INVALID_IDEMPOTENCY_CACHE_SIZE: "INVALID_IDEMPOTENCY_CACHE_SIZE",
    INVALID_MAX_ATTEMPTS: "INVALID_MAX_ATTEMPTS",
    INVALID_INITIAL_BACKOFF_MS: "INVALID_INITIAL_BACKOFF_MS",
    INVALID_MAX_BACKOFF_MS: "INVALID_MAX_BACKOFF_MS",
    INVALID_SLEEP: "INVALID_SLEEP",
    INVALID_NOW: "INVALID_NOW",
    INVALID_FILES_PROCESSED: "INVALID_FILES_PROCESSED",
    INVALID_BATCH_DURATION_MS: "INVALID_BATCH_DURATION_MS",
    LOGGING_FAILED: "LOGGING_FAILED",
} as const

/**
 * AST streaming metrics collector error code literal.
 */
export type AstStreamingMetricsCollectorErrorCode =
    (typeof AST_STREAMING_METRICS_COLLECTOR_ERROR_CODE)[keyof typeof AST_STREAMING_METRICS_COLLECTOR_ERROR_CODE]

/**
 * Structured metadata for AST streaming metrics collector failures.
 */
export interface IAstStreamingMetricsCollectorErrorDetails {
    /**
     * Invalid log frequency when available.
     */
    readonly logEveryBatches?: number

    /**
     * Invalid idempotency cache size when available.
     */
    readonly idempotencyCacheSize?: number

    /**
     * Invalid max retry attempts when available.
     */
    readonly maxAttempts?: number

    /**
     * Invalid initial backoff when available.
     */
    readonly initialBackoffMs?: number

    /**
     * Invalid max backoff when available.
     */
    readonly maxBackoffMs?: number

    /**
     * Invalid files processed value when available.
     */
    readonly filesProcessed?: number

    /**
     * Invalid batch duration value when available.
     */
    readonly batchDurationMs?: number

    /**
     * Number of attempts executed.
     */
    readonly attempts?: number

    /**
     * Stable failure reason when available.
     */
    readonly reason?: string
}

/**
 * Typed AST streaming metrics collector error with stable metadata.
 */
export class AstStreamingMetricsCollectorError extends Error {
    /**
     * Stable machine-readable error code.
     */
    public readonly code: AstStreamingMetricsCollectorErrorCode

    /**
     * Invalid log frequency when available.
     */
    public readonly logEveryBatches?: number

    /**
     * Invalid idempotency cache size when available.
     */
    public readonly idempotencyCacheSize?: number

    /**
     * Invalid max retry attempts when available.
     */
    public readonly maxAttempts?: number

    /**
     * Invalid initial backoff when available.
     */
    public readonly initialBackoffMs?: number

    /**
     * Invalid max backoff when available.
     */
    public readonly maxBackoffMs?: number

    /**
     * Invalid files processed value when available.
     */
    public readonly filesProcessed?: number

    /**
     * Invalid batch duration value when available.
     */
    public readonly batchDurationMs?: number

    /**
     * Number of attempts executed.
     */
    public readonly attempts?: number

    /**
     * Stable failure reason when available.
     */
    public readonly reason?: string

    /**
     * Creates typed AST streaming metrics collector error.
     *
     * @param code Stable machine-readable error code.
     * @param details Normalized error metadata.
     */
    public constructor(
        code: AstStreamingMetricsCollectorErrorCode,
        details: IAstStreamingMetricsCollectorErrorDetails = {},
    ) {
        super(createAstStreamingMetricsCollectorErrorMessage(code, details))

        this.name = "AstStreamingMetricsCollectorError"
        this.code = code
        this.logEveryBatches = details.logEveryBatches
        this.idempotencyCacheSize = details.idempotencyCacheSize
        this.maxAttempts = details.maxAttempts
        this.initialBackoffMs = details.initialBackoffMs
        this.maxBackoffMs = details.maxBackoffMs
        this.filesProcessed = details.filesProcessed
        this.batchDurationMs = details.batchDurationMs
        this.attempts = details.attempts
        this.reason = details.reason
    }
}

/**
 * Builds stable public message for AST streaming metrics collector failures.
 *
 * @param code Stable machine-readable error code.
 * @param details Normalized error metadata.
 * @returns Stable public message.
 */
function createAstStreamingMetricsCollectorErrorMessage(
    code: AstStreamingMetricsCollectorErrorCode,
    details: IAstStreamingMetricsCollectorErrorDetails,
): string {
    return AST_STREAMING_METRICS_COLLECTOR_ERROR_MESSAGES[code](details)
}

const AST_STREAMING_METRICS_COLLECTOR_ERROR_MESSAGES: Readonly<
    Record<
        AstStreamingMetricsCollectorErrorCode,
        (details: IAstStreamingMetricsCollectorErrorDetails) => string
    >
> = {
    INVALID_LOGGER: () => "Streaming metrics collector logger must implement ILogger contract",
    INVALID_LOG_EVERY_BATCHES: (details) =>
        `Invalid logEveryBatches for streaming metrics collector: ${
            details.logEveryBatches ?? Number.NaN
        }`,
    INVALID_IDEMPOTENCY_CACHE_SIZE: (details) =>
        `Invalid idempotencyCacheSize for streaming metrics collector: ${
            details.idempotencyCacheSize ?? Number.NaN
        }`,
    INVALID_MAX_ATTEMPTS: (details) =>
        `Invalid maxAttempts for streaming metrics collector: ${details.maxAttempts ?? Number.NaN}`,
    INVALID_INITIAL_BACKOFF_MS: (details) =>
        `Invalid initialBackoffMs for streaming metrics collector: ${
            details.initialBackoffMs ?? Number.NaN
        }`,
    INVALID_MAX_BACKOFF_MS: (details) =>
        `Invalid maxBackoffMs for streaming metrics collector: ${details.maxBackoffMs ?? Number.NaN}`,
    INVALID_SLEEP: () => "Streaming metrics collector sleep must be a function",
    INVALID_NOW: () => "Streaming metrics collector now must be a function",
    INVALID_FILES_PROCESSED: (details) =>
        `Invalid filesProcessed for streaming metrics collector: ${
            details.filesProcessed ?? Number.NaN
        }`,
    INVALID_BATCH_DURATION_MS: (details) =>
        `Invalid batchDurationMs for streaming metrics collector: ${
            details.batchDurationMs ?? Number.NaN
        }`,
    LOGGING_FAILED: (details) =>
        `Streaming metrics logging failed after ${details.attempts ?? Number.NaN} attempts: ${
            details.reason ?? "<unknown>"
        }`,
}
