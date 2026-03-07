import {createToken, type ILLMProvider} from "@codenautic/core"

/**
 * DI tokens for llm adapter domain.
 */
export const LLM_TOKENS = {
    Provider: createToken<ILLMProvider>("adapters.llm.provider"),
} as const
