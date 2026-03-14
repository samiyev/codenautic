/**
 * Typed error codes for advanced AST code analysis.
 */
export const AST_ADVANCED_CODE_ANALYSIS_ERROR_CODE = {
    EMPTY_FILE_PATHS: "EMPTY_FILE_PATHS",
    INVALID_FILE_PATH: "INVALID_FILE_PATH",
    INVALID_MAX_PATTERNS_PER_TYPE: "INVALID_MAX_PATTERNS_PER_TYPE",
    INVALID_MINIMUM_CYCLE_SIZE: "INVALID_MINIMUM_CYCLE_SIZE",
    INVALID_MINIMUM_HUB_FAN_IN: "INVALID_MINIMUM_HUB_FAN_IN",
    INVALID_MINIMUM_HUB_FAN_OUT: "INVALID_MINIMUM_HUB_FAN_OUT",
    INVALID_MINIMUM_NODE_TYPE_SPREAD: "INVALID_MINIMUM_NODE_TYPE_SPREAD",
} as const

/**
 * Advanced AST code analysis error code literal.
 */
export type AstAdvancedCodeAnalysisErrorCode =
    (typeof AST_ADVANCED_CODE_ANALYSIS_ERROR_CODE)[keyof typeof AST_ADVANCED_CODE_ANALYSIS_ERROR_CODE]

/**
 * Structured metadata for advanced AST code analysis failures.
 */
export interface IAstAdvancedCodeAnalysisErrorDetails {
    /**
     * Invalid repository-relative file path when available.
     */
    readonly filePath?: string

    /**
     * Invalid minimum incoming dependency threshold when available.
     */
    readonly minimumHubFanIn?: number

    /**
     * Invalid minimum outgoing dependency threshold when available.
     */
    readonly minimumHubFanOut?: number

    /**
     * Invalid minimum cycle size when available.
     */
    readonly minimumCycleSize?: number

    /**
     * Invalid minimum per-file node-type spread when available.
     */
    readonly minimumNodeTypeSpread?: number

    /**
     * Invalid per-type pattern cap when available.
     */
    readonly maxPatternsPerType?: number
}

/**
 * Typed advanced AST code analysis error with stable metadata.
 */
export class AstAdvancedCodeAnalysisError extends Error {
    /**
     * Stable machine-readable error code.
     */
    public readonly code: AstAdvancedCodeAnalysisErrorCode

    /**
     * Invalid repository-relative file path when available.
     */
    public readonly filePath?: string

    /**
     * Invalid minimum incoming dependency threshold when available.
     */
    public readonly minimumHubFanIn?: number

    /**
     * Invalid minimum outgoing dependency threshold when available.
     */
    public readonly minimumHubFanOut?: number

    /**
     * Invalid minimum cycle size when available.
     */
    public readonly minimumCycleSize?: number

    /**
     * Invalid minimum per-file node-type spread when available.
     */
    public readonly minimumNodeTypeSpread?: number

    /**
     * Invalid per-type pattern cap when available.
     */
    public readonly maxPatternsPerType?: number

    /**
     * Creates typed advanced-analysis error.
     *
     * @param code Stable machine-readable error code.
     * @param details Normalized error metadata.
     */
    public constructor(
        code: AstAdvancedCodeAnalysisErrorCode,
        details: IAstAdvancedCodeAnalysisErrorDetails = {},
    ) {
        super(createAstAdvancedCodeAnalysisErrorMessage(code, details))

        this.name = "AstAdvancedCodeAnalysisError"
        this.code = code
        this.filePath = details.filePath
        this.minimumHubFanIn = details.minimumHubFanIn
        this.minimumHubFanOut = details.minimumHubFanOut
        this.minimumCycleSize = details.minimumCycleSize
        this.minimumNodeTypeSpread = details.minimumNodeTypeSpread
        this.maxPatternsPerType = details.maxPatternsPerType
    }
}

/**
 * Builds stable public message for advanced AST code analysis failures.
 *
 * @param code Stable machine-readable error code.
 * @param details Normalized error metadata.
 * @returns Stable public message.
 */
function createAstAdvancedCodeAnalysisErrorMessage(
    code: AstAdvancedCodeAnalysisErrorCode,
    details: IAstAdvancedCodeAnalysisErrorDetails,
): string {
    return AST_ADVANCED_CODE_ANALYSIS_ERROR_MESSAGES[code](details)
}

const AST_ADVANCED_CODE_ANALYSIS_ERROR_MESSAGES: Readonly<
    Record<AstAdvancedCodeAnalysisErrorCode, (details: IAstAdvancedCodeAnalysisErrorDetails) => string>
> = {
    EMPTY_FILE_PATHS: () => "Advanced AST analysis file path filter cannot be empty",
    INVALID_FILE_PATH: (details) =>
        `Invalid file path for advanced AST analysis: ${details.filePath ?? "<empty>"}`,
    INVALID_MAX_PATTERNS_PER_TYPE: (details) =>
        `Invalid max patterns per type for advanced AST analysis: ${
            details.maxPatternsPerType ?? Number.NaN
        }`,
    INVALID_MINIMUM_CYCLE_SIZE: (details) =>
        `Invalid minimum cycle size for advanced AST analysis: ${
            details.minimumCycleSize ?? Number.NaN
        }`,
    INVALID_MINIMUM_HUB_FAN_IN: (details) =>
        `Invalid minimum fan-in threshold for advanced AST analysis: ${
            details.minimumHubFanIn ?? Number.NaN
        }`,
    INVALID_MINIMUM_HUB_FAN_OUT: (details) =>
        `Invalid minimum fan-out threshold for advanced AST analysis: ${
            details.minimumHubFanOut ?? Number.NaN
        }`,
    INVALID_MINIMUM_NODE_TYPE_SPREAD: (details) =>
        `Invalid minimum node type spread for advanced AST analysis: ${
            details.minimumNodeTypeSpread ?? Number.NaN
        }`,
}
