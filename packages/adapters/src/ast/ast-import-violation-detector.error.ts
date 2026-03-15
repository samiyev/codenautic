/**
 * Typed error codes for AST import violation detector.
 */
export const AST_IMPORT_VIOLATION_DETECTOR_ERROR_CODE = {
    EMPTY_FILE_PATHS: "EMPTY_FILE_PATHS",
    EMPTY_IMPORTS: "EMPTY_IMPORTS",
    INVALID_BLUEPRINT: "INVALID_BLUEPRINT",
    INVALID_CACHE_TTL_MS: "INVALID_CACHE_TTL_MS",
    INVALID_FILE_PATH: "INVALID_FILE_PATH",
    INVALID_IMPORTS: "INVALID_IMPORTS",
    INVALID_IMPORT_PATH: "INVALID_IMPORT_PATH",
    INVALID_IMPORT_LAYER: "INVALID_IMPORT_LAYER",
    INVALID_LOAD_IMPORTS: "INVALID_LOAD_IMPORTS",
    INVALID_MAX_LOAD_ATTEMPTS: "INVALID_MAX_LOAD_ATTEMPTS",
    INVALID_RETRY_BACKOFF_MS: "INVALID_RETRY_BACKOFF_MS",
    INVALID_SLEEP: "INVALID_SLEEP",
    LOAD_IMPORTS_FAILED: "LOAD_IMPORTS_FAILED",
    RETRY_EXHAUSTED: "RETRY_EXHAUSTED",
    UNKNOWN_LAYER_REFERENCE: "UNKNOWN_LAYER_REFERENCE",
} as const

/**
 * AST import violation detector error code literal.
 */
export type AstImportViolationDetectorErrorCode =
    (typeof AST_IMPORT_VIOLATION_DETECTOR_ERROR_CODE)[keyof typeof AST_IMPORT_VIOLATION_DETECTOR_ERROR_CODE]

/**
 * Structured metadata for import violation detector failures.
 */
export interface IAstImportViolationDetectorErrorDetails {
    /**
     * Import source path when available.
     */
    readonly sourcePath?: string

    /**
     * Import target path when available.
     */
    readonly targetPath?: string

    /**
     * Layer name when available.
     */
    readonly layerName?: string

    /**
     * Retry attempt number when available.
     */
    readonly attempt?: number

    /**
     * Maximum load attempts when available.
     */
    readonly maxLoadAttempts?: number

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
 * Typed AST import violation detector error with stable metadata.
 */
export class AstImportViolationDetectorError extends Error {
    /**
     * Stable machine-readable error code.
     */
    public readonly code: AstImportViolationDetectorErrorCode

    /**
     * Import source path when available.
     */
    public readonly sourcePath?: string

    /**
     * Import target path when available.
     */
    public readonly targetPath?: string

    /**
     * Layer name when available.
     */
    public readonly layerName?: string

    /**
     * Retry attempt number when available.
     */
    public readonly attempt?: number

    /**
     * Maximum load attempts when available.
     */
    public readonly maxLoadAttempts?: number

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
     * Creates typed AST import violation detector error.
     *
     * @param code Stable machine-readable error code.
     * @param details Structured error metadata.
     */
    public constructor(
        code: AstImportViolationDetectorErrorCode,
        details: IAstImportViolationDetectorErrorDetails = {},
    ) {
        super(createAstImportViolationDetectorErrorMessage(code, details))

        this.name = "AstImportViolationDetectorError"
        this.code = code
        this.sourcePath = details.sourcePath
        this.targetPath = details.targetPath
        this.layerName = details.layerName
        this.attempt = details.attempt
        this.maxLoadAttempts = details.maxLoadAttempts
        this.retryBackoffMs = details.retryBackoffMs
        this.cacheTtlMs = details.cacheTtlMs
        this.causeMessage = details.causeMessage
    }
}

/**
 * Builds stable public message for detector failures.
 *
 * @param code Stable machine-readable error code.
 * @param details Structured error metadata.
 * @returns Stable public message.
 */
function createAstImportViolationDetectorErrorMessage(
    code: AstImportViolationDetectorErrorCode,
    details: IAstImportViolationDetectorErrorDetails,
): string {
    return AST_IMPORT_VIOLATION_DETECTOR_ERROR_MESSAGES[code](details)
}

const AST_IMPORT_VIOLATION_DETECTOR_ERROR_MESSAGES: Readonly<
    Record<AstImportViolationDetectorErrorCode, (details: IAstImportViolationDetectorErrorDetails) => string>
> = {
    EMPTY_FILE_PATHS: () => "Import violation detector filePaths cannot be empty",
    EMPTY_IMPORTS: () => "Import violation detector requires at least one import edge",
    INVALID_BLUEPRINT: () => "Import violation detector blueprint is invalid",
    INVALID_CACHE_TTL_MS: (details) =>
        `Invalid detector cache TTL in milliseconds: ${details.cacheTtlMs ?? Number.NaN}`,
    INVALID_FILE_PATH: (details) =>
        `Invalid detector file path: ${details.sourcePath ?? "<empty>"}`,
    INVALID_IMPORTS: () => "Import violation detector imports must be an array",
    INVALID_IMPORT_PATH: (details) =>
        `Invalid import edge path: ${details.sourcePath ?? details.targetPath ?? "<empty>"}`,
    INVALID_IMPORT_LAYER: (details) =>
        `Invalid import edge layer: ${details.layerName ?? "<empty>"}`,
    INVALID_LOAD_IMPORTS: () => "Import violation detector loadImports callback must be a function",
    INVALID_MAX_LOAD_ATTEMPTS: (details) =>
        `Invalid detector max load attempts: ${details.maxLoadAttempts ?? Number.NaN}`,
    INVALID_RETRY_BACKOFF_MS: (details) =>
        `Invalid detector retry backoff in milliseconds: ${details.retryBackoffMs ?? Number.NaN}`,
    INVALID_SLEEP: () => "Import violation detector sleep callback must be a function",
    LOAD_IMPORTS_FAILED: (details) =>
        `Failed to load import edges: ${details.causeMessage ?? "<unknown>"}`,
    RETRY_EXHAUSTED: (details) =>
        `Import edge loading retries exhausted after ${
            details.maxLoadAttempts ?? Number.NaN
        } attempts: ${details.causeMessage ?? "<unknown>"}`,
    UNKNOWN_LAYER_REFERENCE: (details) =>
        `Unknown layer reference in import edge: ${details.layerName ?? "<empty>"}`,
}
