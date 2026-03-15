/**
 * Typed error codes for AST cross-file analyzer base class.
 */
export const AST_CROSS_FILE_ANALYZER_ERROR_CODE = {
    DUPLICATE_FILE_PATH: "DUPLICATE_FILE_PATH",
    EMPTY_FILES: "EMPTY_FILES",
    EMPTY_FILE_PATHS: "EMPTY_FILE_PATHS",
    INVALID_FILE_PATH: "INVALID_FILE_PATH",
} as const

/**
 * AST cross-file analyzer error code literal.
 */
export type AstCrossFileAnalyzerErrorCode =
    (typeof AST_CROSS_FILE_ANALYZER_ERROR_CODE)[keyof typeof AST_CROSS_FILE_ANALYZER_ERROR_CODE]

/**
 * Structured metadata for AST cross-file analyzer failures.
 */
export interface IAstCrossFileAnalyzerErrorDetails {
    /**
     * Invalid or duplicate repository-relative file path when available.
     */
    readonly filePath?: string
}

/**
 * Typed AST cross-file analyzer error with stable metadata.
 */
export class AstCrossFileAnalyzerError extends Error {
    /**
     * Stable machine-readable error code.
     */
    public readonly code: AstCrossFileAnalyzerErrorCode

    /**
     * Invalid or duplicate repository-relative file path when available.
     */
    public readonly filePath?: string

    /**
     * Creates typed AST cross-file analyzer error.
     *
     * @param code Stable machine-readable error code.
     * @param details Normalized error metadata.
     */
    public constructor(
        code: AstCrossFileAnalyzerErrorCode,
        details: IAstCrossFileAnalyzerErrorDetails = {},
    ) {
        super(createAstCrossFileAnalyzerErrorMessage(code, details))

        this.name = "AstCrossFileAnalyzerError"
        this.code = code
        this.filePath = details.filePath
    }
}

/**
 * Builds stable public message for AST cross-file analyzer failures.
 *
 * @param code Stable machine-readable error code.
 * @param details Normalized error metadata.
 * @returns Stable public message.
 */
function createAstCrossFileAnalyzerErrorMessage(
    code: AstCrossFileAnalyzerErrorCode,
    details: IAstCrossFileAnalyzerErrorDetails,
): string {
    return AST_CROSS_FILE_ANALYZER_ERROR_MESSAGES[code](details)
}

const AST_CROSS_FILE_ANALYZER_ERROR_MESSAGES: Readonly<
    Record<AstCrossFileAnalyzerErrorCode, (details: IAstCrossFileAnalyzerErrorDetails) => string>
> = {
    DUPLICATE_FILE_PATH: (details) =>
        `Duplicate file path for AST cross-file analyzer: ${details.filePath ?? "<empty>"}`,
    EMPTY_FILES: () => "Parsed source file collection for AST cross-file analyzer cannot be empty",
    EMPTY_FILE_PATHS: () => "AST cross-file analyzer file path filter cannot be empty",
    INVALID_FILE_PATH: (details) =>
        `Invalid file path for AST cross-file analyzer: ${details.filePath ?? "<empty>"}`,
}
