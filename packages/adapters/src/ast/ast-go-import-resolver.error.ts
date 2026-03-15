/**
 * Typed error codes for AST Go import resolver.
 */
export const AST_GO_IMPORT_RESOLVER_ERROR_CODE = {
    INVALID_REPOSITORY_ROOT_PATH: "INVALID_REPOSITORY_ROOT_PATH",
    INVALID_WORKSPACE_PACKAGE_ROOT: "INVALID_WORKSPACE_PACKAGE_ROOT",
    INVALID_READ_FILE: "INVALID_READ_FILE",
    INVALID_READ_DIRECTORY: "INVALID_READ_DIRECTORY",
    INVALID_GO_MOD: "INVALID_GO_MOD",
    GO_MOD_READ_FAILED: "GO_MOD_READ_FAILED",
    GO_MOD_DISCOVERY_FAILED: "GO_MOD_DISCOVERY_FAILED",
    GO_PACKAGE_DISCOVERY_FAILED: "GO_PACKAGE_DISCOVERY_FAILED",
} as const

/**
 * AST Go import resolver error code literal.
 */
export type AstGoImportResolverErrorCode =
    (typeof AST_GO_IMPORT_RESOLVER_ERROR_CODE)[keyof typeof AST_GO_IMPORT_RESOLVER_ERROR_CODE]

/**
 * Structured metadata for Go import resolver failures.
 */
export interface IAstGoImportResolverErrorDetails {
    /**
     * Invalid repository root path when available.
     */
    readonly repositoryRootPath?: string

    /**
     * Invalid workspace package root when available.
     */
    readonly workspacePackageRoot?: string

    /**
     * Go module file path that failed to read or parse.
     */
    readonly goModPath?: string

    /**
     * Package directory path that failed to read.
     */
    readonly packageDirectoryPath?: string

    /**
     * Stable failure reason.
     */
    readonly reason?: string
}

/**
 * Typed Go import resolver error with stable metadata.
 */
export class AstGoImportResolverError extends Error {
    /**
     * Stable machine-readable error code.
     */
    public readonly code: AstGoImportResolverErrorCode

    /**
     * Invalid repository root path when available.
     */
    public readonly repositoryRootPath?: string

    /**
     * Invalid workspace package root when available.
     */
    public readonly workspacePackageRoot?: string

    /**
     * Go module file path that failed to read or parse.
     */
    public readonly goModPath?: string

    /**
     * Package directory path that failed to read.
     */
    public readonly packageDirectoryPath?: string

    /**
     * Stable failure reason.
     */
    public readonly reason?: string

    /**
     * Creates typed Go import resolver error.
     *
     * @param code Stable machine-readable error code.
     * @param details Normalized error metadata.
     */
    public constructor(
        code: AstGoImportResolverErrorCode,
        details: IAstGoImportResolverErrorDetails = {},
    ) {
        super(createAstGoImportResolverErrorMessage(code, details))

        this.name = "AstGoImportResolverError"
        this.code = code
        this.repositoryRootPath = details.repositoryRootPath
        this.workspacePackageRoot = details.workspacePackageRoot
        this.goModPath = details.goModPath
        this.packageDirectoryPath = details.packageDirectoryPath
        this.reason = details.reason
    }
}

/**
 * Builds stable public message for Go import resolver failures.
 *
 * @param code Stable machine-readable error code.
 * @param details Normalized error metadata.
 * @returns Stable public message.
 */
function createAstGoImportResolverErrorMessage(
    code: AstGoImportResolverErrorCode,
    details: IAstGoImportResolverErrorDetails,
): string {
    return AST_GO_IMPORT_RESOLVER_ERROR_MESSAGES[code](details)
}

const AST_GO_IMPORT_RESOLVER_ERROR_MESSAGES: Readonly<
    Record<AstGoImportResolverErrorCode, (details: IAstGoImportResolverErrorDetails) => string>
> = {
    INVALID_REPOSITORY_ROOT_PATH: (details) =>
        `Invalid repositoryRootPath for Go import resolver: ${
            details.repositoryRootPath ?? "<empty>"
        }`,
    INVALID_WORKSPACE_PACKAGE_ROOT: (details) =>
        `Invalid workspace package root for Go import resolver: ${
            details.workspacePackageRoot ?? "<empty>"
        }`,
    INVALID_READ_FILE: () => "Go import resolver readFile must be a function when provided",
    INVALID_READ_DIRECTORY: () =>
        "Go import resolver readDirectory must be a function when provided",
    INVALID_GO_MOD: (details) =>
        `Invalid go.mod payload for Go import resolver at ${details.goModPath ?? "<unknown>"}`,
    GO_MOD_READ_FAILED: (details) =>
        `Failed to read go.mod for Go import resolver at ${details.goModPath ?? "<unknown>"}: ${
            details.reason ?? "<unknown>"
        }`,
    GO_MOD_DISCOVERY_FAILED: (details) =>
        `Failed to discover Go modules for Go import resolver in ${
            details.packageDirectoryPath ?? "<unknown>"
        }: ${details.reason ?? "<unknown>"}`,
    GO_PACKAGE_DISCOVERY_FAILED: (details) =>
        `Failed to discover Go package files in ${details.packageDirectoryPath ?? "<unknown>"}: ${
            details.reason ?? "<unknown>"
        }`,
}
