/**
 * Typed error codes for AST TypeScript import resolver.
 */
export const AST_TYPESCRIPT_IMPORT_RESOLVER_ERROR_CODE = {
    INVALID_REPOSITORY_ROOT_PATH: "INVALID_REPOSITORY_ROOT_PATH",
    INVALID_WORKSPACE_PACKAGE_ROOT: "INVALID_WORKSPACE_PACKAGE_ROOT",
    INVALID_READ_FILE: "INVALID_READ_FILE",
    INVALID_READ_DIRECTORY: "INVALID_READ_DIRECTORY",
    INVALID_TS_CONFIG: "INVALID_TS_CONFIG",
    INVALID_PACKAGE_MANIFEST: "INVALID_PACKAGE_MANIFEST",
    TS_CONFIG_READ_FAILED: "TS_CONFIG_READ_FAILED",
    PACKAGE_MANIFEST_READ_FAILED: "PACKAGE_MANIFEST_READ_FAILED",
} as const

/**
 * AST TypeScript import resolver error code literal.
 */
export type AstTypeScriptImportResolverErrorCode =
    (typeof AST_TYPESCRIPT_IMPORT_RESOLVER_ERROR_CODE)[keyof typeof AST_TYPESCRIPT_IMPORT_RESOLVER_ERROR_CODE]

/**
 * Structured metadata for TypeScript import resolver failures.
 */
export interface IAstTypeScriptImportResolverErrorDetails {
    /**
     * Invalid repository root path when available.
     */
    readonly repositoryRootPath?: string

    /**
     * Invalid workspace package root when available.
     */
    readonly workspacePackageRoot?: string

    /**
     * Target file path that failed to load.
     */
    readonly filePath?: string

    /**
     * Stable failure reason.
     */
    readonly reason?: string
}

/**
 * Typed TypeScript import resolver error with stable metadata.
 */
export class AstTypeScriptImportResolverError extends Error {
    /**
     * Stable machine-readable error code.
     */
    public readonly code: AstTypeScriptImportResolverErrorCode

    /**
     * Invalid repository root path when available.
     */
    public readonly repositoryRootPath?: string

    /**
     * Invalid workspace package root when available.
     */
    public readonly workspacePackageRoot?: string

    /**
     * Target file path that failed to load.
     */
    public readonly filePath?: string

    /**
     * Stable failure reason.
     */
    public readonly reason?: string

    /**
     * Creates typed TypeScript import resolver error.
     *
     * @param code Stable machine-readable error code.
     * @param details Normalized error metadata.
     */
    public constructor(
        code: AstTypeScriptImportResolverErrorCode,
        details: IAstTypeScriptImportResolverErrorDetails = {},
    ) {
        super(createAstTypeScriptImportResolverErrorMessage(code, details))

        this.name = "AstTypeScriptImportResolverError"
        this.code = code
        this.repositoryRootPath = details.repositoryRootPath
        this.workspacePackageRoot = details.workspacePackageRoot
        this.filePath = details.filePath
        this.reason = details.reason
    }
}

/**
 * Builds stable public message for TypeScript import resolver failures.
 *
 * @param code Stable machine-readable error code.
 * @param details Normalized error metadata.
 * @returns Stable public message.
 */
function createAstTypeScriptImportResolverErrorMessage(
    code: AstTypeScriptImportResolverErrorCode,
    details: IAstTypeScriptImportResolverErrorDetails,
): string {
    return AST_TYPESCRIPT_IMPORT_RESOLVER_ERROR_MESSAGES[code](details)
}

const AST_TYPESCRIPT_IMPORT_RESOLVER_ERROR_MESSAGES: Readonly<
    Record<
        AstTypeScriptImportResolverErrorCode,
        (details: IAstTypeScriptImportResolverErrorDetails) => string
    >
> = {
    INVALID_REPOSITORY_ROOT_PATH: (details) =>
        `Invalid repositoryRootPath for TypeScript import resolver: ${
            details.repositoryRootPath ?? "<empty>"
        }`,
    INVALID_WORKSPACE_PACKAGE_ROOT: (details) =>
        `Invalid workspace package root for TypeScript import resolver: ${
            details.workspacePackageRoot ?? "<empty>"
        }`,
    INVALID_READ_FILE: () => "TypeScript import resolver readFile must be a function when provided",
    INVALID_READ_DIRECTORY: () =>
        "TypeScript import resolver readDirectory must be a function when provided",
    INVALID_TS_CONFIG: (details) =>
        `Invalid tsconfig payload for TypeScript import resolver at ${
            details.filePath ?? "<unknown>"
        }`,
    INVALID_PACKAGE_MANIFEST: (details) =>
        `Invalid package.json payload for TypeScript import resolver at ${
            details.filePath ?? "<unknown>"
        }`,
    TS_CONFIG_READ_FAILED: (details) =>
        `Failed to read tsconfig for TypeScript import resolver at ${
            details.filePath ?? "<unknown>"
        }: ${details.reason ?? "<unknown>"}`,
    PACKAGE_MANIFEST_READ_FAILED: (details) =>
        `Failed to read package manifest for TypeScript import resolver at ${
            details.filePath ?? "<unknown>"
        }: ${details.reason ?? "<unknown>"}`,
}
