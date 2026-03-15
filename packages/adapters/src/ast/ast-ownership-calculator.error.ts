/**
 * Typed error codes for AST ownership calculator.
 */
export const AST_OWNERSHIP_CALCULATOR_ERROR_CODE = {
    BLAME_FETCH_FAILED: "BLAME_FETCH_FAILED",
    DUPLICATE_BLAME_FILE_PATH: "DUPLICATE_BLAME_FILE_PATH",
    DUPLICATE_FILE_PATH: "DUPLICATE_FILE_PATH",
    EMPTY_FILE_PATHS: "EMPTY_FILE_PATHS",
    INVALID_BLAME_BATCH_PAYLOAD: "INVALID_BLAME_BATCH_PAYLOAD",
    INVALID_BLAME_ENTRY: "INVALID_BLAME_ENTRY",
    INVALID_BLAME_FILE_PATH: "INVALID_BLAME_FILE_PATH",
    INVALID_CACHE_TTL_MS: "INVALID_CACHE_TTL_MS",
    INVALID_FETCH_BLAME_BATCH: "INVALID_FETCH_BLAME_BATCH",
    INVALID_FILE_PATH: "INVALID_FILE_PATH",
    INVALID_MAX_FETCH_ATTEMPTS: "INVALID_MAX_FETCH_ATTEMPTS",
    INVALID_PRIMARY_THRESHOLD: "INVALID_PRIMARY_THRESHOLD",
    INVALID_REF: "INVALID_REF",
    INVALID_RETRY_BACKOFF_MS: "INVALID_RETRY_BACKOFF_MS",
    INVALID_SECONDARY_THRESHOLD: "INVALID_SECONDARY_THRESHOLD",
    INVALID_SLEEP: "INVALID_SLEEP",
    INVALID_THRESHOLD_RELATION: "INVALID_THRESHOLD_RELATION",
    RETRY_EXHAUSTED: "RETRY_EXHAUSTED",
} as const

/**
 * AST ownership calculator error code literal.
 */
export type AstOwnershipCalculatorErrorCode =
    (typeof AST_OWNERSHIP_CALCULATOR_ERROR_CODE)[keyof typeof AST_OWNERSHIP_CALCULATOR_ERROR_CODE]

/**
 * Structured metadata for AST ownership calculator failures.
 */
export interface IAstOwnershipCalculatorErrorDetails {
    /**
     * Repository-relative file path when available.
     */
    readonly filePath?: string

    /**
     * Git ref when available.
     */
    readonly ref?: string

    /**
     * Retry attempt number when available.
     */
    readonly attempt?: number

    /**
     * Maximum retry attempts when available.
     */
    readonly maxFetchAttempts?: number

    /**
     * Primary ownership threshold when available.
     */
    readonly primaryThreshold?: number

    /**
     * Secondary ownership threshold when available.
     */
    readonly secondaryThreshold?: number

    /**
     * Retry backoff in milliseconds when available.
     */
    readonly retryBackoffMs?: number

    /**
     * Cache TTL in milliseconds when available.
     */
    readonly cacheTtlMs?: number

    /**
     * Underlying error message when available.
     */
    readonly causeMessage?: string
}

/**
 * Typed AST ownership calculator error with stable metadata.
 */
export class AstOwnershipCalculatorError extends Error {
    /**
     * Stable machine-readable error code.
     */
    public readonly code: AstOwnershipCalculatorErrorCode

    /**
     * Repository-relative file path when available.
     */
    public readonly filePath?: string

    /**
     * Git ref when available.
     */
    public readonly ref?: string

    /**
     * Retry attempt number when available.
     */
    public readonly attempt?: number

    /**
     * Maximum retry attempts when available.
     */
    public readonly maxFetchAttempts?: number

    /**
     * Primary ownership threshold when available.
     */
    public readonly primaryThreshold?: number

    /**
     * Secondary ownership threshold when available.
     */
    public readonly secondaryThreshold?: number

    /**
     * Retry backoff in milliseconds when available.
     */
    public readonly retryBackoffMs?: number

    /**
     * Cache TTL in milliseconds when available.
     */
    public readonly cacheTtlMs?: number

    /**
     * Underlying error message when available.
     */
    public readonly causeMessage?: string

