/**
 * Typed error codes for AST function similarity service.
 */
export const AST_FUNCTION_SIMILARITY_ERROR_CODE = {
    INVALID_FILE_PATH: "INVALID_FILE_PATH",
    INVALID_FUNCTION_NAME: "INVALID_FUNCTION_NAME",
    INVALID_MINIMUM_SIMILARITY: "INVALID_MINIMUM_SIMILARITY",
    INVALID_LLM_VALIDATION_RESULT: "INVALID_LLM_VALIDATION_RESULT",
    LLM_VALIDATION_FAILED: "LLM_VALIDATION_FAILED",
} as const

/**
 * AST function similarity error code literal.
 */
export type AstFunctionSimilarityErrorCode =
    (typeof AST_FUNCTION_SIMILARITY_ERROR_CODE)[keyof typeof AST_FUNCTION_SIMILARITY_ERROR_CODE]

/**
 * Structured metadata for AST function similarity failures.
 */
export interface IAstFunctionSimilarityErrorDetails {
    /**
     * Invalid repository-relative file path when available.
     */
    readonly filePath?: string

    /**
     * Invalid function name when available.
     */
    readonly functionName?: string

    /**
     * Invalid minimum similarity threshold when available.
     */
    readonly minimumSimilarity?: number

    /**
     * Stable failure reason.
     */
    readonly reason?: string
}

/**
 * Typed AST function similarity error with stable metadata.
 */
export class AstFunctionSimilarityError extends Error {
    /**
     * Stable machine-readable error code.
     */
    public readonly code: AstFunctionSimilarityErrorCode

    /**
     * Invalid repository-relative file path when available.
     */
    public readonly filePath?: string

    /**
     * Invalid function name when available.
     */
    public readonly functionName?: string

    /**
     * Invalid minimum similarity threshold when available.
     */
    public readonly minimumSimilarity?: number

    /**
     * Stable failure reason.
     */
    public readonly reason?: string

    /**
     * Creates typed AST function similarity error.
     *
     * @param code Stable machine-readable error code.
     * @param details Normalized error metadata.
     */
    public constructor(
        code: AstFunctionSimilarityErrorCode,
        details: IAstFunctionSimilarityErrorDetails = {},
    ) {
        super(createAstFunctionSimilarityErrorMessage(code, details))

        this.name = "AstFunctionSimilarityError"
        this.code = code
        this.filePath = details.filePath
        this.functionName = details.functionName
        this.minimumSimilarity = details.minimumSimilarity
        this.reason = details.reason
    }
}

/**
 * Builds stable public message for AST function similarity failures.
 *
 * @param code Stable machine-readable error code.
 * @param details Normalized error metadata.
 * @returns Stable public message.
 */
function createAstFunctionSimilarityErrorMessage(
    code: AstFunctionSimilarityErrorCode,
    details: IAstFunctionSimilarityErrorDetails,
): string {
    return AST_FUNCTION_SIMILARITY_ERROR_MESSAGES[code](details)
}

const AST_FUNCTION_SIMILARITY_ERROR_MESSAGES: Readonly<
    Record<AstFunctionSimilarityErrorCode, (details: IAstFunctionSimilarityErrorDetails) => string>
> = {
    INVALID_FILE_PATH: (details) =>
        `Invalid file path for AST function similarity: ${details.filePath ?? "<empty>"}`,
    INVALID_FUNCTION_NAME: (details) =>
        `Invalid function name for AST function similarity: ${details.functionName ?? "<empty>"}`,
    INVALID_MINIMUM_SIMILARITY: (details) =>
        `Invalid minimum similarity for AST function similarity: ${
            details.minimumSimilarity ?? Number.NaN
        }`,
    INVALID_LLM_VALIDATION_RESULT: (details) =>
        `Invalid LLM validation result for AST function similarity: ${
            details.reason ?? "<unknown>"
        }`,
    LLM_VALIDATION_FAILED: (details) =>
        `AST function similarity LLM validation failed: ${details.reason ?? "<unknown>"}`,
}
