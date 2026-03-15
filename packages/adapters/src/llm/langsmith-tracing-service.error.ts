/**
 * Typed error codes for LangSmith tracing service failures.
 */
export const LANGSMITH_TRACING_SERVICE_ERROR_CODE = {
    INVALID_TRACER: "INVALID_TRACER",
    INVALID_MAX_ATTEMPTS: "INVALID_MAX_ATTEMPTS",
    INVALID_RETRY_BACKOFF_MS: "INVALID_RETRY_BACKOFF_MS",
    INVALID_IDEMPOTENCY_TTL_MS: "INVALID_IDEMPOTENCY_TTL_MS",
    INVALID_EVENT_TYPE: "INVALID_EVENT_TYPE",
    INVALID_RUN_ID: "INVALID_RUN_ID",
    EVENT_HANDLING_FAILED: "EVENT_HANDLING_FAILED",
} as const

/**
 * LangSmith tracing service error code literal.
 */
export type LangSmithTracingServiceErrorCode =
    (typeof LANGSMITH_TRACING_SERVICE_ERROR_CODE)[keyof typeof LANGSMITH_TRACING_SERVICE_ERROR_CODE]

/**
 * Structured metadata for tracing service failures.
 */
export interface ILangSmithTracingServiceErrorDetails {
    /**
     * Callback event type when available.
     */
    readonly eventType?: string

    /**
     * Callback run identifier when available.
     */
    readonly runId?: string

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
 * Error thrown by LangSmith tracing service.
 */
export class LangSmithTracingServiceError extends Error {
    /**
     * Stable machine-readable error code.
     */
    public readonly code: LangSmithTracingServiceErrorCode

    /**
     * Callback event type when available.
     */
    public readonly eventType?: string

    /**
     * Callback run identifier when available.
     */
    public readonly runId?: string

    /**
     * Retry attempt when available.
     */
    public readonly attempt?: number

    /**
     * Original cause message when available.
     */
    public readonly causeMessage?: string

    /**
     * Creates tracing service error.
     *
     * @param code Stable machine-readable error code.
     * @param details Optional normalized details.
     */
    public constructor(
        code: LangSmithTracingServiceErrorCode,
        details: ILangSmithTracingServiceErrorDetails = {},
    ) {
        super(buildLangSmithTracingServiceErrorMessage(code, details))
        this.name = "LangSmithTracingServiceError"
        this.code = code
        this.eventType = details.eventType
        this.runId = details.runId
        this.attempt = details.attempt
        this.causeMessage = details.causeMessage
    }
}

/**
 * Builds public tracing service error message.
 *
 * @param code Error code.
 * @param details Error details.
 * @returns Public error message.
 */
function buildLangSmithTracingServiceErrorMessage(
    code: LangSmithTracingServiceErrorCode,
    details: ILangSmithTracingServiceErrorDetails,
): string {
    const messages: Readonly<Record<LangSmithTracingServiceErrorCode, string>> = {
        [LANGSMITH_TRACING_SERVICE_ERROR_CODE.INVALID_TRACER]:
            "LangSmith tracing service requires tracer with startRun(), completeRun(), and failRun()",
        [LANGSMITH_TRACING_SERVICE_ERROR_CODE.INVALID_MAX_ATTEMPTS]:
            "LangSmith tracing service max attempts must be a positive integer",
        [LANGSMITH_TRACING_SERVICE_ERROR_CODE.INVALID_RETRY_BACKOFF_MS]:
            "LangSmith tracing service retry backoff must be a non-negative integer",
        [LANGSMITH_TRACING_SERVICE_ERROR_CODE.INVALID_IDEMPOTENCY_TTL_MS]:
            "LangSmith tracing service idempotency TTL must be a positive integer",
        [LANGSMITH_TRACING_SERVICE_ERROR_CODE.INVALID_EVENT_TYPE]:
            `LangSmith tracing service received unsupported event type: ${details.eventType ?? "<empty>"}`,
        [LANGSMITH_TRACING_SERVICE_ERROR_CODE.INVALID_RUN_ID]:
            `LangSmith tracing service received invalid run id: ${details.runId ?? "<empty>"}`,
        [LANGSMITH_TRACING_SERVICE_ERROR_CODE.EVENT_HANDLING_FAILED]:
            `LangSmith tracing service failed while handling event: ${details.eventType ?? "<unknown>"}`,
    }

    return messages[code]
}
