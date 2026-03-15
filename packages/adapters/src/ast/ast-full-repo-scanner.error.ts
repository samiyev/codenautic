/**
 * Typed error codes for AST full repository scanner.
 */
export const AST_FULL_REPO_SCANNER_ERROR_CODE = {
    DIRECTORY_LIST_FAILED: "DIRECTORY_LIST_FAILED",
    FILE_READ_FAILED: "FILE_READ_FAILED",
    INVALID_GENERATE_SCAN_ID: "INVALID_GENERATE_SCAN_ID",
    INVALID_LIST_DIRECTORY: "INVALID_LIST_DIRECTORY",
    INVALID_MAX_READ_ATTEMPTS: "INVALID_MAX_READ_ATTEMPTS",
    INVALID_READ_FILE: "INVALID_READ_FILE",
    INVALID_REF: "INVALID_REF",
    INVALID_REPOSITORY_ID: "INVALID_REPOSITORY_ID",
    INVALID_REPOSITORY_PATH: "INVALID_REPOSITORY_PATH",
    INVALID_RESOLVE_REPOSITORY_PATH: "INVALID_RESOLVE_REPOSITORY_PATH",
    INVALID_RETRY_BACKOFF_MS: "INVALID_RETRY_BACKOFF_MS",
    PROGRESS_CALLBACK_FAILED: "PROGRESS_CALLBACK_FAILED",
    REPOSITORY_PATH_RESOLUTION_FAILED: "REPOSITORY_PATH_RESOLUTION_FAILED",
    SCAN_CANCELLED: "SCAN_CANCELLED",
} as const

/**
 * AST full repository scanner error code literal.
 */
export type AstFullRepoScannerErrorCode =
    (typeof AST_FULL_REPO_SCANNER_ERROR_CODE)[keyof typeof AST_FULL_REPO_SCANNER_ERROR_CODE]

/**
 * Structured metadata for AST full repository scanner failures.
 */
export interface IAstFullRepoScannerErrorDetails {
    /**
     * Repository identifier when available.
     */
    readonly repositoryId?: string

    /**
     * Repository path when available.
     */
    readonly repositoryPath?: string

    /**
     * Branch or commit reference when available.
     */
    readonly ref?: string

    /**
     * File path when available.
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
 * Typed AST full repository scanner error with stable metadata.
 */
export class AstFullRepoScannerError extends Error {
    /**
     * Stable machine-readable error code.
     */
    public readonly code: AstFullRepoScannerErrorCode

    /**
     * Repository identifier when available.
     */
    public readonly repositoryId?: string

    /**
     * Repository path when available.
     */
    public readonly repositoryPath?: string

    /**
     * Branch or commit reference when available.
     */
    public readonly ref?: string

    /**
     * File path when available.
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
     * Creates typed AST full repository scanner error.
     *
     * @param code Stable machine-readable error code.
     * @param details Structured error metadata.
     */
    public constructor(
        code: AstFullRepoScannerErrorCode,
        details: IAstFullRepoScannerErrorDetails = {},
    ) {
        super(createAstFullRepoScannerErrorMessage(code, details))

        this.name = "AstFullRepoScannerError"
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
 * Builds stable public message for full repository scanner failures.
 *
 * @param code Stable machine-readable error code.
 * @param details Structured error metadata.
 * @returns Stable public message.
 */
function createAstFullRepoScannerErrorMessage(
    code: AstFullRepoScannerErrorCode,
    details: IAstFullRepoScannerErrorDetails,
): string {
    return AST_FULL_REPO_SCANNER_ERROR_MESSAGES[code](details)
}

const AST_FULL_REPO_SCANNER_ERROR_MESSAGES: Readonly<
    Record<
        AstFullRepoScannerErrorCode,
        (details: IAstFullRepoScannerErrorDetails) => string
    >
> = {
    DIRECTORY_LIST_FAILED: (details) =>
        `AST full repo scanner failed to list directory ${details.repositoryPath ?? "<unknown>"}: ${
            details.causeMessage ?? "<unknown>"
        }`,
    FILE_READ_FAILED: (details) =>
        `AST full repo scanner failed to read file ${details.filePath ?? "<unknown>"}: ${
            details.causeMessage ?? "<unknown>"
        }`,
    INVALID_GENERATE_SCAN_ID: () =>
        "AST full repo scanner generateScanId must be a function",
    INVALID_LIST_DIRECTORY: () =>
        "AST full repo scanner listDirectory must be a function",
    INVALID_MAX_READ_ATTEMPTS: (details) =>
        `Invalid AST full repo scanner max read attempts: ${details.value ?? Number.NaN}`,
    INVALID_READ_FILE: () => "AST full repo scanner readFile must be a function",
    INVALID_REF: (details) =>
        `Invalid AST full repo scanner ref: ${details.ref ?? "<empty>"}`,
    INVALID_REPOSITORY_ID: (details) =>
        `Invalid AST full repo scanner repository id: ${details.repositoryId ?? "<empty>"}`,
    INVALID_REPOSITORY_PATH: (details) =>
        `Invalid AST full repo scanner repository path: ${details.repositoryPath ?? "<empty>"}`,
    INVALID_RESOLVE_REPOSITORY_PATH: () =>
        "AST full repo scanner resolveRepositoryPath must be a function",
    INVALID_RETRY_BACKOFF_MS: (details) =>
        `Invalid AST full repo scanner retry backoff ms: ${details.value ?? Number.NaN}`,
    PROGRESS_CALLBACK_FAILED: (details) =>
        `AST full repo scanner progress callback failed for ${details.scanId ?? "<unknown>"}: ${
            details.causeMessage ?? "<unknown>"
        }`,
    REPOSITORY_PATH_RESOLUTION_FAILED: (details) =>
        `AST full repo scanner repository path resolution failed for ${
            details.repositoryId ?? "<unknown>"
        }: ${details.causeMessage ?? "<unknown>"}`,
    SCAN_CANCELLED: (details) =>
        `AST full repo scanner was cancelled: ${details.scanId ?? "<unknown>"}`,
}
