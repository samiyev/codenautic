/**
 * Typed error codes for AST function body extractor.
 */
export const AST_FUNCTION_BODY_EXTRACTOR_ERROR_CODE = {
    DUPLICATE_FUNCTION_REFERENCE: "DUPLICATE_FUNCTION_REFERENCE",
    EMPTY_FUNCTIONS: "EMPTY_FUNCTIONS",
    INVALID_FILE_PATH: "INVALID_FILE_PATH",
    INVALID_FUNCTION_NAME: "INVALID_FUNCTION_NAME",
    INVALID_FUNCTION_RANGE: "INVALID_FUNCTION_RANGE",
    INVALID_SOURCE_CODE: "INVALID_SOURCE_CODE",
} as const

/**
 * AST function body extractor error code literal.
 */
export type AstFunctionBodyExtractorErrorCode =
    (typeof AST_FUNCTION_BODY_EXTRACTOR_ERROR_CODE)[keyof typeof AST_FUNCTION_BODY_EXTRACTOR_ERROR_CODE]

/**
 * Structured metadata for AST function body extractor failures.
 */
export interface IAstFunctionBodyExtractorErrorDetails {
    /**
     * Repository-relative file path when available.
     */
    readonly filePath?: string

    /**
     * Function name when available.
     */
    readonly functionName?: string

    /**
     * Function reference id when available.
     */
    readonly functionId?: string

    /**
     * Invalid function start line when available.
     */
    readonly lineStart?: number

    /**
     * Invalid function end line when available.
     */
    readonly lineEnd?: number
}

/**
 * Typed AST function body extractor error with stable metadata.
 */
export class AstFunctionBodyExtractorError extends Error {
    /**
     * Stable machine-readable error code.
     */
    public readonly code: AstFunctionBodyExtractorErrorCode

    /**
     * Repository-relative file path when available.
     */
    public readonly filePath?: string

    /**
     * Function name when available.
     */
    public readonly functionName?: string

    /**
     * Function reference id when available.
     */
    public readonly functionId?: string

    /**
     * Invalid function start line when available.
     */
    public readonly lineStart?: number

    /**
     * Invalid function end line when available.
     */
    public readonly lineEnd?: number

    /**
     * Creates typed AST function body extractor error.
     *
     * @param code Stable machine-readable error code.
     * @param details Normalized error metadata.
     */
    public constructor(
        code: AstFunctionBodyExtractorErrorCode,
        details: IAstFunctionBodyExtractorErrorDetails = {},
    ) {
        super(createAstFunctionBodyExtractorErrorMessage(code, details))

        this.name = "AstFunctionBodyExtractorError"
        this.code = code
        this.filePath = details.filePath
        this.functionName = details.functionName
        this.functionId = details.functionId
        this.lineStart = details.lineStart
        this.lineEnd = details.lineEnd
    }
}

/**
 * Builds stable public message for AST function body extractor failures.
 *
 * @param code Stable machine-readable error code.
 * @param details Normalized error metadata.
 * @returns Stable public message.
 */
function createAstFunctionBodyExtractorErrorMessage(
    code: AstFunctionBodyExtractorErrorCode,
    details: IAstFunctionBodyExtractorErrorDetails,
): string {
    return AST_FUNCTION_BODY_EXTRACTOR_ERROR_MESSAGES[code](details)
}

const AST_FUNCTION_BODY_EXTRACTOR_ERROR_MESSAGES: Readonly<
    Record<
        AstFunctionBodyExtractorErrorCode,
        (details: IAstFunctionBodyExtractorErrorDetails) => string
    >
> = {
    DUPLICATE_FUNCTION_REFERENCE: (details) =>
        `Duplicate function reference for function body extractor: ${
            details.functionId ?? "<empty>"
        }`,
    EMPTY_FUNCTIONS: () => "Function body extractor requires at least one function declaration",
    INVALID_FILE_PATH: (details) =>
        `Invalid file path for function body extractor: ${details.filePath ?? "<empty>"}`,
    INVALID_FUNCTION_NAME: (details) =>
        `Invalid function name for function body extractor: ${details.functionName ?? "<empty>"}`,
    INVALID_FUNCTION_RANGE: (details) =>
        `Invalid function range for function body extractor: ${
            details.lineStart ?? Number.NaN
        }-${details.lineEnd ?? Number.NaN}`,
    INVALID_SOURCE_CODE: () => "Function body extractor source code must be a non-empty string",
}
