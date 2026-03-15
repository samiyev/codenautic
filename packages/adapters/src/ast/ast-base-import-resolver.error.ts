/**
 * Typed error codes for AST base import resolver.
 */
export const AST_BASE_IMPORT_RESOLVER_ERROR_CODE = {
    INVALID_SOURCE_FILE_PATH: "INVALID_SOURCE_FILE_PATH",
    INVALID_IMPORT_SOURCE: "INVALID_IMPORT_SOURCE",
    INVALID_FILE_EXTENSION_CANDIDATE: "INVALID_FILE_EXTENSION_CANDIDATE",
    INVALID_PATH_EXISTS: "INVALID_PATH_EXISTS",
    INVALID_MAX_ATTEMPTS: "INVALID_MAX_ATTEMPTS",
    INVALID_INITIAL_BACKOFF_MS: "INVALID_INITIAL_BACKOFF_MS",
    INVALID_MAX_BACKOFF_MS: "INVALID_MAX_BACKOFF_MS",
    INVALID_IDEMPOTENCY_CACHE_SIZE: "INVALID_IDEMPOTENCY_CACHE_SIZE",
    INVALID_RESOLVER_CANDIDATE: "INVALID_RESOLVER_CANDIDATE",
    IMPORT_RESOLUTION_FAILED: "IMPORT_RESOLUTION_FAILED",
} as const

/**
 * AST base import resolver error code literal.
 */
export type AstBaseImportResolverErrorCode =
    (typeof AST_BASE_IMPORT_RESOLVER_ERROR_CODE)[keyof typeof AST_BASE_IMPORT_RESOLVER_ERROR_CODE]

/**
 * Structured metadata for AST base import resolver failures.
 */
export interface IAstBaseImportResolverErrorDetails {
    /**
     * Invalid source file path when available.
     */
    readonly sourceFilePath?: string

    /**
     * Invalid import source when available.
     */
    readonly importSource?: string

    /**
     * Invalid extension candidate when available.
     */
    readonly fileExtensionCandidate?: string

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
     * Invalid idempotency cache size when available.
     */
    readonly idempotencyCacheSize?: number

    /**
     * Number of attempts that were executed.
     */
    readonly attempts?: number

    /**
     * Stable failure reason when available.
     */
    readonly reason?: string
}

/**
 * Typed AST base import resolver error with stable metadata.
 */
export class AstBaseImportResolverError extends Error {
    /**
     * Stable machine-readable error code.
     */
    public readonly code: AstBaseImportResolverErrorCode

    /**
     * Invalid source file path when available.
     */
    public readonly sourceFilePath?: string

    /**
     * Invalid import source when available.
     */
    public readonly importSource?: string

    /**
     * Invalid extension candidate when available.
     */
    public readonly fileExtensionCandidate?: string

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
     * Invalid idempotency cache size when available.
     */
    public readonly idempotencyCacheSize?: number

    /**
     * Number of attempts that were executed.
     */
    public readonly attempts?: number

    /**
     * Stable failure reason when available.
     */
    public readonly reason?: string

    /**
     * Creates typed AST base import resolver error.
     *
     * @param code Stable machine-readable error code.
     * @param details Normalized error metadata.
     */
    public constructor(
        code: AstBaseImportResolverErrorCode,
        details: IAstBaseImportResolverErrorDetails = {},
    ) {
        super(createAstBaseImportResolverErrorMessage(code, details))

        this.name = "AstBaseImportResolverError"
        this.code = code
        this.sourceFilePath = details.sourceFilePath
        this.importSource = details.importSource
        this.fileExtensionCandidate = details.fileExtensionCandidate
        this.maxAttempts = details.maxAttempts
        this.initialBackoffMs = details.initialBackoffMs
        this.maxBackoffMs = details.maxBackoffMs
        this.idempotencyCacheSize = details.idempotencyCacheSize
        this.attempts = details.attempts
        this.reason = details.reason
    }
}

/**
 * Builds stable public message for AST base import resolver failures.
 *
 * @param code Stable machine-readable error code.
 * @param details Normalized error metadata.
 * @returns Stable public message.
 */
function createAstBaseImportResolverErrorMessage(
    code: AstBaseImportResolverErrorCode,
    details: IAstBaseImportResolverErrorDetails,
): string {
    return AST_BASE_IMPORT_RESOLVER_ERROR_MESSAGES[code](details)
}

const AST_BASE_IMPORT_RESOLVER_ERROR_MESSAGES: Readonly<
    Record<AstBaseImportResolverErrorCode, (details: IAstBaseImportResolverErrorDetails) => string>
> = {
    INVALID_SOURCE_FILE_PATH: (details) =>
        `Invalid sourceFilePath for base import resolver: ${details.sourceFilePath ?? "<empty>"}`,
    INVALID_IMPORT_SOURCE: (details) =>
        `Invalid importSource for base import resolver: ${details.importSource ?? "<empty>"}`,
    INVALID_FILE_EXTENSION_CANDIDATE: (details) =>
        `Invalid file extension candidate for base import resolver: ${
            details.fileExtensionCandidate ?? "<empty>"
        }`,
    INVALID_PATH_EXISTS: () => "Base import resolver pathExists must be a function when provided",
    INVALID_MAX_ATTEMPTS: (details) =>
        `Invalid maxAttempts for base import resolver: ${details.maxAttempts ?? Number.NaN}`,
    INVALID_INITIAL_BACKOFF_MS: (details) =>
        `Invalid initialBackoffMs for base import resolver: ${
            details.initialBackoffMs ?? Number.NaN
        }`,
    INVALID_MAX_BACKOFF_MS: (details) =>
        `Invalid maxBackoffMs for base import resolver: ${details.maxBackoffMs ?? Number.NaN}`,
    INVALID_IDEMPOTENCY_CACHE_SIZE: (details) =>
        `Invalid idempotencyCacheSize for base import resolver: ${
            details.idempotencyCacheSize ?? Number.NaN
        }`,
    INVALID_RESOLVER_CANDIDATE: (details) =>
        `Invalid resolver candidate path for import ${details.importSource ?? "<empty>"}: ${
            details.sourceFilePath ?? "<empty>"
        }`,
    IMPORT_RESOLUTION_FAILED: (details) =>
        `Import resolution failed after ${details.attempts ?? Number.NaN} attempts: ${
            details.reason ?? "<unknown>"
        }`,
}
