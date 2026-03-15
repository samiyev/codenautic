/**
 * Typed error codes for AST multi-repo graph federation.
 */
export const AST_SERVICE_MULTI_REPO_GRAPH_FEDERATION_ERROR_CODE = {
    DUPLICATE_REPOSITORY_ID: "DUPLICATE_REPOSITORY_ID",
    EMPTY_REPOSITORIES: "EMPTY_REPOSITORIES",
    INVALID_BRANCH: "INVALID_BRANCH",
    INVALID_CROSS_REPOSITORY_EDGE_THRESHOLD: "INVALID_CROSS_REPOSITORY_EDGE_THRESHOLD",
    INVALID_IDEMPOTENCY_CACHE_SIZE: "INVALID_IDEMPOTENCY_CACHE_SIZE",
    INVALID_IDEMPOTENCY_KEY: "INVALID_IDEMPOTENCY_KEY",
    INVALID_MAX_BACKOFF_MS: "INVALID_MAX_BACKOFF_MS",
    INVALID_MAX_REPOSITORIES: "INVALID_MAX_REPOSITORIES",
    INVALID_MIN_SHARED_NODE_NAME_LENGTH: "INVALID_MIN_SHARED_NODE_NAME_LENGTH",
    INVALID_REPOSITORY_ID: "INVALID_REPOSITORY_ID",
    INVALID_RETRY_INITIAL_BACKOFF_MS: "INVALID_RETRY_INITIAL_BACKOFF_MS",
    INVALID_RETRY_MAX_ATTEMPTS: "INVALID_RETRY_MAX_ATTEMPTS",
    REPOSITORY_FETCH_FAILED: "REPOSITORY_FETCH_FAILED",
    RETRY_EXHAUSTED: "RETRY_EXHAUSTED",
} as const

/**
 * AST multi-repo graph federation error code literal.
 */
export type AstServiceMultiRepoGraphFederationErrorCode =
    (typeof AST_SERVICE_MULTI_REPO_GRAPH_FEDERATION_ERROR_CODE)[keyof typeof AST_SERVICE_MULTI_REPO_GRAPH_FEDERATION_ERROR_CODE]

/**
 * Structured metadata for AST multi-repo federation failures.
 */
export interface IAstServiceMultiRepoGraphFederationErrorDetails {
    /**
     * Repository identifier when available.
     */
    readonly repositoryId?: string

    /**
     * Branch value when available.
     */
    readonly branch?: string

    /**
     * Idempotency key when available.
     */
    readonly idempotencyKey?: string

    /**
     * Numeric value when available.
     */
    readonly value?: number

    /**
     * Attempts count when available.
     */
    readonly attempts?: number

    /**
     * Underlying error message when available.
     */
    readonly causeMessage?: string
}

/**
 * Typed AST multi-repo graph federation error.
 */
export class AstServiceMultiRepoGraphFederationError extends Error {
    /**
     * Stable machine-readable error code.
     */
    public readonly code: AstServiceMultiRepoGraphFederationErrorCode

    /**
     * Repository identifier when available.
     */
    public readonly repositoryId?: string

    /**
     * Branch value when available.
     */
    public readonly branch?: string

    /**
     * Idempotency key when available.
     */
    public readonly idempotencyKey?: string

    /**
     * Numeric value when available.
     */
    public readonly value?: number

    /**
     * Attempts count when available.
     */
    public readonly attempts?: number

    /**
     * Underlying error message when available.
     */
    public readonly causeMessage?: string

    /**
     * Creates typed multi-repo graph federation error.
     *
     * @param code Stable machine-readable error code.
     * @param details Structured error metadata.
     */
    public constructor(
        code: AstServiceMultiRepoGraphFederationErrorCode,
        details: IAstServiceMultiRepoGraphFederationErrorDetails = {},
    ) {
        super(createAstServiceMultiRepoGraphFederationErrorMessage(code, details))

        this.name = "AstServiceMultiRepoGraphFederationError"
        this.code = code
        this.repositoryId = details.repositoryId
        this.branch = details.branch
        this.idempotencyKey = details.idempotencyKey
        this.value = details.value
        this.attempts = details.attempts
        this.causeMessage = details.causeMessage
    }
}

/**
 * Builds stable public message for AST multi-repo federation failures.
 *
 * @param code Stable machine-readable error code.
 * @param details Structured error metadata.
 * @returns Stable public message.
 */
function createAstServiceMultiRepoGraphFederationErrorMessage(
    code: AstServiceMultiRepoGraphFederationErrorCode,
    details: IAstServiceMultiRepoGraphFederationErrorDetails,
): string {
    return AST_SERVICE_MULTI_REPO_GRAPH_FEDERATION_ERROR_MESSAGES[code](details)
}

const AST_SERVICE_MULTI_REPO_GRAPH_FEDERATION_ERROR_MESSAGES: Readonly<
    Record<
        AstServiceMultiRepoGraphFederationErrorCode,
        (details: IAstServiceMultiRepoGraphFederationErrorDetails) => string
    >
> = {
    DUPLICATE_REPOSITORY_ID: (details) =>
        `Duplicate repository id for AST graph federation: ${details.repositoryId ?? "<empty>"}`,
    EMPTY_REPOSITORIES: () => "AST graph federation requires at least one repository",
    INVALID_BRANCH: (details) =>
        `Invalid branch for AST graph federation: ${details.branch ?? "<empty>"}`,
    INVALID_CROSS_REPOSITORY_EDGE_THRESHOLD: (details) =>
        `Invalid cross repository edge threshold for AST graph federation: ${
            details.value ?? Number.NaN
        }`,
    INVALID_IDEMPOTENCY_CACHE_SIZE: (details) =>
        `Invalid idempotency cache size for AST graph federation: ${
            details.value ?? Number.NaN
        }`,
    INVALID_IDEMPOTENCY_KEY: (details) =>
        `Invalid idempotency key for AST graph federation: ${details.idempotencyKey ?? "<empty>"}`,
    INVALID_MAX_BACKOFF_MS: (details) =>
        `Invalid max backoff ms for AST graph federation: ${details.value ?? Number.NaN}`,
    INVALID_MAX_REPOSITORIES: (details) =>
        `Invalid max repositories value for AST graph federation: ${details.value ?? Number.NaN}`,
    INVALID_MIN_SHARED_NODE_NAME_LENGTH: (details) =>
        `Invalid min shared node name length for AST graph federation: ${
            details.value ?? Number.NaN
        }`,
    INVALID_REPOSITORY_ID: (details) =>
        `Invalid repository id for AST graph federation: ${details.repositoryId ?? "<empty>"}`,
    INVALID_RETRY_INITIAL_BACKOFF_MS: (details) =>
        `Invalid retry initial backoff ms for AST graph federation: ${
            details.value ?? Number.NaN
        }`,
    INVALID_RETRY_MAX_ATTEMPTS: (details) =>
        `Invalid retry max attempts for AST graph federation: ${details.value ?? Number.NaN}`,
    REPOSITORY_FETCH_FAILED: (details) =>
        `Failed to fetch graph for repository ${details.repositoryId ?? "<unknown>"}: ${
            details.causeMessage ?? "<unknown>"
        }`,
    RETRY_EXHAUSTED: (details) =>
        `AST graph federation retries exhausted for repository ${
            details.repositoryId ?? "<unknown>"
        } after ${details.attempts ?? 0} attempts: ${details.causeMessage ?? "<unknown>"}`,
}
