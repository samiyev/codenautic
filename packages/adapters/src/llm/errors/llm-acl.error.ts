/**
 * Stable error codes exposed by LLM ACL adapters.
 */
export const LLM_ACL_ERROR_CODE = {
    INVALID_REQUEST: "LLM_ACL_INVALID_REQUEST",
    INVALID_RESPONSE: "LLM_ACL_INVALID_RESPONSE",
    RATE_LIMITED: "LLM_ACL_RATE_LIMITED",
    UNAUTHORIZED: "LLM_ACL_UNAUTHORIZED",
    PROVIDER_UNAVAILABLE: "LLM_ACL_PROVIDER_UNAVAILABLE",
    UNKNOWN: "LLM_ACL_UNKNOWN",
} as const

/**
 * Union type for LLM ACL error codes.
 */
export type LlmAclErrorCode = (typeof LLM_ACL_ERROR_CODE)[keyof typeof LLM_ACL_ERROR_CODE]

/**
 * Construction params for normalized LLM ACL errors.
 */
export interface ICreateLlmAclErrorParams {
    readonly code: LlmAclErrorCode
    readonly message: string
    readonly statusCode?: number
    readonly retryable: boolean
    readonly fallbackRecommended: boolean
    readonly retryAfterSeconds?: number
    readonly cause?: Error
}

/**
 * Normalized adapter error used by LLM ACL contracts.
 */
export class LlmAclError extends Error {
    public readonly code: LlmAclErrorCode
    public readonly statusCode?: number
    public readonly retryable: boolean
    public readonly fallbackRecommended: boolean
    public readonly retryAfterSeconds?: number
    public readonly cause?: Error

    /**
     * Creates normalized LLM ACL error instance.
     *
     * @param params Error initialization parameters.
     */
    public constructor(params: ICreateLlmAclErrorParams) {
        super(params.message)
        this.name = "LlmAclError"
        this.code = params.code
        this.statusCode = params.statusCode
        this.retryable = params.retryable
        this.fallbackRecommended = params.fallbackRecommended
        this.retryAfterSeconds = params.retryAfterSeconds
        this.cause = params.cause
    }
}
