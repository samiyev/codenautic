/**
 * Typed error codes for executive report prompt builder failures.
 */
export const EXECUTIVE_REPORT_PROMPT_ERROR_CODE = {
    INVALID_REPO_STATE: "INVALID_REPO_STATE",
    INVALID_TRENDS: "INVALID_TRENDS",
    INVALID_HIGHLIGHTS: "INVALID_HIGHLIGHTS",
    INVALID_RISKS: "INVALID_RISKS",
    INVALID_REPO_STATE_NAME: "INVALID_REPO_STATE_NAME",
    INVALID_REPO_STATE_VALUE: "INVALID_REPO_STATE_VALUE",
    INVALID_TREND_NAME: "INVALID_TREND_NAME",
    INVALID_TREND_DIRECTION: "INVALID_TREND_DIRECTION",
    INVALID_TREND_WINDOW: "INVALID_TREND_WINDOW",
    INVALID_TREND_CHANGE_PERCENT: "INVALID_TREND_CHANGE_PERCENT",
    INVALID_HIGHLIGHT_ENTRY: "INVALID_HIGHLIGHT_ENTRY",
    INVALID_RISK_ENTRY: "INVALID_RISK_ENTRY",
    INVALID_IDEMPOTENCY_KEY: "INVALID_IDEMPOTENCY_KEY",
    INVALID_MAX_ATTEMPTS: "INVALID_MAX_ATTEMPTS",
    INVALID_RETRY_BACKOFF_MS: "INVALID_RETRY_BACKOFF_MS",
    INVALID_IDEMPOTENCY_TTL_MS: "INVALID_IDEMPOTENCY_TTL_MS",
    CONTEXT_LOAD_FAILED: "CONTEXT_LOAD_FAILED",
} as const

/**
 * Executive report prompt error code literal.
 */
export type ExecutiveReportPromptErrorCode =
    (typeof EXECUTIVE_REPORT_PROMPT_ERROR_CODE)[keyof typeof EXECUTIVE_REPORT_PROMPT_ERROR_CODE]

/**
 * Structured metadata for executive report prompt failures.
 */
export interface IExecutiveReportPromptErrorDetails {
    /**
     * Invalid state metric name when available.
     */
    readonly stateMetricName?: string

    /**
     * Invalid trend name when available.
     */
    readonly trendName?: string

    /**
     * Invalid highlight entry when available.
     */
    readonly highlightEntry?: string

    /**
     * Invalid risk entry when available.
     */
    readonly riskEntry?: string

    /**
     * Invalid idempotency key when available.
     */
    readonly idempotencyKey?: string

    /**
     * Retry attempt when available.
     */
    readonly attempt?: number

    /**
     * Original cause message when available.
     */
    readonly causeMessage?: string
}

/**
 * Error thrown by executive report prompt builder.
 */
export class ExecutiveReportPromptError extends Error {
    /**
     * Stable machine-readable error code.
     */
    public readonly code: ExecutiveReportPromptErrorCode

    /**
     * Invalid state metric name when available.
     */
    public readonly stateMetricName?: string

    /**
     * Invalid trend name when available.
     */
    public readonly trendName?: string

    /**
     * Invalid highlight entry when available.
     */
    public readonly highlightEntry?: string

    /**
     * Invalid risk entry when available.
     */
    public readonly riskEntry?: string

    /**
     * Invalid idempotency key when available.
     */
    public readonly idempotencyKey?: string

    /**
     * Retry attempt when available.
     */
    public readonly attempt?: number

    /**
     * Original cause message when available.
     */
    public readonly causeMessage?: string

    /**
     * Creates executive report prompt error.
     *
     * @param code Stable machine-readable error code.
     * @param details Optional normalized details.
     */
    public constructor(
        code: ExecutiveReportPromptErrorCode,
        details: IExecutiveReportPromptErrorDetails = {},
    ) {
        super(buildExecutiveReportPromptErrorMessage(code, details))
        this.name = "ExecutiveReportPromptError"
        this.code = code
        this.stateMetricName = details.stateMetricName
        this.trendName = details.trendName
        this.highlightEntry = details.highlightEntry
        this.riskEntry = details.riskEntry
        this.idempotencyKey = details.idempotencyKey
        this.attempt = details.attempt
        this.causeMessage = details.causeMessage
    }
}

