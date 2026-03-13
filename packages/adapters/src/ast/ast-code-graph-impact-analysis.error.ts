/**
 * Typed error codes for AST code graph impact analysis.
 */
export const AST_CODE_GRAPH_IMPACT_ANALYSIS_ERROR_CODE = {
    INVALID_DEPTH: "INVALID_DEPTH",
    INVALID_DIRECTION: "INVALID_DIRECTION",
    INVALID_FILE_PATH: "INVALID_FILE_PATH",
    EMPTY_CHANGED_FILE_PATHS: "EMPTY_CHANGED_FILE_PATHS",
} as const

/**
 * AST code graph impact analysis error code literal.
 */
export type AstCodeGraphImpactAnalysisErrorCode =
    (typeof AST_CODE_GRAPH_IMPACT_ANALYSIS_ERROR_CODE)[keyof typeof AST_CODE_GRAPH_IMPACT_ANALYSIS_ERROR_CODE]

/**
 * Structured metadata for AST code graph impact analysis failures.
 */
export interface IAstCodeGraphImpactAnalysisErrorDetails {
    /**
     * Invalid traversal depth when available.
     */
    readonly depth?: number

    /**
     * Invalid traversal direction when available.
     */
    readonly direction?: string

    /**
     * Invalid repository-relative file path when available.
     */
    readonly filePath?: string
}

/**
 * Typed AST code graph impact analysis error with stable metadata.
 */
export class AstCodeGraphImpactAnalysisError extends Error {
    /**
     * Stable machine-readable error code.
     */
    public readonly code: AstCodeGraphImpactAnalysisErrorCode

    /**
     * Invalid traversal depth when available.
     */
    public readonly depth?: number

    /**
     * Invalid traversal direction when available.
     */
    public readonly direction?: string

    /**
     * Invalid repository-relative file path when available.
     */
    public readonly filePath?: string

    /**
     * Creates typed impact analysis error.
     *
     * @param code Stable machine-readable error code.
     * @param details Normalized error metadata.
     */
    public constructor(
        code: AstCodeGraphImpactAnalysisErrorCode,
        details: IAstCodeGraphImpactAnalysisErrorDetails = {},
    ) {
        super(createAstCodeGraphImpactAnalysisErrorMessage(code, details))

        this.name = "AstCodeGraphImpactAnalysisError"
        this.code = code
        this.depth = details.depth
        this.direction = details.direction
        this.filePath = details.filePath
    }
}

/**
 * Builds stable public message for AST code graph impact analysis failures.
 *
 * @param code Stable machine-readable error code.
 * @param details Normalized error metadata.
 * @returns Stable public message.
 */
function createAstCodeGraphImpactAnalysisErrorMessage(
    code: AstCodeGraphImpactAnalysisErrorCode,
    details: IAstCodeGraphImpactAnalysisErrorDetails,
): string {
    if (code === AST_CODE_GRAPH_IMPACT_ANALYSIS_ERROR_CODE.INVALID_DEPTH) {
        return `Invalid traversal depth for AST code graph impact analysis: ${details.depth ?? Number.NaN}`
    }

    if (code === AST_CODE_GRAPH_IMPACT_ANALYSIS_ERROR_CODE.INVALID_DIRECTION) {
        return `Invalid traversal direction for AST code graph impact analysis: ${details.direction ?? "<empty>"}`
    }

    if (code === AST_CODE_GRAPH_IMPACT_ANALYSIS_ERROR_CODE.EMPTY_CHANGED_FILE_PATHS) {
        return "Changed file path set for AST code graph impact analysis cannot be empty"
    }

    return `Invalid file path for AST code graph impact analysis: ${details.filePath ?? "<empty>"}`
}
