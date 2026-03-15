/**
 * Typed error codes for AST scan result aggregator.
 */
export const AST_SCAN_RESULT_AGGREGATOR_ERROR_CODE = {
    EMPTY_SCAN_RESULTS: "EMPTY_SCAN_RESULTS",
    INVALID_COMPLETED_AT: "INVALID_COMPLETED_AT",
    INVALID_DURATION: "INVALID_DURATION",
    INVALID_FILE_COUNT: "INVALID_FILE_COUNT",
    INVALID_LANGUAGE: "INVALID_LANGUAGE",
    INVALID_LANGUAGE_FILE_COUNT: "INVALID_LANGUAGE_FILE_COUNT",
    INVALID_LANGUAGE_LOC: "INVALID_LANGUAGE_LOC",
    INVALID_REPOSITORY_ID: "INVALID_REPOSITORY_ID",
    INVALID_SCAN_ID: "INVALID_SCAN_ID",
    INVALID_TOTAL_EDGES: "INVALID_TOTAL_EDGES",
    INVALID_TOTAL_NODES: "INVALID_TOTAL_NODES",
} as const

/**
 * AST scan result aggregator error code literal.
 */
export type AstScanResultAggregatorErrorCode =
    (typeof AST_SCAN_RESULT_AGGREGATOR_ERROR_CODE)[keyof typeof AST_SCAN_RESULT_AGGREGATOR_ERROR_CODE]

/**
 * Structured metadata for AST scan result aggregator failures.
 */
export interface IAstScanResultAggregatorErrorDetails {
    /**
     * Index of invalid scan result when available.
     */
    readonly resultIndex?: number

    /**
     * Invalid scan identifier when available.
     */
    readonly scanId?: string

    /**
     * Invalid repository identifier when available.
     */
    readonly repositoryId?: string

    /**
     * Invalid language value when available.
     */
    readonly language?: string

    /**
     * Invalid numeric value when available.
     */
    readonly value?: number

    /**
     * Invalid timestamp value when available.
     */
    readonly completedAt?: string
}

/**
 * Typed AST scan result aggregator error with stable metadata.
 */
export class AstScanResultAggregatorError extends Error {
    /**
     * Stable machine-readable error code.
     */
    public readonly code: AstScanResultAggregatorErrorCode

    /**
     * Index of invalid scan result when available.
     */
    public readonly resultIndex?: number

    /**
     * Invalid scan identifier when available.
     */
    public readonly scanId?: string

    /**
     * Invalid repository identifier when available.
     */
    public readonly repositoryId?: string

    /**
     * Invalid language value when available.
     */
    public readonly language?: string

    /**
     * Invalid numeric value when available.
     */
    public readonly value?: number

    /**
     * Invalid timestamp value when available.
     */
    public readonly completedAt?: string

    /**
     * Creates typed AST scan result aggregator error.
     *
     * @param code Stable machine-readable error code.
     * @param details Structured metadata payload.
     */
    public constructor(
        code: AstScanResultAggregatorErrorCode,
        details: IAstScanResultAggregatorErrorDetails = {},
    ) {
        super(createAstScanResultAggregatorErrorMessage(code, details))

        this.name = "AstScanResultAggregatorError"
        this.code = code
        this.resultIndex = details.resultIndex
        this.scanId = details.scanId
        this.repositoryId = details.repositoryId
        this.language = details.language
        this.value = details.value
        this.completedAt = details.completedAt
    }
}

/**
 * Builds stable public message for scan result aggregator failures.
 *
 * @param code Stable machine-readable error code.
 * @param details Structured metadata payload.
 * @returns Stable public message.
 */
function createAstScanResultAggregatorErrorMessage(
    code: AstScanResultAggregatorErrorCode,
    details: IAstScanResultAggregatorErrorDetails,
): string {
    return AST_SCAN_RESULT_AGGREGATOR_ERROR_MESSAGES[code](details)
}

const AST_SCAN_RESULT_AGGREGATOR_ERROR_MESSAGES: Readonly<
    Record<
        AstScanResultAggregatorErrorCode,
        (details: IAstScanResultAggregatorErrorDetails) => string
    >
> = {
    EMPTY_SCAN_RESULTS: () => "AST scan result aggregator input cannot be empty",
    INVALID_COMPLETED_AT: (details) =>
        `Invalid completedAt at scan result index ${String(details.resultIndex ?? -1)}: ${
            details.completedAt ?? "<empty>"
        }`,
    INVALID_DURATION: (details) =>
        `Invalid duration at scan result index ${String(details.resultIndex ?? -1)}: ${
            details.value ?? Number.NaN
        }`,
    INVALID_FILE_COUNT: (details) =>
        `Invalid totalFiles at scan result index ${String(details.resultIndex ?? -1)}: ${
            details.value ?? Number.NaN
        }`,
    INVALID_LANGUAGE: (details) =>
        `Invalid language at scan result index ${String(details.resultIndex ?? -1)}: ${
            details.language ?? "<empty>"
        }`,
    INVALID_LANGUAGE_FILE_COUNT: (details) =>
        `Invalid language fileCount at scan result index ${String(details.resultIndex ?? -1)}: ${
            details.value ?? Number.NaN
        }`,
    INVALID_LANGUAGE_LOC: (details) =>
        `Invalid language loc at scan result index ${String(details.resultIndex ?? -1)}: ${
            details.value ?? Number.NaN
        }`,
    INVALID_REPOSITORY_ID: (details) =>
        `Invalid repository id at scan result index ${String(details.resultIndex ?? -1)}: ${
            details.repositoryId ?? "<empty>"
        }`,
    INVALID_SCAN_ID: (details) =>
        `Invalid scan id at scan result index ${String(details.resultIndex ?? -1)}: ${
            details.scanId ?? "<empty>"
        }`,
    INVALID_TOTAL_EDGES: (details) =>
        `Invalid totalEdges at scan result index ${String(details.resultIndex ?? -1)}: ${
            details.value ?? Number.NaN
        }`,
    INVALID_TOTAL_NODES: (details) =>
        `Invalid totalNodes at scan result index ${String(details.resultIndex ?? -1)}: ${
            details.value ?? Number.NaN
        }`,
}
