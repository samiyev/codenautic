/**
 * Typed error codes for AST type flow analyzer.
 */
export const AST_TYPE_FLOW_ANALYZER_ERROR_CODE = {
    EMPTY_FILE_PATHS: "EMPTY_FILE_PATHS",
    INVALID_FILE_PATH: "INVALID_FILE_PATH",
    INVALID_MINIMUM_CONFIDENCE: "INVALID_MINIMUM_CONFIDENCE",
    INVALID_MAX_FLOWS: "INVALID_MAX_FLOWS",
} as const

/**
 * AST type flow analyzer error code literal.
 */
export type AstTypeFlowAnalyzerErrorCode =
    (typeof AST_TYPE_FLOW_ANALYZER_ERROR_CODE)[keyof typeof AST_TYPE_FLOW_ANALYZER_ERROR_CODE]

/**
 * Structured metadata for AST type flow analyzer failures.
 */
export interface IAstTypeFlowAnalyzerErrorDetails {
    /**
     * Invalid repository-relative file path when available.
     */
    readonly filePath?: string

    /**
     * Invalid minimum confidence value when available.
     */
    readonly minimumConfidence?: number

    /**
     * Invalid max flow count when available.
     */
    readonly maxFlows?: number
}

/**
 * Typed AST type flow analyzer error with stable metadata.
 */
export class AstTypeFlowAnalyzerError extends Error {
    /**
     * Stable machine-readable error code.
     */
    public readonly code: AstTypeFlowAnalyzerErrorCode

    /**
     * Invalid repository-relative file path when available.
     */
    public readonly filePath?: string

    /**
     * Invalid minimum confidence value when available.
     */
    public readonly minimumConfidence?: number

    /**
     * Invalid max flow count when available.
     */
    public readonly maxFlows?: number

    /**
     * Creates typed AST type flow analyzer error.
     *
     * @param code Stable machine-readable error code.
     * @param details Normalized error metadata.
     */
    public constructor(
        code: AstTypeFlowAnalyzerErrorCode,
        details: IAstTypeFlowAnalyzerErrorDetails = {},
    ) {
        super(createAstTypeFlowAnalyzerErrorMessage(code, details))

        this.name = "AstTypeFlowAnalyzerError"
        this.code = code
        this.filePath = details.filePath
        this.minimumConfidence = details.minimumConfidence
        this.maxFlows = details.maxFlows
    }
}

/**
 * Builds stable public message for AST type flow analyzer failures.
 *
 * @param code Stable machine-readable error code.
 * @param details Normalized error metadata.
 * @returns Stable public message.
 */
function createAstTypeFlowAnalyzerErrorMessage(
    code: AstTypeFlowAnalyzerErrorCode,
    details: IAstTypeFlowAnalyzerErrorDetails,
): string {
    return AST_TYPE_FLOW_ANALYZER_ERROR_MESSAGES[code](details)
}

const AST_TYPE_FLOW_ANALYZER_ERROR_MESSAGES: Readonly<
    Record<AstTypeFlowAnalyzerErrorCode, (details: IAstTypeFlowAnalyzerErrorDetails) => string>
> = {
    EMPTY_FILE_PATHS: () => "Type flow analyzer file path filter cannot be empty",
    INVALID_FILE_PATH: (details) =>
        `Invalid file path for type flow analyzer: ${details.filePath ?? "<empty>"}`,
    INVALID_MINIMUM_CONFIDENCE: (details) =>
        `Invalid minimum confidence for type flow analyzer: ${
            details.minimumConfidence ?? Number.NaN
        }`,
    INVALID_MAX_FLOWS: (details) =>
        `Invalid max flows for type flow analyzer: ${details.maxFlows ?? Number.NaN}`,
}
