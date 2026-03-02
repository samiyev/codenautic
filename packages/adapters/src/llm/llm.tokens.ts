import {createToken} from "@codenautic/core"

import {AnthropicCompletionAcl} from "./acl/anthropic-completion.acl"
import {OpenAiCompletionAcl} from "./acl/openai-completion.acl"
import {LlmFallbackPolicy} from "./fallback/llm-fallback.policy"

/**
 * LLM domain IoC tokens.
 */
export const LLM_TOKENS = {
    OpenAiCompletionAcl: createToken<OpenAiCompletionAcl>("adapters.llm.openai-completion-acl"),
    AnthropicCompletionAcl: createToken<AnthropicCompletionAcl>(
        "adapters.llm.anthropic-completion-acl",
    ),
    FallbackPolicy: createToken<LlmFallbackPolicy>("adapters.llm.fallback-policy"),
} as const
