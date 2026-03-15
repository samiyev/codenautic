/**
 * Typed error codes for AST Python import resolver.
 */
export const AST_PYTHON_IMPORT_RESOLVER_ERROR_CODE = {
    INVALID_REPOSITORY_ROOT_PATH: "INVALID_REPOSITORY_ROOT_PATH",
    INVALID_PYTHON_PATH_ROOT: "INVALID_PYTHON_PATH_ROOT",
    INVALID_WORKSPACE_PACKAGE_ROOT: "INVALID_WORKSPACE_PACKAGE_ROOT",
    INVALID_READ_DIRECTORY: "INVALID_READ_DIRECTORY",
    PYTHON_PATH_DISCOVERY_FAILED: "PYTHON_PATH_DISCOVERY_FAILED",
} as const

/**
 * AST Python import resolver error code literal.
 */
export type AstPythonImportResolverErrorCode =
    (typeof AST_PYTHON_IMPORT_RESOLVER_ERROR_CODE)[keyof typeof AST_PYTHON_IMPORT_RESOLVER_ERROR_CODE]

/**
 * Structured metadata for Python import resolver failures.
 */
export interface IAstPythonImportResolverErrorDetails {
    /**
     * Invalid repository root path when available.
     */
    readonly repositoryRootPath?: string

    /**
     * Invalid PYTHONPATH root when available.
     */
    readonly pythonPathRoot?: string

    /**
     * Invalid workspace package root when available.
     */
    readonly workspacePackageRoot?: string

    /**
     * Directory path that failed to read.
     */
    readonly directoryPath?: string

    /**
     * Stable failure reason.
     */
    readonly reason?: string
}

/**
 * Typed Python import resolver error with stable metadata.
 */
export class AstPythonImportResolverError extends Error {
    /**
     * Stable machine-readable error code.
     */
    public readonly code: AstPythonImportResolverErrorCode

    /**
     * Invalid repository root path when available.
     */
    public readonly repositoryRootPath?: string

    /**
     * Invalid PYTHONPATH root when available.
     */
    public readonly pythonPathRoot?: string

    /**
     * Invalid workspace package root when available.
     */
    public readonly workspacePackageRoot?: string

    /**
     * Directory path that failed to read.
     */
    public readonly directoryPath?: string

    /**
     * Stable failure reason.
     */
    public readonly reason?: string

    /**
     * Creates typed Python import resolver error.
     *
     * @param code Stable machine-readable error code.
     * @param details Normalized error metadata.
     */
    public constructor(
        code: AstPythonImportResolverErrorCode,
        details: IAstPythonImportResolverErrorDetails = {},
    ) {
        super(createAstPythonImportResolverErrorMessage(code, details))

        this.name = "AstPythonImportResolverError"
        this.code = code
        this.repositoryRootPath = details.repositoryRootPath
        this.pythonPathRoot = details.pythonPathRoot
        this.workspacePackageRoot = details.workspacePackageRoot
        this.directoryPath = details.directoryPath
        this.reason = details.reason
    }
}

/**
 * Builds stable public message for Python import resolver failures.
 *
 * @param code Stable machine-readable error code.
 * @param details Normalized error metadata.
 * @returns Stable public message.
 */
function createAstPythonImportResolverErrorMessage(
    code: AstPythonImportResolverErrorCode,
    details: IAstPythonImportResolverErrorDetails,
): string {
    return AST_PYTHON_IMPORT_RESOLVER_ERROR_MESSAGES[code](details)
}

const AST_PYTHON_IMPORT_RESOLVER_ERROR_MESSAGES: Readonly<
    Record<AstPythonImportResolverErrorCode, (details: IAstPythonImportResolverErrorDetails) => string>
> = {
    INVALID_REPOSITORY_ROOT_PATH: (details) =>
        `Invalid repositoryRootPath for Python import resolver: ${
            details.repositoryRootPath ?? "<empty>"
        }`,
    INVALID_PYTHON_PATH_ROOT: (details) =>
        `Invalid PYTHONPATH root for Python import resolver: ${details.pythonPathRoot ?? "<empty>"}`,
    INVALID_WORKSPACE_PACKAGE_ROOT: (details) =>
        `Invalid workspace package root for Python import resolver: ${
            details.workspacePackageRoot ?? "<empty>"
        }`,
    INVALID_READ_DIRECTORY: () =>
        "Python import resolver readDirectory must be a function when provided",
    PYTHON_PATH_DISCOVERY_FAILED: (details) =>
        `Failed to discover Python path roots in ${details.directoryPath ?? "<unknown>"}: ${
            details.reason ?? "<unknown>"
        }`,
}