/**
 * Builds public executive report prompt error message.
 *
 * @param code Error code.
 * @param details Error details.
 * @returns Public error message.
 */
function buildExecutiveReportPromptErrorMessage(
    code: ExecutiveReportPromptErrorCode,
    details: IExecutiveReportPromptErrorDetails,
): string {
    const messages: Readonly<Record<ExecutiveReportPromptErrorCode, string>> = {
        [EXECUTIVE_REPORT_PROMPT_ERROR_CODE.INVALID_REPO_STATE]:
            "Executive report prompt requires non-empty repository state metrics",
        [EXECUTIVE_REPORT_PROMPT_ERROR_CODE.INVALID_TRENDS]:
            "Executive report prompt requires non-empty trends",
        [EXECUTIVE_REPORT_PROMPT_ERROR_CODE.INVALID_HIGHLIGHTS]:
            "Executive report prompt requires non-empty highlights",
        [EXECUTIVE_REPORT_PROMPT_ERROR_CODE.INVALID_RISKS]:
            "Executive report risks list cannot contain empty entries",
        [EXECUTIVE_REPORT_PROMPT_ERROR_CODE.INVALID_REPO_STATE_NAME]:
            `Executive report state metric name is invalid: ${details.stateMetricName ?? "<empty>"}`,
        [EXECUTIVE_REPORT_PROMPT_ERROR_CODE.INVALID_REPO_STATE_VALUE]:
            "Executive report state metric value must be a finite number",
        [EXECUTIVE_REPORT_PROMPT_ERROR_CODE.INVALID_TREND_NAME]:
            `Executive report trend name is invalid: ${details.trendName ?? "<empty>"}`,
        [EXECUTIVE_REPORT_PROMPT_ERROR_CODE.INVALID_TREND_DIRECTION]:
            "Executive report trend direction must be up, down, or stable",
        [EXECUTIVE_REPORT_PROMPT_ERROR_CODE.INVALID_TREND_WINDOW]:
            "Executive report trend window cannot be empty",
        [EXECUTIVE_REPORT_PROMPT_ERROR_CODE.INVALID_TREND_CHANGE_PERCENT]:
            "Executive report trend changePercent must be a finite number",
        [EXECUTIVE_REPORT_PROMPT_ERROR_CODE.INVALID_HIGHLIGHT_ENTRY]:
            `Executive report highlight is invalid: ${details.highlightEntry ?? "<empty>"}`,
        [EXECUTIVE_REPORT_PROMPT_ERROR_CODE.INVALID_RISK_ENTRY]:
            `Executive report risk is invalid: ${details.riskEntry ?? "<empty>"}`,
        [EXECUTIVE_REPORT_PROMPT_ERROR_CODE.INVALID_IDEMPOTENCY_KEY]:
            `Executive report idempotency key is invalid: ${details.idempotencyKey ?? "<empty>"}`,
        [EXECUTIVE_REPORT_PROMPT_ERROR_CODE.INVALID_MAX_ATTEMPTS]:
            "Executive report prompt max attempts must be a positive integer",
        [EXECUTIVE_REPORT_PROMPT_ERROR_CODE.INVALID_RETRY_BACKOFF_MS]:
            "Executive report prompt retry backoff must be a non-negative integer",
        [EXECUTIVE_REPORT_PROMPT_ERROR_CODE.INVALID_IDEMPOTENCY_TTL_MS]:
            "Executive report prompt idempotency TTL must be a positive integer",
        [EXECUTIVE_REPORT_PROMPT_ERROR_CODE.CONTEXT_LOAD_FAILED]:
            "Executive report prompt failed to load additional context",
    }

    return messages[code]
}
