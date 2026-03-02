/**
 * Supported LLM providers for ACL contracts.
 */
export const LLM_PROVIDER = {
    OPENAI: "openai",
    ANTHROPIC: "anthropic",
} as const

/**
 * Supported LLM provider label.
 */
export type LlmProvider = (typeof LLM_PROVIDER)[keyof typeof LLM_PROVIDER]

/**
 * Unified finish reason set for domain DTOs.
 */
export const LLM_FINISH_REASON = {
    STOP: "stop",
    LENGTH: "length",
    CONTENT_FILTER: "content_filter",
    UNKNOWN: "unknown",
} as const

/**
 * Unified finish reason value.
 */
export type LlmFinishReason = (typeof LLM_FINISH_REASON)[keyof typeof LLM_FINISH_REASON]

/**
 * Stable input DTO used by LLM ACLs.
 */
export interface ILlmCompletionRequestDto {
    readonly provider: LlmProvider
    readonly model: string
    readonly prompt: string
    readonly systemPrompt?: string
    readonly maxOutputTokens: number
    readonly temperature: number
    readonly correlationId: string
}

/**
 * Stable usage DTO produced by LLM ACLs.
 */
export interface ILlmCompletionUsageDto {
    readonly inputTokens: number
    readonly outputTokens: number
    readonly totalTokens: number
    readonly estimatedCostUsd: number
}

/**
 * Stable output DTO produced by LLM ACLs.
 */
export interface ILlmCompletionResponseDto {
    readonly provider: LlmProvider
    readonly model: string
    readonly responseId: string
    readonly content: string
    readonly finishReason: LlmFinishReason
    readonly usage: ILlmCompletionUsageDto
}

/**
 * OpenAI request payload shape used by adapter contracts.
 */
export interface IOpenAiCompletionRequest {
    readonly model: string
    readonly messages: readonly {
        readonly role: "system" | "user"
        readonly content: string
    }[]
    readonly max_tokens: number
    readonly temperature: number
    readonly metadata: {
        readonly correlation_id: string
    }
}

/**
 * Anthropic request payload shape used by adapter contracts.
 */
export interface IAnthropicCompletionRequest {
    readonly model: string
    readonly system?: string
    readonly messages: readonly {
        readonly role: "user"
        readonly content: readonly {
            readonly type: "text"
            readonly text: string
        }[]
    }[]
    readonly max_tokens: number
    readonly temperature: number
    readonly metadata: {
        readonly correlation_id: string
    }
}

/**
 * Token pricing metadata for normalized cost estimation.
 */
export interface ILlmModelPricing {
    readonly inputPer1kUsd: number
    readonly outputPer1kUsd: number
}

/**
 * Built-in pricing table for deterministic contract tests.
 */
export const LLM_MODEL_PRICING: Readonly<Record<string, ILlmModelPricing>> = {
    "gpt-4o-mini": {
        inputPer1kUsd: 0.00015,
        outputPer1kUsd: 0.0006,
    },
    "claude-3-5-haiku-latest": {
        inputPer1kUsd: 0.00025,
        outputPer1kUsd: 0.00125,
    },
}
