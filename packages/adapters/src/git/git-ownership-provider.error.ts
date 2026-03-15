/**
 * Typed error codes for git ownership provider failures.
 */
export const GIT_OWNERSHIP_PROVIDER_ERROR_CODE = {
    INVALID_REPOSITORY_ID: "INVALID_REPOSITORY_ID",
    INVALID_FILE_PATH: "INVALID_FILE_PATH",
    INVALID_DEFAULT_REF: "INVALID_DEFAULT_REF",
    INVALID_MAX_HISTORY_COUNT: "INVALID_MAX_HISTORY_COUNT",
    INVALID_BUS_FACTOR_THRESHOLD: "INVALID_BUS_FACTOR_THRESHOLD",
    GET_FILE_OWNERSHIP_FAILED: "GET_FILE_OWNERSHIP_FAILED",
    GET_CONTRIBUTORS_FAILED: "GET_CONTRIBUTORS_FAILED",
    GET_OWNERSHIP_TIMELINE_FAILED: "GET_OWNERSHIP_TIMELINE_FAILED",
} as const

/**
 * Git ownership provider error code literal.
 */
export type GitOwnershipProviderErrorCode =
    (typeof GIT_OWNERSHIP_PROVIDER_ERROR_CODE)[keyof typeof GIT_OWNERSHIP_PROVIDER_ERROR_CODE]

/**
 * Structured metadata for ownership provider failures.
 */
export interface IGitOwnershipProviderErrorDetails {
    /**
     * Repository identifier when available.
     */
    readonly repositoryId?: string

    /**
     * File path when available.
     */
    readonly filePath?: string

    /**
     * Upstream operation name when available.
     */
    readonly operation?: string

    /**
     * Lower-level failure message when available.
     */
    readonly causeMessage?: string
}

/**
 * Typed error raised by git ownership provider.
 */
export class GitOwnershipProviderError extends Error {
    /**
     * Stable machine-readable error code.
     */
    public readonly code: GitOwnershipProviderErrorCode

    /**
     * Repository identifier when available.
     */
    public readonly repositoryId?: string

    /**
     * File path when available.
     */
    public readonly filePath?: string

    /**
     * Upstream operation name when available.
     */
    public readonly operation?: string

    /**
     * Lower-level failure message when available.
     */
    public readonly causeMessage?: string

    /**
     * Creates typed ownership provider error.
     *
     * @param code Stable machine-readable error code.
     * @param details Normalized error metadata.
     */
    public constructor(
        code: GitOwnershipProviderErrorCode,
        details: IGitOwnershipProviderErrorDetails = {},
    ) {
        super(buildGitOwnershipProviderErrorMessage(code, details))

        this.name = "GitOwnershipProviderError"
        this.code = code
        this.repositoryId = details.repositoryId
        this.filePath = details.filePath
        this.operation = details.operation
        this.causeMessage = details.causeMessage
    }
}

type GitOwnershipProviderErrorMessageBuilder = (
    details: IGitOwnershipProviderErrorDetails,
) => string

const GIT_OWNERSHIP_PROVIDER_ERROR_MESSAGES: Readonly<
    Record<GitOwnershipProviderErrorCode, GitOwnershipProviderErrorMessageBuilder>
> = {
    [GIT_OWNERSHIP_PROVIDER_ERROR_CODE.INVALID_REPOSITORY_ID]: (
        details: IGitOwnershipProviderErrorDetails,
    ): string => `Invalid repository id for ownership provider: ${details.repositoryId ?? "<empty>"}`,
    [GIT_OWNERSHIP_PROVIDER_ERROR_CODE.INVALID_FILE_PATH]: (
        details: IGitOwnershipProviderErrorDetails,
    ): string => `Invalid file path for ownership provider: ${details.filePath ?? "<empty>"}`,
    [GIT_OWNERSHIP_PROVIDER_ERROR_CODE.INVALID_DEFAULT_REF]:
        (): string => "Default ref for ownership provider cannot be empty",
    [GIT_OWNERSHIP_PROVIDER_ERROR_CODE.INVALID_MAX_HISTORY_COUNT]:
        (): string => "Max history count for ownership provider must be a positive integer",
    [GIT_OWNERSHIP_PROVIDER_ERROR_CODE.INVALID_BUS_FACTOR_THRESHOLD]:
        (): string =>
            "Bus factor threshold for ownership provider must be in range (0, 1]",
    [GIT_OWNERSHIP_PROVIDER_ERROR_CODE.GET_FILE_OWNERSHIP_FAILED]: (
        details: IGitOwnershipProviderErrorDetails,
    ): string =>
        `Failed to build file ownership snapshot for repository ${details.repositoryId ?? "<unknown>"}`,
    [GIT_OWNERSHIP_PROVIDER_ERROR_CODE.GET_CONTRIBUTORS_FAILED]: (
        details: IGitOwnershipProviderErrorDetails,
    ): string =>
        `Failed to load contributors for repository ${details.repositoryId ?? "<unknown>"}`,
    [GIT_OWNERSHIP_PROVIDER_ERROR_CODE.GET_OWNERSHIP_TIMELINE_FAILED]: (
        details: IGitOwnershipProviderErrorDetails,
    ): string =>
        `Failed to build ownership timeline for repository ${details.repositoryId ?? "<unknown>"}`,
}

/**
 * Builds stable public message for ownership provider failures.
 *
 * @param code Stable machine-readable error code.
 * @param details Normalized error metadata.
 * @returns Stable public error message.
 */
function buildGitOwnershipProviderErrorMessage(
    code: GitOwnershipProviderErrorCode,
    details: IGitOwnershipProviderErrorDetails,
): string {
    return GIT_OWNERSHIP_PROVIDER_ERROR_MESSAGES[code](details)
}
