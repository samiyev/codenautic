import {type Result} from "@codenautic/core"

import {type ILlmCompletionRequestDto, type ILlmCompletionResponseDto} from "../contracts/completion.contract"
import {type LlmAclError} from "../errors/llm-acl.error"

/**
 * Provider-specific completion ACL contract.
 *
 * @template TProviderRequest Provider request payload shape.
 */
export interface ICompletionAcl<TProviderRequest> {
    /**
     * Maps stable domain request DTO into provider request payload.
     *
     * @param request Stable domain request DTO.
     * @returns Provider request or normalized error.
     */
    transformRequest(request: ILlmCompletionRequestDto): Result<TProviderRequest, LlmAclError>

    /**
     * Maps provider response payload into stable domain DTO.
     *
     * @param response Provider response payload.
     * @returns Stable response DTO or normalized error.
     */
    transformResponse(response: unknown): Result<ILlmCompletionResponseDto, LlmAclError>

    /**
     * Normalizes provider errors into stable ACL error model.
     *
     * @param error Unknown provider error.
     * @returns Normalized ACL error.
     */
    normalizeError(error: unknown): LlmAclError

    /**
     * Returns retry decision for normalized ACL error.
     *
     * @param error Normalized ACL error.
     * @returns True when request is retryable.
     */
    shouldRetry(error: LlmAclError): boolean
}
