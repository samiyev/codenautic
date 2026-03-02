/**
 * Stable error codes exposed by Context ACL adapters.
 */
export const CONTEXT_ACL_ERROR_CODE = {
    INVALID_PAYLOAD: "CONTEXT_ACL_INVALID_PAYLOAD",
} as const

/**
 * Union type for Context ACL error codes.
 */
export type ContextAclErrorCode = (typeof CONTEXT_ACL_ERROR_CODE)[keyof typeof CONTEXT_ACL_ERROR_CODE]

/**
 * Construction params for Context ACL errors.
 */
export interface ICreateContextAclErrorParams {
    readonly code: ContextAclErrorCode
    readonly message: string
    readonly retryable: boolean
    readonly cause?: Error
}

/**
 * Normalized adapter error used by Context ACL contracts.
 */
export class ContextAclError extends Error {
    public readonly code: ContextAclErrorCode
    public readonly retryable: boolean
    public readonly cause?: Error

    /**
     * Creates normalized Context ACL error instance.
     *
     * @param params Error initialization parameters.
     */
    public constructor(params: ICreateContextAclErrorParams) {
        super(params.message)
        this.name = "ContextAclError"
        this.code = params.code
        this.retryable = params.retryable
        this.cause = params.cause
    }
}