    /**
     * Creates typed AST ownership calculator error.
     *
     * @param code Stable machine-readable error code.
     * @param details Structured error metadata.
     */
    public constructor(
        code: AstOwnershipCalculatorErrorCode,
        details: IAstOwnershipCalculatorErrorDetails = {},
    ) {
        super(createAstOwnershipCalculatorErrorMessage(code, details))

        this.name = "AstOwnershipCalculatorError"
        this.code = code
        this.filePath = details.filePath
        this.ref = details.ref
        this.attempt = details.attempt
        this.maxFetchAttempts = details.maxFetchAttempts
        this.primaryThreshold = details.primaryThreshold
        this.secondaryThreshold = details.secondaryThreshold
        this.retryBackoffMs = details.retryBackoffMs
        this.cacheTtlMs = details.cacheTtlMs
        this.causeMessage = details.causeMessage
    }
}

/**
 * Builds stable public message for AST ownership calculator failures.
 *
 * @param code Stable machine-readable error code.
 * @param details Structured error metadata.
 * @returns Stable public message.
 */
function createAstOwnershipCalculatorErrorMessage(
    code: AstOwnershipCalculatorErrorCode,
    details: IAstOwnershipCalculatorErrorDetails,
): string {
    return AST_OWNERSHIP_CALCULATOR_ERROR_MESSAGES[code](details)
}

const AST_OWNERSHIP_CALCULATOR_ERROR_MESSAGES: Readonly<
    Record<AstOwnershipCalculatorErrorCode, (details: IAstOwnershipCalculatorErrorDetails) => string>
> = {
    BLAME_FETCH_FAILED: (details) =>
        `Failed to fetch blame data for ref ${details.ref ?? "<unknown>"}: ${
            details.causeMessage ?? "<unknown>"
        }`,
    DUPLICATE_BLAME_FILE_PATH: (details) =>
        `Duplicate blame payload file path: ${details.filePath ?? "<empty>"}`,
    DUPLICATE_FILE_PATH: (details) =>
        `Duplicate ownership input file path: ${details.filePath ?? "<empty>"}`,
    EMPTY_FILE_PATHS: () => "Ownership calculator requires at least one file path",
    INVALID_BLAME_BATCH_PAYLOAD: () =>
        "Invalid blame batch payload for ownership calculator",
    INVALID_BLAME_ENTRY: (details) =>
        `Invalid blame entry for file ${details.filePath ?? "<unknown>"}`,
    INVALID_BLAME_FILE_PATH: (details) =>
        `Invalid blame file path for ownership calculator: ${details.filePath ?? "<empty>"}`,
    INVALID_CACHE_TTL_MS: (details) =>
        `Invalid ownership cache TTL in milliseconds: ${details.cacheTtlMs ?? Number.NaN}`,
    INVALID_FETCH_BLAME_BATCH: () =>
        "Ownership calculator fetchBlameBatch must be a function",
    INVALID_FILE_PATH: (details) =>
        `Invalid ownership input file path: ${details.filePath ?? "<empty>"}`,
    INVALID_MAX_FETCH_ATTEMPTS: (details) =>
        `Invalid max fetch attempts for ownership calculator: ${details.maxFetchAttempts ?? Number.NaN}`,
    INVALID_PRIMARY_THRESHOLD: (details) =>
        `Invalid primary ownership threshold: ${details.primaryThreshold ?? Number.NaN}`,
    INVALID_REF: (details) =>
        `Invalid ownership calculator ref: ${details.ref ?? "<empty>"}`,
    INVALID_RETRY_BACKOFF_MS: (details) =>
        `Invalid ownership retry backoff in milliseconds: ${details.retryBackoffMs ?? Number.NaN}`,
    INVALID_SECONDARY_THRESHOLD: (details) =>
        `Invalid secondary ownership threshold: ${details.secondaryThreshold ?? Number.NaN}`,
    INVALID_SLEEP: () => "Ownership calculator sleep callback must be a function",
    INVALID_THRESHOLD_RELATION: (details) =>
        `Secondary threshold ${details.secondaryThreshold ?? Number.NaN} cannot exceed primary threshold ${
            details.primaryThreshold ?? Number.NaN
        }`,
    RETRY_EXHAUSTED: (details) =>
        `Ownership calculator retries exhausted for ref ${details.ref ?? "<unknown>"} after ${
            details.maxFetchAttempts ?? Number.NaN
        } attempts: ${details.causeMessage ?? "<unknown>"}`,
}
