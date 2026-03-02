/**
 * Stable error codes exposed by messaging adapters.
 */
export const MESSAGING_ADAPTER_ERROR_CODE = {
    INVALID_MESSAGE: "MESSAGING_ADAPTER_INVALID_MESSAGE",
} as const

/**
 * Union type for messaging adapter error codes.
 */
export type MessagingAdapterErrorCode =
    (typeof MESSAGING_ADAPTER_ERROR_CODE)[keyof typeof MESSAGING_ADAPTER_ERROR_CODE]

/**
 * Construction params for messaging adapter error.
 */
export interface ICreateMessagingAdapterErrorParams {
    readonly code: MessagingAdapterErrorCode
    readonly message: string
    readonly retryable: boolean
    readonly cause?: Error
}

/**
 * Normalized adapter error used by messaging contracts.
 */
export class MessagingAdapterError extends Error {
    public readonly code: MessagingAdapterErrorCode
    public readonly retryable: boolean
    public readonly cause?: Error

    /**
     * Creates normalized messaging adapter error instance.
     *
     * @param params Error initialization parameters.
     */
    public constructor(params: ICreateMessagingAdapterErrorParams) {
        super(params.message)
        this.name = "MessagingAdapterError"
        this.code = params.code
        this.retryable = params.retryable
        this.cause = params.cause
    }
}
