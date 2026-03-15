/**
 * Typed error codes for AST file metrics caching layer.
 */
export const AST_FILE_METRICS_CACHING_ERROR_CODE = {
    COMMIT_SHA_RESOLUTION_FAILED: "COMMIT_SHA_RESOLUTION_FAILED",
    INVALID_CACHE_TTL_MS: "INVALID_CACHE_TTL_MS",
    INVALID_COMMIT_SHA: "INVALID_COMMIT_SHA",
    INVALID_EXECUTE_GIT: "INVALID_EXECUTE_GIT",
    INVALID_FILE_PATH: "INVALID_FILE_PATH",
    INVALID_MAX_CACHE_ENTRIES: "INVALID_MAX_CACHE_ENTRIES",
    INVALID_REPOSITORY_ID: "INVALID_REPOSITORY_ID",
    INVALID_REPOSITORY_PATH: "INVALID_REPOSITORY_PATH",
    INVALID_RESOLVE_COMMIT_SHA: "INVALID_RESOLVE_COMMIT_SHA",
    INVALID_RESOLVE_REPOSITORY_PATH: "INVALID_RESOLVE_REPOSITORY_PATH",
    INVALID_SOURCE_PROVIDER: "INVALID_SOURCE_PROVIDER",
    REPOSITORY_PATH_RESOLUTION_FAILED: "REPOSITORY_PATH_RESOLUTION_FAILED",
    SOURCE_PROVIDER_FAILED: "SOURCE_PROVIDER_FAILED",
} as const

/**
 * AST file metrics caching error code literal.
 */
export type AstFileMetricsCachingErrorCode =
    (typeof AST_FILE_METRICS_CACHING_ERROR_CODE)[keyof typeof AST_FILE_METRICS_CACHING_ERROR_CODE]

/**
 * Structured metadata for AST file metrics caching failures.
 */
export interface IAstFileMetricsCachingErrorDetails {
    /**
     * Repository identifier when available.
     */
    readonly repositoryId?: string

    /**
     * Repository path when available.
     */
    readonly repositoryPath?: string

    /**
     * Commit sha when available.
     */
    readonly commitSha?: string

    /**
     * Repository-relative file path when available.
     */
    readonly filePath?: string

    /**
     * Numeric value when available.
     */
    readonly value?: number

    /**
     * Underlying failure message when available.
     */
    readonly causeMessage?: string
}

/**
 * Typed AST file metrics caching error with stable metadata.
 */
export class AstFileMetricsCachingError extends Error {
    /**
     * Stable machine-readable error code.
     */
    public readonly code: AstFileMetricsCachingErrorCode

    /**
     * Repository identifier when available.
     */
    public readonly repositoryId?: string

    /**
     * Repository path when available.
     */
    public readonly repositoryPath?: string

    /**
     * Commit sha when available.
     */
    public readonly commitSha?: string

    /**
     * Repository-relative file path when available.
     */
    public readonly filePath?: string

    /**
     * Numeric value when available.
     */
    public readonly value?: number

    /**
     * Underlying failure message when available.
     */
    public readonly causeMessage?: string

    /**
     * Creates typed AST file metrics caching error.
     *
     * @param code Stable machine-readable error code.
     * @param details Structured error metadata.
     */
    public constructor(
        code: AstFileMetricsCachingErrorCode,
        details: IAstFileMetricsCachingErrorDetails = {},
    ) {
        super(createAstFileMetricsCachingErrorMessage(code, details))

        this.name = "AstFileMetricsCachingError"
        this.code = code
        this.repositoryId = details.repositoryId
        this.repositoryPath = details.repositoryPath
        this.commitSha = details.commitSha
        this.filePath = details.filePath
        this.value = details.value
        this.causeMessage = details.causeMessage
    }
}

/**
 * Builds stable public message for AST file metrics caching failures.
 *
 * @param code Stable machine-readable error code.
 * @param details Structured error metadata.
 * @returns Stable public message.
 */
function createAstFileMetricsCachingErrorMessage(
    code: AstFileMetricsCachingErrorCode,
    details: IAstFileMetricsCachingErrorDetails,
): string {
    return AST_FILE_METRICS_CACHING_ERROR_MESSAGES[code](details)
}

const AST_FILE_METRICS_CACHING_ERROR_MESSAGES: Readonly<
    Record<
        AstFileMetricsCachingErrorCode,
        (details: IAstFileMetricsCachingErrorDetails) => string
    >
> = {
    COMMIT_SHA_RESOLUTION_FAILED: (details) =>
        `AST file metrics commit sha resolution failed for ${details.repositoryId ?? "<unknown>"}: ${
            details.causeMessage ?? "<unknown>"
        }`,
    INVALID_CACHE_TTL_MS: (details) =>
        `Invalid AST file metrics cache ttl ms: ${details.value ?? Number.NaN}`,
    INVALID_COMMIT_SHA: (details) =>
        `Invalid AST file metrics commit sha: ${details.commitSha ?? "<empty>"}`,
    INVALID_EXECUTE_GIT: () => "AST file metrics executeGit must be a function",
    INVALID_FILE_PATH: (details) =>
        `Invalid AST file metrics cache file path: ${details.filePath ?? "<empty>"}`,
    INVALID_MAX_CACHE_ENTRIES: (details) =>
        `Invalid AST file metrics max cache entries: ${details.value ?? Number.NaN}`,
    INVALID_REPOSITORY_ID: (details) =>
        `Invalid AST file metrics cache repository id: ${details.repositoryId ?? "<empty>"}`,
    INVALID_REPOSITORY_PATH: (details) =>
        `Invalid AST file metrics cache repository path for ${
            details.repositoryId ?? "<unknown>"
        }: ${details.repositoryPath ?? "<empty>"}`,
    INVALID_RESOLVE_COMMIT_SHA: () => "AST file metrics resolveCommitSha must be a function",
    INVALID_RESOLVE_REPOSITORY_PATH: () =>
        "AST file metrics resolveRepositoryPath must be a function",
    INVALID_SOURCE_PROVIDER: () =>
        "AST file metrics sourceProvider must implement getMetrics(repositoryId, filePaths)",
    REPOSITORY_PATH_RESOLUTION_FAILED: (details) =>
        `AST file metrics repository path resolution failed for ${
            details.repositoryId ?? "<unknown>"
        }: ${details.causeMessage ?? "<unknown>"}`,
    SOURCE_PROVIDER_FAILED: (details) =>
        `AST file metrics source provider failed for ${details.repositoryId ?? "<unknown>"}: ${
            details.causeMessage ?? "<unknown>"
        }`,
}
