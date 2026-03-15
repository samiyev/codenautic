/**
 * Typed error codes for AST incremental diff scanner.
 */
export const AST_INCREMENTAL_DIFF_SCANNER_ERROR_CODE = {
    CHANGED_FILES_RESOLUTION_FAILED: "CHANGED_FILES_RESOLUTION_FAILED",
    FILE_READ_FAILED: "FILE_READ_FAILED",
    INVALID_CACHE_TTL_MS: "INVALID_CACHE_TTL_MS",
    INVALID_CHANGED_FILE_PATH: "INVALID_CHANGED_FILE_PATH",
    INVALID_EXECUTE_GIT: "INVALID_EXECUTE_GIT",
    INVALID_GENERATE_SCAN_ID: "INVALID_GENERATE_SCAN_ID",
    INVALID_MAX_CACHE_ENTRIES: "INVALID_MAX_CACHE_ENTRIES",
    INVALID_MAX_READ_ATTEMPTS: "INVALID_MAX_READ_ATTEMPTS",
    INVALID_READ_FILE: "INVALID_READ_FILE",
    INVALID_REF: "INVALID_REF",
    INVALID_REPOSITORY_ID: "INVALID_REPOSITORY_ID",
    INVALID_REPOSITORY_PATH: "INVALID_REPOSITORY_PATH",
    INVALID_RESOLVE_CHANGED_FILE_PATHS: "INVALID_RESOLVE_CHANGED_FILE_PATHS",
    INVALID_RESOLVE_REPOSITORY_PATH: "INVALID_RESOLVE_REPOSITORY_PATH",
    INVALID_RETRY_BACKOFF_MS: "INVALID_RETRY_BACKOFF_MS",
    PROGRESS_CALLBACK_FAILED: "PROGRESS_CALLBACK_FAILED",
    REPOSITORY_PATH_RESOLUTION_FAILED: "REPOSITORY_PATH_RESOLUTION_FAILED",
    SCAN_CANCELLED: "SCAN_CANCELLED",
} as const

/**
 * AST incremental diff scanner error code literal.
 */
export type AstIncrementalDiffScannerErrorCode =
    (typeof AST_INCREMENTAL_DIFF_SCANNER_ERROR_CODE)[keyof typeof AST_INCREMENTAL_DIFF_SCANNER_ERROR_CODE]

/**
 * Structured metadata for AST incremental diff scanner failures.
 */
export interface IAstIncrementalDiffScannerErrorDetails {
    /**
     * Repository identifier when available.
     */
    readonly repositoryId?: string

    /**
     * Repository path when available.
     */
    readonly repositoryPath?: string

    /**
     * Branch, commit, or ref-range when available.
     */
    readonly ref?: string

    /**
     * Repository-relative file path when available.
     */
    readonly filePath?: string

    /**
     * Scan identifier when available.
     */
    readonly scanId?: string

    /**
     * Invalid numeric value when available.
     */
    readonly value?: number

    /**
     * Underlying failure message when available.
     */
    readonly causeMessage?: string
}

/**
 * Typed AST incremental diff scanner error with stable metadata.
 */
export class AstIncrementalDiffScannerError extends Error {
    /**
     * Stable machine-readable error code.
     */
    public readonly code: AstIncrementalDiffScannerErrorCode

    /**
     * Repository identifier when available.
     */
    public readonly repositoryId?: string

    /**
     * Repository path when available.
     */
    public readonly repositoryPath?: string

    /**
     * Branch, commit, or ref-range when available.
     */
    public readonly ref?: string

    /**
     * Repository-relative file path when available.
     */
    public readonly filePath?: string

    /**
     * Scan identifier when available.
     */
    public readonly scanId?: string

    /**
     * Invalid numeric value when available.
     */
    public readonly value?: number

    /**
     * Underlying failure message when available.
     */
    public readonly causeMessage?: string

