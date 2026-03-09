/**
 * Machine-readable AST parser error codes.
 */
export const AST_PARSER_ERROR_CODE = {
    INVALID_FILE_PATH: "INVALID_FILE_PATH",
    INVALID_SOURCE_CONTENT: "INVALID_SOURCE_CONTENT",
    PARSE_FAILED: "PARSE_FAILED",
} as const

/**
 * AST parser error code.
 */
export type AstParserErrorCode =
    (typeof AST_PARSER_ERROR_CODE)[keyof typeof AST_PARSER_ERROR_CODE]

/**
 * Normalized AST parser error metadata.
 */
export interface IAstParserErrorDetails {
    /**
     * Machine-readable error code.
     */
    readonly code: AstParserErrorCode

    /**
     * File path associated with parser failure.
     */
    readonly filePath?: string
}

/**
 * Error thrown by AST parser adapters.
 */
export class AstParserError extends Error {
    /**
     * Machine-readable error code.
     */
    public readonly code: AstParserErrorCode

    /**
     * File path associated with parser failure.
     */
    public readonly filePath?: string

    /**
     * Creates AST parser error.
     *
     * @param message Human-readable error message.
     * @param details Normalized error details.
     */
    public constructor(message: string, details: IAstParserErrorDetails) {
        super(message)
        this.name = "AstParserError"
        this.code = details.code
        this.filePath = details.filePath
    }
}
