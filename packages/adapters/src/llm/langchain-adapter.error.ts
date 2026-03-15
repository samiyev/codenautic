/**
 * Typed error codes for LangChain adapter failures.
 */
export const LANGCHAIN_ADAPTER_ERROR_CODE = {
    INVALID_CHAT_MODEL: "INVALID_CHAT_MODEL",
    INVALID_REQUEST_MAPPER: "INVALID_REQUEST_MAPPER",
    INVALID_MESSAGE_PAYLOAD: "INVALID_MESSAGE_PAYLOAD",
    EMBEDDINGS_NOT_CONFIGURED: "EMBEDDINGS_NOT_CONFIGURED",
    INVOCATION_FAILED: "INVOCATION_FAILED",
    STREAM_FAILED: "STREAM_FAILED",
    EMBEDDING_FAILED: "EMBEDDING_FAILED",
} as const

/**
 * LangChain adapter error code literal.
 */
export type LangChainAdapterErrorCode =
    (typeof LANGCHAIN_ADAPTER_ERROR_CODE)[keyof typeof LANGCHAIN_ADAPTER_ERROR_CODE]

/**
 * Structured metadata for LangChain adapter failures.
 */
export interface ILangChainAdapterErrorDetails {
    /**
     * Original error message when available.
     */
    readonly causeMessage?: string
}

/**
 * Error thrown by LangChain adapter.
 */
export class LangChainAdapterError extends Error {
    /**
     * Stable machine-readable error code.
     */
    public readonly code: LangChainAdapterErrorCode

    /**
     * Original error message when available.
     */
    public readonly causeMessage?: string

    /**
     * Creates LangChain adapter error.
     *
     * @param code Stable machine-readable error code.
     * @param details Optional normalized error metadata.
     */
    public constructor(
        code: LangChainAdapterErrorCode,
        details: ILangChainAdapterErrorDetails = {},
    ) {
        super(buildLangChainAdapterErrorMessage(code))
        this.name = "LangChainAdapterError"
        this.code = code
        this.causeMessage = details.causeMessage
    }
}

/**
 * Builds public error message for a LangChain adapter error code.
 *
 * @param code Error code.
 * @returns Public error message.
 */
function buildLangChainAdapterErrorMessage(code: LangChainAdapterErrorCode): string {
    switch (code) {
        case LANGCHAIN_ADAPTER_ERROR_CODE.INVALID_CHAT_MODEL:
            return "LangChain adapter requires chatModel with invoke() method"
        case LANGCHAIN_ADAPTER_ERROR_CODE.INVALID_REQUEST_MAPPER:
            return "LangChain adapter requestMapper must be a function when provided"
        case LANGCHAIN_ADAPTER_ERROR_CODE.INVALID_MESSAGE_PAYLOAD:
            return "LangChain adapter cannot build prompt from empty chat request messages"
        case LANGCHAIN_ADAPTER_ERROR_CODE.EMBEDDINGS_NOT_CONFIGURED:
            return "LangChain adapter requires embeddings implementation for embed()"
        case LANGCHAIN_ADAPTER_ERROR_CODE.INVOCATION_FAILED:
            return "LangChain adapter chat invocation failed"
        case LANGCHAIN_ADAPTER_ERROR_CODE.STREAM_FAILED:
            return "LangChain adapter stream invocation failed"
        case LANGCHAIN_ADAPTER_ERROR_CODE.EMBEDDING_FAILED:
            return "LangChain adapter embedding invocation failed"
    }
}
