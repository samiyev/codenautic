import type {IAntiCorruptionLayer} from "@codenautic/core"

import {normalizeLlmProviderResponse} from "./llm-acl-response-normalizer"
import {
    LLM_ACL_PROVIDER,
    type ILlmAclNormalizedResponse,
    type ILlmAclResponseNormalizationOptions,
} from "./llm-acl.types"

/**
 * OpenAI response ACL implementation.
 */
export class OpenAiResponseAcl implements IAntiCorruptionLayer<unknown, ILlmAclNormalizedResponse> {
    private readonly options: ILlmAclResponseNormalizationOptions

    /**
     * Creates OpenAI response ACL instance.
     *
     * @param options Response normalization options.
     */
    public constructor(options: ILlmAclResponseNormalizationOptions = {}) {
        this.options = options
    }

    /**
     * Converts provider response payload to shared domain response.
     *
     * @param external Provider payload.
     * @returns Normalized response payload.
     */
    public toDomain(external: unknown): ILlmAclNormalizedResponse {
        return normalizeLlmProviderResponse(LLM_ACL_PROVIDER.OPENAI, external, this.options)
    }
}

/**
 * Anthropic response ACL implementation.
 */
export class AnthropicResponseAcl
    implements IAntiCorruptionLayer<unknown, ILlmAclNormalizedResponse>
{
    private readonly options: ILlmAclResponseNormalizationOptions

    /**
     * Creates Anthropic response ACL instance.
     *
     * @param options Response normalization options.
     */
    public constructor(options: ILlmAclResponseNormalizationOptions = {}) {
        this.options = options
    }

    /**
     * Converts provider response payload to shared domain response.
     *
     * @param external Provider payload.
     * @returns Normalized response payload.
     */
    public toDomain(external: unknown): ILlmAclNormalizedResponse {
        return normalizeLlmProviderResponse(LLM_ACL_PROVIDER.ANTHROPIC, external, this.options)
    }
}
