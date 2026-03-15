/**
 * Typed error codes for AST monorepo package boundary checker.
 */
export const AST_MONOREPO_PACKAGE_BOUNDARY_CHECKER_ERROR_CODE = {
    EMPTY_FILES: "EMPTY_FILES",
    EMPTY_FILE_PATHS: "EMPTY_FILE_PATHS",
    INVALID_FILE_PATH: "INVALID_FILE_PATH",
    DUPLICATE_FILE_PATH: "DUPLICATE_FILE_PATH",
    INVALID_MAX_VIOLATIONS: "INVALID_MAX_VIOLATIONS",
    INVALID_PACKAGE_ALIAS_PREFIX: "INVALID_PACKAGE_ALIAS_PREFIX",
    INVALID_PACKAGE_NAME: "INVALID_PACKAGE_NAME",
} as const

/**
 * AST monorepo package boundary checker error code literal.
 */
export type AstMonorepoPackageBoundaryCheckerErrorCode =
    (typeof AST_MONOREPO_PACKAGE_BOUNDARY_CHECKER_ERROR_CODE)[keyof typeof AST_MONOREPO_PACKAGE_BOUNDARY_CHECKER_ERROR_CODE]

/**
 * Structured metadata for AST monorepo package boundary checker failures.
 */
export interface IAstMonorepoPackageBoundaryCheckerErrorDetails {
    /**
     * Invalid repository-relative file path when available.
     */
    readonly filePath?: string

    /**
     * Invalid max violations value when available.
     */
    readonly maxViolations?: number

    /**
     * Invalid package alias prefix when available.
     */
    readonly packageAliasPrefix?: string

    /**
     * Invalid package name when available.
     */
    readonly packageName?: string
}

/**
 * Typed AST monorepo package boundary checker error with stable metadata.
 */
export class AstMonorepoPackageBoundaryCheckerError extends Error {
    /**
     * Stable machine-readable error code.
     */
    public readonly code: AstMonorepoPackageBoundaryCheckerErrorCode

    /**
     * Invalid repository-relative file path when available.
     */
    public readonly filePath?: string

    /**
     * Invalid max violations value when available.
     */
    public readonly maxViolations?: number

    /**
     * Invalid package alias prefix when available.
     */
    public readonly packageAliasPrefix?: string

    /**
     * Invalid package name when available.
     */
    public readonly packageName?: string

    /**
     * Creates typed AST monorepo package boundary checker error.
     *
     * @param code Stable machine-readable error code.
     * @param details Normalized error metadata.
     */
    public constructor(
        code: AstMonorepoPackageBoundaryCheckerErrorCode,
        details: IAstMonorepoPackageBoundaryCheckerErrorDetails = {},
    ) {
        super(createAstMonorepoPackageBoundaryCheckerErrorMessage(code, details))

        this.name = "AstMonorepoPackageBoundaryCheckerError"
        this.code = code
        this.filePath = details.filePath
        this.maxViolations = details.maxViolations
        this.packageAliasPrefix = details.packageAliasPrefix
        this.packageName = details.packageName
    }
}

/**
 * Builds stable public message for AST monorepo package boundary checker failures.
 *
 * @param code Stable machine-readable error code.
 * @param details Normalized error metadata.
 * @returns Stable public message.
 */
function createAstMonorepoPackageBoundaryCheckerErrorMessage(
    code: AstMonorepoPackageBoundaryCheckerErrorCode,
    details: IAstMonorepoPackageBoundaryCheckerErrorDetails,
): string {
    return AST_MONOREPO_PACKAGE_BOUNDARY_CHECKER_ERROR_MESSAGES[code](details)
}

const AST_MONOREPO_PACKAGE_BOUNDARY_CHECKER_ERROR_MESSAGES: Readonly<
    Record<
        AstMonorepoPackageBoundaryCheckerErrorCode,
        (details: IAstMonorepoPackageBoundaryCheckerErrorDetails) => string
    >
> = {
    EMPTY_FILES: () => "Monorepo package boundary checker parsed file collection cannot be empty",
    EMPTY_FILE_PATHS: () => "Monorepo package boundary checker file path filter cannot be empty",
    INVALID_FILE_PATH: (details) =>
        `Invalid file path for monorepo package boundary checker: ${details.filePath ?? "<empty>"}`,
    DUPLICATE_FILE_PATH: (details) =>
        `Duplicate file path for monorepo package boundary checker: ${details.filePath ?? "<empty>"}`,
    INVALID_MAX_VIOLATIONS: (details) =>
        `Invalid max violations for monorepo package boundary checker: ${
            details.maxViolations ?? Number.NaN
        }`,
    INVALID_PACKAGE_ALIAS_PREFIX: (details) =>
        `Invalid package alias prefix for monorepo package boundary checker: ${
            details.packageAliasPrefix ?? "<empty>"
        }`,
    INVALID_PACKAGE_NAME: (details) =>
        `Invalid package name for monorepo package boundary checker: ${details.packageName ?? "<empty>"}`,
}
