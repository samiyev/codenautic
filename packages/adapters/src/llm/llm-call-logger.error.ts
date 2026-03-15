/**
 * Typed error codes for LLM call logger failures.
 */
export const LLM_CALL_LOGGER_ERROR_CODE = {
    INVALID_LOGGER: "INVALID_LOGGER",
    INVALID_MAX_ATTEMPTS: "INVALID_MAX_ATTEMPTS",
    INVALID_RETRY_BACKOFF_MS: "INVALID_RETRY_BACKOFF_MS",
    INVALID_IDEMPOTENCY_TTL_MS: "INVALID_IDEMPOTENCY_TTL_MS",
    INVALID_EVENT_KIND: "INVALID_EVENT_KIND",
    INVALID_RUN_ID: "INVALID_RUN_ID",
    INVALID_EVENT_NAME: "INVALID_EVENT_NAME",
    LOGGING_FAILED: "LOGGING_FAILED",
} as const

/**
 * LLM call logger error code literal.
 */
export type LlmCallLoggerErrorCode =
    (typeof LLM_CALL_LOGGER_ERROR_CODE)[keyof typeof LLM_CALL_LOGGER_ERROR_CODE]

/**
 * Structured metadata for call logger failures.
 */
export interface ILlmCallLoggerErrorDetails {
    /**
     * Event kind when available.
     */
    readonly kind?: string

    /**
     * Run identifier when available.
     */
    readonly runId?: string

    /**
     * Event name when available.
     */
    readonly name?: string

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
 * Error thrown by LLM call logger.
 */
export class LlmCallLoggerError extends Error {
    /**
     * Stable machine-readable error code.
     */
    public readonly code: LlmCallLoggerErrorCode

    /**
     * Event kind when available.
     */
    public readonly kind?: string

    /**
     * Run identifier when available.
     */
    public readonly runId?: string

    /**
     * Event name when available.
     */
    public readonly nameValue?: string

    /**
     * Retry attempt when available.
     */
    public readonly attempt?: number

    /**
     * Original cause message when available.
     */
    public readonly causeMessage?: string

    /**
     * Creates call logger error.
     *
     * @param code Stable machine-readable error code.
     * @param details Optional normalized details.
     */
    public constructor(
        code: LlmCallLoggerErrorCode,
        details: ILlmCallLoggerErrorDetails = {},
    ) {
        super(buildLlmCallLoggerErrorMessage(code, details))
        this.name = "LlmCallLoggerError"
        this.code = code
        this.kind = details.kind
        this.runId = details.runId
        this.nameValue = details.name
        this.attempt = details.attempt
        this.causeMessage = details.causeMessage
    }
}

/**
 * Builds public call logger error message.
 *
 * @param code Error code.
 * @param details Error details.
 * @returns Public error message.
 */
function buildLlmCallLoggerErrorMessage(
    code: LlmCallLoggerErrorCode,
    details: ILlmCallLoggerErrorDetails,
): string {
    const messages: Readonly<Record<LlmCallLoggerErrorCode, string>> = {
        [LLM_CALL_LOGGER_ERROR_CODE.INVALID_LOGGER]:
            "LLM call logger requires ILogger-compatible logger",
        [LLM_CALL_LOGGER_ERROR_CODE.INVALID_MAX_ATTEMPTS]:
            "LLM call logger max attempts must be a positive integer",
        [LLM_CALL_LOGGER_ERROR_CODE.INVALID_RETRY_BACKOFF_MS]:
            "LLM call logger retry backoff must be a non-negative integer",
        [LLM_CALL_LOGGER_ERROR_CODE.INVALID_IDEMPOTENCY_TTL_MS]:
            "LLM call logger idempotency TTL must be a positive integer",
        [LLM_CALL_LOGGER_ERROR_CODE.INVALID_EVENT_KIND]:
            `LLM call logger event kind is invalid: ${details.kind ?? "<empty>"}`,
        [LLM_CALL_LOGGER_ERROR_CODE.INVALID_RUN_ID]:
            `LLM call logger run id is invalid: ${details.runId ?? "<empty>"}`,
        [LLM_CALL_LOGGER_ERROR_CODE.INVALID_EVENT_NAME]:
            `LLM call logger event name is invalid: ${details.name ?? "<empty>"}`,
        [LLM_CALL_LOGGER_ERROR_CODE.LOGGING_FAILED]:
            `LLM call logger failed to write log event: ${details.kind ?? "<unknown>"}`,
    }

    return messages[code]
}
