/**
 * Typed error codes for AST module boundary validator.
 */
export const AST_MODULE_BOUNDARY_VALIDATOR_ERROR_CODE = {
    AMBIGUOUS_MODULE_MATCH: "AMBIGUOUS_MODULE_MATCH",
    EMPTY_FILE_PATHS: "EMPTY_FILE_PATHS",
    EMPTY_IMPORTS: "EMPTY_IMPORTS",
    INVALID_BLUEPRINT: "INVALID_BLUEPRINT",
    INVALID_CACHE_TTL_MS: "INVALID_CACHE_TTL_MS",
    INVALID_FILE_PATH: "INVALID_FILE_PATH",
    INVALID_IMPORT_LAYER: "INVALID_IMPORT_LAYER",
    INVALID_IMPORT_PATH: "INVALID_IMPORT_PATH",
    INVALID_IMPORTS: "INVALID_IMPORTS",
    INVALID_LOAD_IMPORTS: "INVALID_LOAD_IMPORTS",
    INVALID_MAX_LOAD_ATTEMPTS: "INVALID_MAX_LOAD_ATTEMPTS",
    INVALID_RETRY_BACKOFF_MS: "INVALID_RETRY_BACKOFF_MS",
    INVALID_SLEEP: "INVALID_SLEEP",
    RETRY_EXHAUSTED: "RETRY_EXHAUSTED",
    WITHOUT_MODULES: "WITHOUT_MODULES",
} as const

/**
 * AST module boundary validator error code literal.
 */
export type AstModuleBoundaryValidatorErrorCode =
    (typeof AST_MODULE_BOUNDARY_VALIDATOR_ERROR_CODE)[keyof typeof AST_MODULE_BOUNDARY_VALIDATOR_ERROR_CODE]

/**
 * Structured metadata for module boundary validator failures.
 */
export interface IAstModuleBoundaryValidatorErrorDetails {
    /**
     * Source file path when available.
     */
    readonly sourcePath?: string

    /**
     * Target file path when available.
     */
    readonly targetPath?: string

    /**
     * Layer name when available.
     */
    readonly layerName?: string

    /**
     * Module name when available.
     */
    readonly moduleName?: string

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
 * Typed AST module boundary validator error with stable metadata.
 */
export class AstModuleBoundaryValidatorError extends Error {
    /**
     * Stable machine-readable error code.
     */
    public readonly code: AstModuleBoundaryValidatorErrorCode

    /**
     * Source file path when available.
     */
    public readonly sourcePath?: string

    /**
     * Target file path when available.
     */
    public readonly targetPath?: string

    /**
     * Layer name when available.
     */
    public readonly layerName?: string

    /**
     * Module name when available.
     */
    public readonly moduleName?: string

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
     * Creates typed AST module boundary validator error.
     *
     * @param code Stable machine-readable error code.
     * @param details Structured error metadata.
     */
    public constructor(
        code: AstModuleBoundaryValidatorErrorCode,
        details: IAstModuleBoundaryValidatorErrorDetails = {},
    ) {
        super(createAstModuleBoundaryValidatorErrorMessage(code, details))

        this.name = "AstModuleBoundaryValidatorError"
        this.code = code
        this.sourcePath = details.sourcePath
        this.targetPath = details.targetPath
        this.layerName = details.layerName
        this.moduleName = details.moduleName
        this.attempt = details.attempt
        this.maxLoadAttempts = details.maxLoadAttempts
        this.retryBackoffMs = details.retryBackoffMs
        this.cacheTtlMs = details.cacheTtlMs
        this.causeMessage = details.causeMessage
    }
}

/**
 * Builds stable public message for validator failures.
 *
 * @param code Stable machine-readable error code.
 * @param details Structured error metadata.
 * @returns Stable public message.
 */
function createAstModuleBoundaryValidatorErrorMessage(
    code: AstModuleBoundaryValidatorErrorCode,
    details: IAstModuleBoundaryValidatorErrorDetails,
): string {
    return AST_MODULE_BOUNDARY_VALIDATOR_ERROR_MESSAGES[code](details)
}

const AST_MODULE_BOUNDARY_VALIDATOR_ERROR_MESSAGES: Readonly<
    Record<AstModuleBoundaryValidatorErrorCode, (details: IAstModuleBoundaryValidatorErrorDetails) => string>
> = {
    AMBIGUOUS_MODULE_MATCH: (details) =>
        `File path matches multiple modules: ${
            details.sourcePath ?? details.targetPath ?? "<empty>"
        }`,
    EMPTY_FILE_PATHS: () => "Module boundary validator filePaths cannot be empty",
    EMPTY_IMPORTS: () => "Module boundary validator requires at least one import edge",
    INVALID_BLUEPRINT: () => "Module boundary validator blueprint is invalid",
    INVALID_CACHE_TTL_MS: (details) =>
        `Invalid module boundary validator cache TTL: ${details.cacheTtlMs ?? Number.NaN}`,
    INVALID_FILE_PATH: (details) =>
        `Invalid module boundary validator file path: ${details.sourcePath ?? "<empty>"}`,
    INVALID_IMPORT_LAYER: (details) =>
        `Invalid module boundary import layer: ${details.layerName ?? "<empty>"}`,
    INVALID_IMPORT_PATH: (details) =>
        `Invalid module boundary import path: ${details.sourcePath ?? details.targetPath ?? "<empty>"}`,
    INVALID_IMPORTS: () => "Module boundary validator imports must be an array",
    INVALID_LOAD_IMPORTS: () => "Module boundary validator loadImports callback must be a function",
    INVALID_MAX_LOAD_ATTEMPTS: (details) =>
        `Invalid module boundary validator max load attempts: ${details.maxLoadAttempts ?? Number.NaN}`,
    INVALID_RETRY_BACKOFF_MS: (details) =>
        `Invalid module boundary validator retry backoff: ${details.retryBackoffMs ?? Number.NaN}`,
    INVALID_SLEEP: () => "Module boundary validator sleep callback must be a function",
    RETRY_EXHAUSTED: (details) =>
        `Import loading retries exhausted after ${details.maxLoadAttempts ?? Number.NaN} attempts: ${
            details.causeMessage ?? "<unknown>"
        }`,
    WITHOUT_MODULES: () => "Module boundary validator requires non-empty blueprint modules",
}