    /**
     * Creates typed AST incremental diff scanner error.
     *
     * @param code Stable machine-readable error code.
     * @param details Structured metadata payload.
     */
    public constructor(
        code: AstIncrementalDiffScannerErrorCode,
        details: IAstIncrementalDiffScannerErrorDetails = {},
    ) {
        super(createAstIncrementalDiffScannerErrorMessage(code, details))

        this.name = "AstIncrementalDiffScannerError"
        this.code = code
        this.repositoryId = details.repositoryId
        this.repositoryPath = details.repositoryPath
        this.ref = details.ref
        this.filePath = details.filePath
        this.scanId = details.scanId
        this.value = details.value
        this.causeMessage = details.causeMessage
    }
}

/**
 * Builds stable public message for incremental diff scanner failures.
 *
 * @param code Stable machine-readable error code.
 * @param details Structured metadata payload.
 * @returns Stable public message.
 */
function createAstIncrementalDiffScannerErrorMessage(
    code: AstIncrementalDiffScannerErrorCode,
    details: IAstIncrementalDiffScannerErrorDetails,
): string {
    return AST_INCREMENTAL_DIFF_SCANNER_ERROR_MESSAGES[code](details)
}

const AST_INCREMENTAL_DIFF_SCANNER_ERROR_MESSAGES: Readonly<
    Record<
        AstIncrementalDiffScannerErrorCode,
        (details: IAstIncrementalDiffScannerErrorDetails) => string
    >
> = {
    CHANGED_FILES_RESOLUTION_FAILED: (details) =>
        `AST incremental diff scanner failed to resolve changed files for ${
            details.repositoryId ?? "<unknown>"
        }: ${details.causeMessage ?? "<unknown>"}`,
    FILE_READ_FAILED: (details) =>
        `AST incremental diff scanner failed to read file ${details.filePath ?? "<unknown>"}: ${
            details.causeMessage ?? "<unknown>"
        }`,
    INVALID_CACHE_TTL_MS: (details) =>
        `Invalid AST incremental diff scanner cache ttl ms: ${details.value ?? Number.NaN}`,
    INVALID_CHANGED_FILE_PATH: (details) =>
        `Invalid AST incremental diff scanner changed file path: ${details.filePath ?? "<empty>"}`,
    INVALID_EXECUTE_GIT: () => "AST incremental diff scanner executeGit must be a function",
    INVALID_GENERATE_SCAN_ID: () =>
        "AST incremental diff scanner generateScanId must be a function",
    INVALID_MAX_CACHE_ENTRIES: (details) =>
        `Invalid AST incremental diff scanner max cache entries: ${details.value ?? Number.NaN}`,
    INVALID_MAX_READ_ATTEMPTS: (details) =>
        `Invalid AST incremental diff scanner max read attempts: ${details.value ?? Number.NaN}`,
    INVALID_READ_FILE: () => "AST incremental diff scanner readFile must be a function",
    INVALID_REF: (details) =>
        `Invalid AST incremental diff scanner ref: ${details.ref ?? "<empty>"}`,
    INVALID_REPOSITORY_ID: (details) =>
        `Invalid AST incremental diff scanner repository id: ${details.repositoryId ?? "<empty>"}`,
    INVALID_REPOSITORY_PATH: (details) =>
        `Invalid AST incremental diff scanner repository path: ${details.repositoryPath ?? "<empty>"}`,
    INVALID_RESOLVE_CHANGED_FILE_PATHS: () =>
        "AST incremental diff scanner resolveChangedFilePaths must be a function",
    INVALID_RESOLVE_REPOSITORY_PATH: () =>
        "AST incremental diff scanner resolveRepositoryPath must be a function",
    INVALID_RETRY_BACKOFF_MS: (details) =>
        `Invalid AST incremental diff scanner retry backoff ms: ${details.value ?? Number.NaN}`,
    PROGRESS_CALLBACK_FAILED: (details) =>
        `AST incremental diff scanner progress callback failed for ${
            details.scanId ?? "<unknown>"
        }: ${details.causeMessage ?? "<unknown>"}`,
    REPOSITORY_PATH_RESOLUTION_FAILED: (details) =>
        `AST incremental diff scanner repository path resolution failed for ${
            details.repositoryId ?? "<unknown>"
        }: ${details.causeMessage ?? "<unknown>"}`,
    SCAN_CANCELLED: (details) =>
        `AST incremental diff scanner was cancelled: ${details.scanId ?? "<unknown>"}`,
}
