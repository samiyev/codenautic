import {type LlmProvider} from "../contracts/completion.contract"
import {type LlmAclError} from "../errors/llm-acl.error"

/**
 * Provider fallback policy for LLM completion adapters.
 */
export class LlmFallbackPolicy {
    /**
     * Creates fallback policy instance.
     */
    public constructor() {}

    /**
     * Builds deterministic provider chain with deduplication.
     *
     * @param primary Primary provider.
     * @param fallbackProviders Preferred fallback providers.
     * @returns Ordered deduplicated provider chain.
     */
    public buildProviderChain(
        primary: LlmProvider,
        fallbackProviders: readonly LlmProvider[],
    ): readonly LlmProvider[] {
        const chain: LlmProvider[] = [primary]
        for (const provider of fallbackProviders) {
            if (chain.includes(provider) === false) {
                chain.push(provider)
            }
        }

        return chain
    }

    /**
     * Returns next provider candidate for fallback execution.
     *
     * @param chain Ordered provider chain.
     * @param attempted Providers already attempted.
     * @param error Error returned by previous provider.
     * @returns Next provider or undefined when fallback must stop.
     */
    public nextProvider(
        chain: readonly LlmProvider[],
        attempted: readonly LlmProvider[],
        error: LlmAclError,
    ): LlmProvider | undefined {
        if (this.shouldFallback(error) === false) {
            return undefined
        }

        for (const provider of chain) {
            if (attempted.includes(provider) === false) {
                return provider
            }
        }

        return undefined
    }

    /**
     * Checks whether fallback flow is allowed for normalized error.
     *
     * @param error Normalized ACL error.
     * @returns True when fallback should continue.
     */
    private shouldFallback(error: LlmAclError): boolean {
        return error.retryable && error.fallbackRecommended
    }
}
