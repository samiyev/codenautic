/**
 * Typed error codes for AST memory pressure manager.
 */
export const AST_MEMORY_PRESSURE_MANAGER_ERROR_CODE = {
    INVALID_PAUSE_THRESHOLD_PERCENT: "INVALID_PAUSE_THRESHOLD_PERCENT",
    INVALID_RESUME_THRESHOLD_PERCENT: "INVALID_RESUME_THRESHOLD_PERCENT",
    INVALID_USED_BYTES: "INVALID_USED_BYTES",
    INVALID_TOTAL_BYTES: "INVALID_TOTAL_BYTES",
    INVALID_MAX_ATTEMPTS: "INVALID_MAX_ATTEMPTS",
    INVALID_INITIAL_BACKOFF_MS: "INVALID_INITIAL_BACKOFF_MS",
    INVALID_MAX_BACKOFF_MS: "INVALID_MAX_BACKOFF_MS",
    INVALID_SNAPSHOT_PROVIDER: "INVALID_SNAPSHOT_PROVIDER",
    SNAPSHOT_PROVIDER_FAILED: "SNAPSHOT_PROVIDER_FAILED",
} as const

/**
 * AST memory pressure manager error code literal.
 */
export type AstMemoryPressureManagerErrorCode =
    (typeof AST_MEMORY_PRESSURE_MANAGER_ERROR_CODE)[keyof typeof AST_MEMORY_PRESSURE_MANAGER_ERROR_CODE]

/**
 * Structured metadata for AST memory pressure manager failures.
 */
export interface IAstMemoryPressureManagerErrorDetails {
    /**
     * Invalid pause threshold percent when available.
     */
    readonly pauseThresholdPercent?: number

    /**
     * Invalid resume threshold percent when available.
     */
    readonly resumeThresholdPercent?: number

    /**
     * Invalid used bytes value when available.
     */
    readonly usedBytes?: number

    /**
     * Invalid total bytes value when available.
     */
    readonly totalBytes?: number

    /**
     * Invalid max attempts value when available.
     */
    readonly maxAttempts?: number

    /**
     * Invalid initial backoff value when available.
     */
    readonly initialBackoffMs?: number

    /**
     * Invalid max backoff value when available.
     */
    readonly maxBackoffMs?: number

    /**
     * Number of attempts performed for provider call.
     */
    readonly attempts?: number

    /**
     * Failure reason when available.
     */
    readonly reason?: string
}

/**
 * Typed AST memory pressure manager error with stable metadata.
 */
export class AstMemoryPressureManagerError extends Error {
    /**
     * Stable machine-readable error code.
     */
    public readonly code: AstMemoryPressureManagerErrorCode

    /**
     * Invalid pause threshold percent when available.
     */
    public readonly pauseThresholdPercent?: number

    /**
     * Invalid resume threshold percent when available.
     */
    public readonly resumeThresholdPercent?: number

    /**
     * Invalid used bytes value when available.
     */
    public readonly usedBytes?: number

    /**
     * Invalid total bytes value when available.
     */
    public readonly totalBytes?: number

    /**
     * Invalid max attempts value when available.
     */
    public readonly maxAttempts?: number

    /**
     * Invalid initial backoff value when available.
     */
    public readonly initialBackoffMs?: number

    /**
     * Invalid max backoff value when available.
     */
    public readonly maxBackoffMs?: number

    /**
     * Number of attempts performed for provider call.
     */
    public readonly attempts?: number

    /**
     * Failure reason when available.
     */
    public readonly reason?: string

    /**
     * Creates typed AST memory pressure manager error.
     *
     * @param code Stable machine-readable error code.
     * @param details Normalized error metadata.
     */
    public constructor(
        code: AstMemoryPressureManagerErrorCode,
        details: IAstMemoryPressureManagerErrorDetails = {},
    ) {
        super(createAstMemoryPressureManagerErrorMessage(code, details))

        this.name = "AstMemoryPressureManagerError"
        this.code = code
        this.pauseThresholdPercent = details.pauseThresholdPercent
        this.resumeThresholdPercent = details.resumeThresholdPercent
        this.usedBytes = details.usedBytes
        this.totalBytes = details.totalBytes
        this.maxAttempts = details.maxAttempts
        this.initialBackoffMs = details.initialBackoffMs
        this.maxBackoffMs = details.maxBackoffMs
        this.attempts = details.attempts
        this.reason = details.reason
    }
}

/**
 * Builds stable public message for AST memory pressure manager failures.
 *
 * @param code Stable machine-readable error code.
 * @param details Normalized error metadata.
 * @returns Stable public message.
 */
function createAstMemoryPressureManagerErrorMessage(
    code: AstMemoryPressureManagerErrorCode,
    details: IAstMemoryPressureManagerErrorDetails,
): string {
    return AST_MEMORY_PRESSURE_MANAGER_ERROR_MESSAGES[code](details)
}

const AST_MEMORY_PRESSURE_MANAGER_ERROR_MESSAGES: Readonly<
    Record<AstMemoryPressureManagerErrorCode, (details: IAstMemoryPressureManagerErrorDetails) => string>
> = {
    INVALID_PAUSE_THRESHOLD_PERCENT: (details) =>
        `Invalid pauseThresholdPercent for memory pressure manager: ${
            details.pauseThresholdPercent ?? Number.NaN
        }`,
    INVALID_RESUME_THRESHOLD_PERCENT: (details) =>
        `Invalid resumeThresholdPercent for memory pressure manager: ${
            details.resumeThresholdPercent ?? Number.NaN
        }`,
    INVALID_USED_BYTES: (details) =>
        `Invalid usedBytes for memory pressure manager: ${details.usedBytes ?? Number.NaN}`,
    INVALID_TOTAL_BYTES: (details) =>
        `Invalid totalBytes for memory pressure manager: ${details.totalBytes ?? Number.NaN}`,
    INVALID_MAX_ATTEMPTS: (details) =>
        `Invalid maxAttempts for memory pressure manager: ${details.maxAttempts ?? Number.NaN}`,
    INVALID_INITIAL_BACKOFF_MS: (details) =>
        `Invalid initialBackoffMs for memory pressure manager: ${
            details.initialBackoffMs ?? Number.NaN
        }`,
    INVALID_MAX_BACKOFF_MS: (details) =>
        `Invalid maxBackoffMs for memory pressure manager: ${details.maxBackoffMs ?? Number.NaN}`,
    INVALID_SNAPSHOT_PROVIDER: () =>
        "Memory pressure manager snapshotProvider must be a function when provided",
    SNAPSHOT_PROVIDER_FAILED: (details) =>
        `Memory pressure snapshot provider failed after ${details.attempts ?? Number.NaN} attempts: ${
            details.reason ?? "<unknown>"
        }`,
}
