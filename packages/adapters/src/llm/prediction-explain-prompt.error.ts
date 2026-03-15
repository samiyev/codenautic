/**
 * Typed error codes for prediction explain prompt builder failures.
 */
export const PREDICTION_EXPLAIN_PROMPT_ERROR_CODE = {
    INVALID_METRICS: "INVALID_METRICS",
    INVALID_TRENDS: "INVALID_TRENDS",
    INVALID_METRIC_NAME: "INVALID_METRIC_NAME",
    INVALID_METRIC_VALUE: "INVALID_METRIC_VALUE",
    INVALID_TREND_METRIC_NAME: "INVALID_TREND_METRIC_NAME",
    INVALID_TREND_DIRECTION: "INVALID_TREND_DIRECTION",
    INVALID_TREND_WINDOW: "INVALID_TREND_WINDOW",
    INVALID_CONFIDENCE_SCORE: "INVALID_CONFIDENCE_SCORE",
    INVALID_IDEMPOTENCY_KEY: "INVALID_IDEMPOTENCY_KEY",
    INVALID_MAX_ATTEMPTS: "INVALID_MAX_ATTEMPTS",
    INVALID_RETRY_BACKOFF_MS: "INVALID_RETRY_BACKOFF_MS",
    INVALID_IDEMPOTENCY_TTL_MS: "INVALID_IDEMPOTENCY_TTL_MS",
    CONTEXT_LOAD_FAILED: "CONTEXT_LOAD_FAILED",
} as const

/**
 * Prediction explain prompt error code literal.
 */
export type PredictionExplainPromptErrorCode =
    (typeof PREDICTION_EXPLAIN_PROMPT_ERROR_CODE)[keyof typeof PREDICTION_EXPLAIN_PROMPT_ERROR_CODE]

/**
 * Structured metadata for prediction explain prompt failures.
 */
export interface IPredictionExplainPromptErrorDetails {
    /**
     * Metric name when available.
     */
    readonly metricName?: string

    /**
     * Trend metric name when available.
     */
    readonly trendMetricName?: string

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
 * Error thrown by prediction explain prompt builder.
 */
export class PredictionExplainPromptError extends Error {
    /**
     * Stable machine-readable error code.
     */
    public readonly code: PredictionExplainPromptErrorCode

    /**
     * Metric name when available.
     */
    public readonly metricName?: string

    /**
     * Trend metric name when available.
     */
    public readonly trendMetricName?: string

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
     * Creates prediction explain prompt error.
     *
     * @param code Stable machine-readable error code.
     * @param details Optional normalized details.
     */
    public constructor(
        code: PredictionExplainPromptErrorCode,
        details: IPredictionExplainPromptErrorDetails = {},
    ) {
        super(buildPredictionExplainPromptErrorMessage(code, details))
        this.name = "PredictionExplainPromptError"
        this.code = code
        this.metricName = details.metricName
        this.trendMetricName = details.trendMetricName
        this.idempotencyKey = details.idempotencyKey
        this.attempt = details.attempt
        this.causeMessage = details.causeMessage
    }
}

/**
 * Builds public prediction explain prompt error message.
 *
 * @param code Error code.
 * @param details Error details.
 * @returns Public error message.
 */
function buildPredictionExplainPromptErrorMessage(
    code: PredictionExplainPromptErrorCode,
    details: IPredictionExplainPromptErrorDetails,
): string {
    const messages: Readonly<Record<PredictionExplainPromptErrorCode, string>> = {
        [PREDICTION_EXPLAIN_PROMPT_ERROR_CODE.INVALID_METRICS]:
            "Prediction explain prompt requires non-empty metrics",
        [PREDICTION_EXPLAIN_PROMPT_ERROR_CODE.INVALID_TRENDS]:
            "Prediction explain prompt requires non-empty trends",
        [PREDICTION_EXPLAIN_PROMPT_ERROR_CODE.INVALID_METRIC_NAME]:
            `Prediction metric name is invalid: ${details.metricName ?? "<empty>"}`,
        [PREDICTION_EXPLAIN_PROMPT_ERROR_CODE.INVALID_METRIC_VALUE]:
            "Prediction metric value must be a finite number",
        [PREDICTION_EXPLAIN_PROMPT_ERROR_CODE.INVALID_TREND_METRIC_NAME]:
            `Prediction trend metric name is invalid: ${details.trendMetricName ?? "<empty>"}`,
        [PREDICTION_EXPLAIN_PROMPT_ERROR_CODE.INVALID_TREND_DIRECTION]:
            "Prediction trend direction must be up, down, or stable",
        [PREDICTION_EXPLAIN_PROMPT_ERROR_CODE.INVALID_TREND_WINDOW]:
            "Prediction trend window cannot be empty",
        [PREDICTION_EXPLAIN_PROMPT_ERROR_CODE.INVALID_CONFIDENCE_SCORE]:
            "Prediction confidence score must be between 0 and 1",
        [PREDICTION_EXPLAIN_PROMPT_ERROR_CODE.INVALID_IDEMPOTENCY_KEY]:
            `Prediction idempotency key is invalid: ${details.idempotencyKey ?? "<empty>"}`,
        [PREDICTION_EXPLAIN_PROMPT_ERROR_CODE.INVALID_MAX_ATTEMPTS]:
            "Prediction explain prompt max attempts must be a positive integer",
        [PREDICTION_EXPLAIN_PROMPT_ERROR_CODE.INVALID_RETRY_BACKOFF_MS]:
            "Prediction explain prompt retry backoff must be a non-negative integer",
        [PREDICTION_EXPLAIN_PROMPT_ERROR_CODE.INVALID_IDEMPOTENCY_TTL_MS]:
            "Prediction explain prompt idempotency TTL must be a positive integer",
        [PREDICTION_EXPLAIN_PROMPT_ERROR_CODE.CONTEXT_LOAD_FAILED]:
            "Prediction explain prompt failed to load additional context",
    }

    return messages[code]
}
