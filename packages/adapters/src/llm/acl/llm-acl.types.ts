import type {IChatResponseDTO} from "@codenautic/core"

/**
 * Supported provider kinds for LLM ACL normalization.
 */
export const LLM_ACL_PROVIDER = {
    OPENAI: "OPENAI",
    ANTHROPIC: "ANTHROPIC",
} as const

/**
 * LLM ACL provider literal type.
 */
export type LlmAclProvider = (typeof LLM_ACL_PROVIDER)[keyof typeof LLM_ACL_PROVIDER]

/**
 * Pricing profile used for fallback cost estimation.
 */
export interface ILlmAclPricing {
    /**
     * Price in USD for 1000 input tokens.
     */
    readonly inputPer1kUsd: number

    /**
     * Price in USD for 1000 output tokens.
     */
    readonly outputPer1kUsd: number
}

/**
 * Request normalization options.
 */
export interface ILlmAclRequestNormalizationOptions {
    /**
     * Optional provider-specific fallback models.
     */
    readonly fallbackModelByProvider?: Partial<Record<LlmAclProvider, string>>

    /**
     * Default max tokens for Anthropic request shape.
     */
    readonly anthropicDefaultMaxTokens?: number
}

/**
 * Response normalization options.
 */
export interface ILlmAclResponseNormalizationOptions {
    /**
     * Optional provider pricing map for estimated cost fallback.
     */
    readonly pricingByProvider?: Partial<Record<LlmAclProvider, ILlmAclPricing>>
}

/**
 * Result of provider response normalization.
 */
export interface ILlmAclNormalizedResponse {
    /**
     * Platform-agnostic chat response DTO.
     */
    readonly response: IChatResponseDTO

    /**
     * Estimated cost in USD.
     */
    readonly estimatedCostUsd: number
}
