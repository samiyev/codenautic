import type {IAntiCorruptionLayer, IChatRequestDTO} from "@codenautic/core"

import {
    normalizeLlmProviderRequest,
    type IAnthropicChatRequest,
    type IOpenAiChatRequest,
} from "./llm-acl-request-normalizer"
import {
    LLM_ACL_PROVIDER,
    type ILlmAclRequestNormalizationOptions,
} from "./llm-acl.types"

/**
 * OpenAI request ACL implementation.
 */
export class OpenAiRequestAcl implements IAntiCorruptionLayer<IChatRequestDTO, IOpenAiChatRequest> {
    private readonly options: ILlmAclRequestNormalizationOptions

    /**
     * Creates OpenAI request ACL instance.
     *
     * @param options Request normalization options.
     */
    public constructor(options: ILlmAclRequestNormalizationOptions = {}) {
        this.options = options
    }

    /**
     * Converts shared request DTO to OpenAI request payload.
     *
     * @param external Shared request DTO.
     * @returns OpenAI request payload.
     */
    public toDomain(external: IChatRequestDTO): IOpenAiChatRequest {
        return normalizeLlmProviderRequest(LLM_ACL_PROVIDER.OPENAI, external, this.options)
    }
}

/**
 * Anthropic request ACL implementation.
 */
export class AnthropicRequestAcl
    implements IAntiCorruptionLayer<IChatRequestDTO, IAnthropicChatRequest>
{
    private readonly options: ILlmAclRequestNormalizationOptions

    /**
     * Creates Anthropic request ACL instance.
     *
     * @param options Request normalization options.
     */
    public constructor(options: ILlmAclRequestNormalizationOptions = {}) {
        this.options = options
    }

    /**
     * Converts shared request DTO to Anthropic request payload.
     *
     * @param external Shared request DTO.
     * @returns Anthropic request payload.
     */
    public toDomain(external: IChatRequestDTO): IAnthropicChatRequest {
        return normalizeLlmProviderRequest(LLM_ACL_PROVIDER.ANTHROPIC, external, this.options)
    }
}
