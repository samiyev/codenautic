/**
 * Typed error codes for AST Java import resolver.
 */
export const AST_JAVA_IMPORT_RESOLVER_ERROR_CODE = {
    INVALID_REPOSITORY_ROOT_PATH: "INVALID_REPOSITORY_ROOT_PATH",
    INVALID_WORKSPACE_PACKAGE_ROOT: "INVALID_WORKSPACE_PACKAGE_ROOT",
    INVALID_CLASS_PATH_ROOT: "INVALID_CLASS_PATH_ROOT",
    INVALID_READ_FILE: "INVALID_READ_FILE",
    INVALID_READ_DIRECTORY: "INVALID_READ_DIRECTORY",
    INVALID_POM: "INVALID_POM",
    POM_READ_FAILED: "POM_READ_FAILED",
    POM_DISCOVERY_FAILED: "POM_DISCOVERY_FAILED",
    PACKAGE_DISCOVERY_FAILED: "PACKAGE_DISCOVERY_FAILED",
} as const

/**
 * AST Java import resolver error code literal.
 */
export type AstJavaImportResolverErrorCode =
    (typeof AST_JAVA_IMPORT_RESOLVER_ERROR_CODE)[keyof typeof AST_JAVA_IMPORT_RESOLVER_ERROR_CODE]

/**
 * Structured metadata for Java import resolver failures.
 */
export interface IAstJavaImportResolverErrorDetails {
    /**
     * Invalid repository root path when available.
     */
    readonly repositoryRootPath?: string

    /**
     * Invalid workspace package root when available.
     */
    readonly workspacePackageRoot?: string

    /**
     * Invalid classpath root when available.
     */
    readonly classPathRoot?: string

    /**
     * pom.xml path when available.
     */
    readonly pomPath?: string

    /**
     * Package directory path when available.
     */
    readonly packageDirectoryPath?: string

    /**
     * Stable failure reason.
     */
    readonly reason?: string
}

/**
 * Typed Java import resolver error with stable metadata.
 */
export class AstJavaImportResolverError extends Error {
    /**
     * Stable machine-readable error code.
     */
    public readonly code: AstJavaImportResolverErrorCode

    /**
     * Invalid repository root path when available.
     */
    public readonly repositoryRootPath?: string

    /**
     * Invalid workspace package root when available.
     */
    public readonly workspacePackageRoot?: string

    /**
     * Invalid classpath root when available.
     */
    public readonly classPathRoot?: string

    /**
     * pom.xml path when available.
     */
    public readonly pomPath?: string

    /**
     * Package directory path when available.
     */
    public readonly packageDirectoryPath?: string

    /**
     * Stable failure reason.
     */
    public readonly reason?: string

    /**
     * Creates typed Java import resolver error.
     *
     * @param code Stable machine-readable error code.
     * @param details Normalized error metadata.
     */
    public constructor(
        code: AstJavaImportResolverErrorCode,
        details: IAstJavaImportResolverErrorDetails = {},
    ) {
        super(createAstJavaImportResolverErrorMessage(code, details))

        this.name = "AstJavaImportResolverError"
        this.code = code
        this.repositoryRootPath = details.repositoryRootPath
        this.workspacePackageRoot = details.workspacePackageRoot
        this.classPathRoot = details.classPathRoot
        this.pomPath = details.pomPath
        this.packageDirectoryPath = details.packageDirectoryPath
        this.reason = details.reason
    }
}

/**
 * Builds stable public message for Java import resolver failures.
 *
 * @param code Stable machine-readable error code.
 * @param details Normalized error metadata.
 * @returns Stable public message.
 */
function createAstJavaImportResolverErrorMessage(
    code: AstJavaImportResolverErrorCode,
    details: IAstJavaImportResolverErrorDetails,
): string {
    return AST_JAVA_IMPORT_RESOLVER_ERROR_MESSAGES[code](details)
}

const AST_JAVA_IMPORT_RESOLVER_ERROR_MESSAGES: Readonly<
    Record<AstJavaImportResolverErrorCode, (details: IAstJavaImportResolverErrorDetails) => string>
> = {
    INVALID_REPOSITORY_ROOT_PATH: (details) =>
        `Invalid repositoryRootPath for Java import resolver: ${
            details.repositoryRootPath ?? "<empty>"
        }`,
    INVALID_WORKSPACE_PACKAGE_ROOT: (details) =>
        `Invalid workspace package root for Java import resolver: ${
            details.workspacePackageRoot ?? "<empty>"
        }`,
    INVALID_CLASS_PATH_ROOT: (details) =>
        `Invalid classpath root for Java import resolver: ${details.classPathRoot ?? "<empty>"}`,
    INVALID_READ_FILE: () => "Java import resolver readFile must be a function when provided",
    INVALID_READ_DIRECTORY: () =>
        "Java import resolver readDirectory must be a function when provided",
    INVALID_POM: (details) =>
        `Invalid pom.xml payload for Java import resolver at ${details.pomPath ?? "<unknown>"}`,
    POM_READ_FAILED: (details) =>
        `Failed to read pom.xml for Java import resolver at ${details.pomPath ?? "<unknown>"}: ${
            details.reason ?? "<unknown>"
        }`,
    POM_DISCOVERY_FAILED: (details) =>
        `Failed to discover pom.xml files for Java import resolver in ${
            details.packageDirectoryPath ?? "<unknown>"
        }: ${details.reason ?? "<unknown>"}`,
    PACKAGE_DISCOVERY_FAILED: (details) =>
        `Failed to discover Java package files in ${details.packageDirectoryPath ?? "<unknown>"}: ${
            details.reason ?? "<unknown>"
        }`,
}
