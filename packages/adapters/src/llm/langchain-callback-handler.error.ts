/**
 * Typed error codes for LangChain callback handler failures.
 */
export const LANGCHAIN_CALLBACK_HANDLER_ERROR_CODE = {
    INVALID_SINKS: "INVALID_SINKS",
    INVALID_MAX_ATTEMPTS: "INVALID_MAX_ATTEMPTS",
    INVALID_RETRY_BACKOFF_MS: "INVALID_RETRY_BACKOFF_MS",
    INVALID_IDEMPOTENCY_TTL_MS: "INVALID_IDEMPOTENCY_TTL_MS",
    INVALID_EVENT_TYPE: "INVALID_EVENT_TYPE",
    INVALID_RUN_ID: "INVALID_RUN_ID",
    INVALID_EVENT_NAME: "INVALID_EVENT_NAME",
    INVALID_IDEMPOTENCY_KEY: "INVALID_IDEMPOTENCY_KEY",
    DISPATCH_FAILED: "DISPATCH_FAILED",
} as const

/**
 * LangChain callback handler error code literal.
 */
export type LangChainCallbackHandlerErrorCode =
    (typeof LANGCHAIN_CALLBACK_HANDLER_ERROR_CODE)[keyof typeof LANGCHAIN_CALLBACK_HANDLER_ERROR_CODE]

/**
 * Structured metadata for callback handler failures.
 */
export interface ILangChainCallbackHandlerErrorDetails {
    /**
     * Callback event type when available.
     */
    readonly eventType?: string

    /**
     * Run identifier when available.
     */
    readonly runId?: string

    /**
     * Event name when available.
     */
    readonly name?: string

    /**
     * Idempotency key when available.
     */
    readonly idempotencyKey?: string

    /**
     * Retry attempt number when available.
     */
    readonly attempt?: number

    /**
     * Original cause message when available.
     */
    readonly causeMessage?: string
}

/**
 * Error thrown by LangChain callback handler.
 */
export class LangChainCallbackHandlerError extends Error {
    /**
     * Stable machine-readable error code.
     */
    public readonly code: LangChainCallbackHandlerErrorCode

    /**
     * Callback event type when available.
     */
    public readonly eventType?: string

    /**
     * Run identifier when available.
     */
    public readonly runId?: string

    /**
     * Event name when available.
     */
    public readonly nameValue?: string

    /**
     * Idempotency key when available.
     */
    public readonly idempotencyKey?: string

    /**
     * Retry attempt number when available.
     */
    public readonly attempt?: number

    /**
     * Original cause message when available.
     */
    public readonly causeMessage?: string

    /**
     * Creates callback handler error.
     *
     * @param code Stable machine-readable error code.
     * @param details Optional normalized details.
     */
    public constructor(
        code: LangChainCallbackHandlerErrorCode,
        details: ILangChainCallbackHandlerErrorDetails = {},
    ) {
        super(buildLangChainCallbackHandlerErrorMessage(code, details))
        this.name = "LangChainCallbackHandlerError"
        this.code = code
        this.eventType = details.eventType
        this.runId = details.runId
        this.nameValue = details.name
        this.idempotencyKey = details.idempotencyKey
        this.attempt = details.attempt
        this.causeMessage = details.causeMessage
    }
}

/**
 * Builds public callback handler error message.
 *
 * @param code Error code.
 * @param details Error details.
 * @returns Public error message.
 */
function buildLangChainCallbackHandlerErrorMessage(
    code: LangChainCallbackHandlerErrorCode,
    details: ILangChainCallbackHandlerErrorDetails,
): string {
    const messages: Readonly<Record<LangChainCallbackHandlerErrorCode, string>> = {
        [LANGCHAIN_CALLBACK_HANDLER_ERROR_CODE.INVALID_SINKS]:
            "LangChain callback handler requires at least one sink with handle()",
        [LANGCHAIN_CALLBACK_HANDLER_ERROR_CODE.INVALID_MAX_ATTEMPTS]:
            "LangChain callback handler max attempts must be a positive integer",
        [LANGCHAIN_CALLBACK_HANDLER_ERROR_CODE.INVALID_RETRY_BACKOFF_MS]:
            "LangChain callback handler retry backoff must be a non-negative integer",
        [LANGCHAIN_CALLBACK_HANDLER_ERROR_CODE.INVALID_IDEMPOTENCY_TTL_MS]:
            "LangChain callback handler idempotency TTL must be a positive integer",
        [LANGCHAIN_CALLBACK_HANDLER_ERROR_CODE.INVALID_EVENT_TYPE]:
            `LangChain callback event type is invalid: ${details.eventType ?? "<empty>"}`,
        [LANGCHAIN_CALLBACK_HANDLER_ERROR_CODE.INVALID_RUN_ID]:
            `LangChain callback run id is invalid: ${details.runId ?? "<empty>"}`,
        [LANGCHAIN_CALLBACK_HANDLER_ERROR_CODE.INVALID_EVENT_NAME]:
            `LangChain callback event name is invalid: ${details.name ?? "<empty>"}`,
        [LANGCHAIN_CALLBACK_HANDLER_ERROR_CODE.INVALID_IDEMPOTENCY_KEY]:
            `LangChain callback idempotency key is invalid: ${details.idempotencyKey ?? "<empty>"}`,
        [LANGCHAIN_CALLBACK_HANDLER_ERROR_CODE.DISPATCH_FAILED]:
            `LangChain callback dispatch failed for event: ${details.eventType ?? "<unknown>"}`,
    }

    return messages[code]
}
