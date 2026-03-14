/**
 * Typed error codes for AST-based code deduplication.
 */
export const AST_CODE_DEDUPLICATION_ERROR_CODE = {
    DUPLICATE_FILE_PATH: "DUPLICATE_FILE_PATH",
    EMPTY_FILES: "EMPTY_FILES",
    EMPTY_FILE_PATHS: "EMPTY_FILE_PATHS",
    INVALID_FILE_PATH: "INVALID_FILE_PATH",
    INVALID_MINIMUM_FEATURE_COUNT: "INVALID_MINIMUM_FEATURE_COUNT",
    INVALID_MINIMUM_SIMILARITY: "INVALID_MINIMUM_SIMILARITY",
} as const

/**
 * AST code deduplication error code literal.
 */
export type AstCodeDeduplicationErrorCode =
    (typeof AST_CODE_DEDUPLICATION_ERROR_CODE)[keyof typeof AST_CODE_DEDUPLICATION_ERROR_CODE]

/**
 * Structured metadata for AST code deduplication failures.
 */
export interface IAstCodeDeduplicationErrorDetails {
    /**
     * Invalid or duplicate repository-relative file path when available.
     */
    readonly filePath?: string

    /**
     * Invalid similarity threshold when available.
     */
    readonly minimumSimilarity?: number

    /**
     * Invalid minimum feature count threshold when available.
     */
    readonly minimumFeatureCount?: number
}

/**
 * Typed AST code deduplication error with stable metadata.
 */
export class AstCodeDeduplicationError extends Error {
    /**
     * Stable machine-readable error code.
     */
    public readonly code: AstCodeDeduplicationErrorCode

    /**
     * Invalid or duplicate repository-relative file path when available.
     */
    public readonly filePath?: string

    /**
     * Invalid similarity threshold when available.
     */
    public readonly minimumSimilarity?: number

    /**
     * Invalid minimum feature count threshold when available.
     */
    public readonly minimumFeatureCount?: number

    /**
     * Creates typed AST code deduplication error.
     *
     * @param code Stable machine-readable error code.
     * @param details Normalized error metadata.
     */
    public constructor(
        code: AstCodeDeduplicationErrorCode,
        details: IAstCodeDeduplicationErrorDetails = {},
    ) {
        super(createAstCodeDeduplicationErrorMessage(code, details))

        this.name = "AstCodeDeduplicationError"
        this.code = code
        this.filePath = details.filePath
        this.minimumSimilarity = details.minimumSimilarity
        this.minimumFeatureCount = details.minimumFeatureCount
    }
}

/**
 * Builds stable public message for AST code deduplication failures.
 *
 * @param code Stable machine-readable error code.
 * @param details Normalized error metadata.
 * @returns Stable public message.
 */
function createAstCodeDeduplicationErrorMessage(
    code: AstCodeDeduplicationErrorCode,
    details: IAstCodeDeduplicationErrorDetails,
): string {
    return AST_CODE_DEDUPLICATION_ERROR_MESSAGES[code](details)
}

const AST_CODE_DEDUPLICATION_ERROR_MESSAGES: Readonly<
    Record<AstCodeDeduplicationErrorCode, (details: IAstCodeDeduplicationErrorDetails) => string>
> = {
    DUPLICATE_FILE_PATH: (details) =>
        `Duplicate file path for AST code deduplication: ${details.filePath ?? "<empty>"}`,
    EMPTY_FILES: () => "Parsed source file collection for AST code deduplication cannot be empty",
    EMPTY_FILE_PATHS: () => "AST code deduplication file path filter cannot be empty",
    INVALID_FILE_PATH: (details) =>
        `Invalid file path for AST code deduplication: ${details.filePath ?? "<empty>"}`,
    INVALID_MINIMUM_FEATURE_COUNT: (details) =>
        `Invalid minimum feature count for AST code deduplication: ${
            details.minimumFeatureCount ?? Number.NaN
        }`,
    INVALID_MINIMUM_SIMILARITY: (details) =>
        `Invalid minimum similarity for AST code deduplication: ${
            details.minimumSimilarity ?? Number.NaN
        }`,
}
