/**
 * Typed error codes for AST cross-file issue aggregator.
 */
export const AST_CROSS_FILE_ISSUE_AGGREGATOR_ERROR_CODE = {
    EMPTY_FILES: "EMPTY_FILES",
    DUPLICATE_FILE_PATH: "DUPLICATE_FILE_PATH",
    EMPTY_FILE_PATHS: "EMPTY_FILE_PATHS",
    INVALID_FILE_PATH: "INVALID_FILE_PATH",
    INVALID_MAX_ISSUES: "INVALID_MAX_ISSUES",
    INVALID_SOURCE: "INVALID_SOURCE",
    INVALID_SEVERITY: "INVALID_SEVERITY",
    INVALID_ISSUE_TYPE: "INVALID_ISSUE_TYPE",
    INVALID_ISSUE_MESSAGE: "INVALID_ISSUE_MESSAGE",
    INVALID_ISSUE_ID: "INVALID_ISSUE_ID",
    ISSUE_FILE_NOT_FOUND: "ISSUE_FILE_NOT_FOUND",
    INVALID_RELATED_FILE_PATH: "INVALID_RELATED_FILE_PATH",
    RELATED_FILE_NOT_FOUND: "RELATED_FILE_NOT_FOUND",
} as const

/**
 * AST cross-file issue aggregator error code literal.
 */
export type AstCrossFileIssueAggregatorErrorCode =
    (typeof AST_CROSS_FILE_ISSUE_AGGREGATOR_ERROR_CODE)[keyof typeof AST_CROSS_FILE_ISSUE_AGGREGATOR_ERROR_CODE]

/**
 * Structured metadata for AST cross-file issue aggregator failures.
 */
export interface IAstCrossFileIssueAggregatorErrorDetails {
    /**
     * Invalid repository-relative file path when available.
     */
    readonly filePath?: string

    /**
     * Invalid max issue cap when available.
     */
    readonly maxIssues?: number

    /**
     * Invalid issue source when available.
     */
    readonly source?: string

    /**
     * Invalid issue severity when available.
     */
    readonly severity?: string

    /**
     * Invalid issue type when available.
     */
    readonly issueType?: string

    /**
     * Invalid issue identifier when available.
     */
    readonly issueId?: string
}

/**
 * Typed AST cross-file issue aggregator error with stable metadata.
 */
export class AstCrossFileIssueAggregatorError extends Error {
    /**
     * Stable machine-readable error code.
     */
    public readonly code: AstCrossFileIssueAggregatorErrorCode

    /**
     * Invalid repository-relative file path when available.
     */
    public readonly filePath?: string

    /**
     * Invalid max issue cap when available.
     */
    public readonly maxIssues?: number

    /**
     * Invalid issue source when available.
     */
    public readonly source?: string

    /**
     * Invalid issue severity when available.
     */
    public readonly severity?: string

    /**
     * Invalid issue type when available.
     */
    public readonly issueType?: string

    /**
     * Invalid issue identifier when available.
     */
    public readonly issueId?: string

    /**
     * Creates typed AST cross-file issue aggregator error.
     *
     * @param code Stable machine-readable error code.
     * @param details Normalized error metadata.
     */
    public constructor(
        code: AstCrossFileIssueAggregatorErrorCode,
        details: IAstCrossFileIssueAggregatorErrorDetails = {},
    ) {
        super(createAstCrossFileIssueAggregatorErrorMessage(code, details))

        this.name = "AstCrossFileIssueAggregatorError"
        this.code = code
        this.filePath = details.filePath
        this.maxIssues = details.maxIssues
        this.source = details.source
        this.severity = details.severity
        this.issueType = details.issueType
        this.issueId = details.issueId
    }
}

/**
 * Builds stable public message for AST cross-file issue aggregator failures.
 *
 * @param code Stable machine-readable error code.
 * @param details Normalized error metadata.
 * @returns Stable public message.
 */
function createAstCrossFileIssueAggregatorErrorMessage(
    code: AstCrossFileIssueAggregatorErrorCode,
    details: IAstCrossFileIssueAggregatorErrorDetails,
): string {
    return AST_CROSS_FILE_ISSUE_AGGREGATOR_ERROR_MESSAGES[code](details)
}

const AST_CROSS_FILE_ISSUE_AGGREGATOR_ERROR_MESSAGES: Readonly<
    Record<AstCrossFileIssueAggregatorErrorCode, (details: IAstCrossFileIssueAggregatorErrorDetails) => string>
> = {
    EMPTY_FILES: () => "Cross-file issue aggregator parsed file collection cannot be empty",
    DUPLICATE_FILE_PATH: (details) =>
        `Duplicate file path for cross-file issue aggregator: ${details.filePath ?? "<empty>"}`,
    EMPTY_FILE_PATHS: () => "Cross-file issue aggregator file path filter cannot be empty",
    INVALID_FILE_PATH: (details) =>
        `Invalid file path for cross-file issue aggregator: ${details.filePath ?? "<empty>"}`,
    INVALID_MAX_ISSUES: (details) =>
        `Invalid max issues for cross-file issue aggregator: ${details.maxIssues ?? Number.NaN}`,
    INVALID_SOURCE: (details) =>
        `Invalid source for cross-file issue aggregator: ${details.source ?? "<empty>"}`,
    INVALID_SEVERITY: (details) =>
        `Invalid severity for cross-file issue aggregator: ${details.severity ?? "<empty>"}`,
    INVALID_ISSUE_TYPE: (details) =>
        `Invalid issue type for cross-file issue aggregator: ${details.issueType ?? "<empty>"}`,
    INVALID_ISSUE_MESSAGE: () => "Cross-file issue aggregator issue message cannot be empty",
    INVALID_ISSUE_ID: (details) =>
        `Invalid issue id for cross-file issue aggregator: ${details.issueId ?? "<empty>"}`,
    ISSUE_FILE_NOT_FOUND: (details) =>
        `Issue file path was not found in parsed files: ${details.filePath ?? "<empty>"}`,
    INVALID_RELATED_FILE_PATH: (details) =>
        `Invalid related file path for cross-file issue aggregator: ${details.filePath ?? "<empty>"}`,
    RELATED_FILE_NOT_FOUND: (details) =>
        `Related file path was not found in parsed files: ${details.filePath ?? "<empty>"}`,
}
