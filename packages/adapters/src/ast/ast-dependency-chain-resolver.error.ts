/**
 * Typed error codes for AST dependency chain resolver.
 */
export const AST_DEPENDENCY_CHAIN_RESOLVER_ERROR_CODE = {
    EMPTY_START_FILE_PATHS: "EMPTY_START_FILE_PATHS",
    EMPTY_TARGET_FILE_PATHS: "EMPTY_TARGET_FILE_PATHS",
    INVALID_FILE_PATH: "INVALID_FILE_PATH",
    INVALID_MAX_CHAINS: "INVALID_MAX_CHAINS",
    INVALID_MAX_DEPTH: "INVALID_MAX_DEPTH",
} as const

/**
 * AST dependency chain resolver error code literal.
 */
export type AstDependencyChainResolverErrorCode =
    (typeof AST_DEPENDENCY_CHAIN_RESOLVER_ERROR_CODE)[keyof typeof AST_DEPENDENCY_CHAIN_RESOLVER_ERROR_CODE]

/**
 * Structured metadata for AST dependency chain resolver failures.
 */
export interface IAstDependencyChainResolverErrorDetails {
    /**
     * Invalid repository-relative file path when available.
     */
    readonly filePath?: string

    /**
     * Invalid max depth when available.
     */
    readonly maxDepth?: number

    /**
     * Invalid max chains when available.
     */
    readonly maxChains?: number
}

/**
 * Typed AST dependency chain resolver error with stable metadata.
 */
export class AstDependencyChainResolverError extends Error {
    /**
     * Stable machine-readable error code.
     */
    public readonly code: AstDependencyChainResolverErrorCode

    /**
     * Invalid repository-relative file path when available.
     */
    public readonly filePath?: string

    /**
     * Invalid max depth when available.
     */
    public readonly maxDepth?: number

    /**
     * Invalid max chains when available.
     */
    public readonly maxChains?: number

    /**
     * Creates typed AST dependency chain resolver error.
     *
     * @param code Stable machine-readable error code.
     * @param details Normalized error metadata.
     */
    public constructor(
        code: AstDependencyChainResolverErrorCode,
        details: IAstDependencyChainResolverErrorDetails = {},
    ) {
        super(createAstDependencyChainResolverErrorMessage(code, details))

        this.name = "AstDependencyChainResolverError"
        this.code = code
        this.filePath = details.filePath
        this.maxDepth = details.maxDepth
        this.maxChains = details.maxChains
    }
}

/**
 * Builds stable public message for AST dependency chain resolver failures.
 *
 * @param code Stable machine-readable error code.
 * @param details Normalized error metadata.
 * @returns Stable public message.
 */
function createAstDependencyChainResolverErrorMessage(
    code: AstDependencyChainResolverErrorCode,
    details: IAstDependencyChainResolverErrorDetails,
): string {
    return AST_DEPENDENCY_CHAIN_RESOLVER_ERROR_MESSAGES[code](details)
}

const AST_DEPENDENCY_CHAIN_RESOLVER_ERROR_MESSAGES: Readonly<
    Record<
        AstDependencyChainResolverErrorCode,
        (details: IAstDependencyChainResolverErrorDetails) => string
    >
> = {
    EMPTY_START_FILE_PATHS: () => "Dependency chain resolver start file path filter cannot be empty",
    EMPTY_TARGET_FILE_PATHS: () => "Dependency chain resolver target file path filter cannot be empty",
    INVALID_FILE_PATH: (details) =>
        `Invalid file path for dependency chain resolver: ${details.filePath ?? "<empty>"}`,
    INVALID_MAX_CHAINS: (details) =>
        `Invalid max chains for dependency chain resolver: ${details.maxChains ?? Number.NaN}`,
    INVALID_MAX_DEPTH: (details) =>
        `Invalid max depth for dependency chain resolver: ${details.maxDepth ?? Number.NaN}`,
}
