import {Container} from "@codenautic/core"

import {AnthropicCompletionAcl} from "./acl/anthropic-completion.acl"
import {OpenAiCompletionAcl} from "./acl/openai-completion.acl"
import {LlmFallbackPolicy} from "./fallback/llm-fallback.policy"
import {LLM_TOKENS} from "./llm.tokens"

/**
 * Optional dependency overrides for llm module registration.
 */
export interface ILlmModuleOverrides {
    openAiCompletionAcl?: OpenAiCompletionAcl
    anthropicCompletionAcl?: AnthropicCompletionAcl
    fallbackPolicy?: LlmFallbackPolicy
}

/**
 * Registers llm adapter module into target container.
 *
 * @param container Target IoC container.
 * @param overrides Optional dependency overrides.
 * @returns Same container instance for chaining.
 */
export function registerLlmModule(
    container: Container,
    overrides: ILlmModuleOverrides = {},
): Container {
    container.bindSingleton(LLM_TOKENS.OpenAiCompletionAcl, () => {
        return overrides.openAiCompletionAcl ?? new OpenAiCompletionAcl()
    })
    container.bindSingleton(LLM_TOKENS.AnthropicCompletionAcl, () => {
        return overrides.anthropicCompletionAcl ?? new AnthropicCompletionAcl()
    })
    container.bindSingleton(LLM_TOKENS.FallbackPolicy, () => {
        return overrides.fallbackPolicy ?? new LlmFallbackPolicy()
    })

    return container
}
