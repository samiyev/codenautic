/**
 * Typed error codes for AST cyclomatic complexity calculator.
 */
export const AST_CYCLOMATIC_COMPLEXITY_ERROR_CODE = {
    DUPLICATE_FILE_PATH: "DUPLICATE_FILE_PATH",
    EMPTY_FILES: "EMPTY_FILES",
    EMPTY_FILE_PATH_FILTER: "EMPTY_FILE_PATH_FILTER",
    INVALID_FILE_PATH: "INVALID_FILE_PATH",
    INVALID_LANGUAGE: "INVALID_LANGUAGE",
    INVALID_SOURCE_CODE: "INVALID_SOURCE_CODE",
} as const

/**
 * AST cyclomatic complexity calculator error code literal.
 */
export type AstCyclomaticComplexityErrorCode =
    (typeof AST_CYCLOMATIC_COMPLEXITY_ERROR_CODE)[keyof typeof AST_CYCLOMATIC_COMPLEXITY_ERROR_CODE]

/**
 * Structured metadata for AST cyclomatic complexity calculator failures.
 */
export interface IAstCyclomaticComplexityErrorDetails {
    /**
     * Repository-relative file path when available.
     */
    readonly filePath?: string

    /**
     * Language label when available.
     */
    readonly language?: string
}

/**
 * Typed AST cyclomatic complexity calculator error.
 */
export class AstCyclomaticComplexityError extends Error {
    /**
     * Stable machine-readable error code.
     */
    public readonly code: AstCyclomaticComplexityErrorCode

    /**
     * Repository-relative file path when available.
     */
    public readonly filePath?: string

    /**
     * Language label when available.
     */
    public readonly language?: string

    /**
     * Creates typed AST cyclomatic complexity calculator error.
     *
     * @param code Stable machine-readable error code.
     * @param details Structured error metadata.
     */
    public constructor(
        code: AstCyclomaticComplexityErrorCode,
        details: IAstCyclomaticComplexityErrorDetails = {},
    ) {
        super(createAstCyclomaticComplexityErrorMessage(code, details))

        this.name = "AstCyclomaticComplexityError"
        this.code = code
        this.filePath = details.filePath
        this.language = details.language
    }
}

/**
 * Builds stable public message for AST cyclomatic complexity failures.
 *
 * @param code Stable machine-readable error code.
 * @param details Structured error metadata.
 * @returns Stable public message.
 */
function createAstCyclomaticComplexityErrorMessage(
    code: AstCyclomaticComplexityErrorCode,
    details: IAstCyclomaticComplexityErrorDetails,
): string {
    return AST_CYCLOMATIC_COMPLEXITY_ERROR_MESSAGES[code](details)
}

const AST_CYCLOMATIC_COMPLEXITY_ERROR_MESSAGES: Readonly<
    Record<AstCyclomaticComplexityErrorCode, (details: IAstCyclomaticComplexityErrorDetails) => string>
> = {
    DUPLICATE_FILE_PATH: (details) =>
        `Duplicate file path for cyclomatic complexity calculator: ${details.filePath ?? "<empty>"}`,
    EMPTY_FILES: () => "Cyclomatic complexity calculator requires at least one source file",
    EMPTY_FILE_PATH_FILTER: () => "Cyclomatic complexity file path filter cannot be empty",
    INVALID_FILE_PATH: (details) =>
        `Invalid file path for cyclomatic complexity calculator: ${details.filePath ?? "<empty>"}`,
    INVALID_LANGUAGE: (details) =>
        `Invalid language for cyclomatic complexity calculator: ${details.language ?? "<empty>"}`,
    INVALID_SOURCE_CODE: (details) =>
        `Invalid source code for cyclomatic complexity calculator file: ${
            details.filePath ?? "<empty>"
        }`,
}
