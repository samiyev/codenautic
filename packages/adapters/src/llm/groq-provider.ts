import type {
    IChatChunkDTO,
    IChatRequestDTO,
    IChatResponseDTO,
    ILLMProvider,
    IStreamingChatResponseDTO,
} from "@codenautic/core"

import type {
    ILlmAclRequestNormalizationOptions,
    ILlmAclResponseNormalizationOptions,
} from "./acl"
import {
    OpenAIProvider,
    type IOpenAIClient,
    type IOpenAIProviderOptions,
} from "./openai-provider"
import {OpenAIProviderError} from "./openai-provider.error"
import {
    GroqProviderError,
    type IGroqProviderErrorDetails,
} from "./groq-provider.error"

const DEFAULT_GROQ_BASE_URL = "https://api.groq.com/openai/v1"

/**
 * Minimal OpenAI-compatible client accepted by Groq provider.
 */
export interface IGroqClient extends IOpenAIClient {}

/**
 * Groq provider constructor options.
 */
export interface IGroqProviderOptions {
    /**
     * API key used when SDK client is constructed internally.
     */
    readonly apiKey?: string

    /**
     * Optional alternative Groq-compatible base URL.
     */
    readonly baseUrl?: string

    /**
     * Embedding model used by `embed()`.
     */
    readonly embeddingModel?: string

    /**
     * Optional injected OpenAI-compatible client for tests.
     */
    readonly client?: IGroqClient

    /**
     * Maximum retry attempts for retryable upstream failures.
     */
    readonly retryMaxAttempts?: number

    /**
     * Optional sleep implementation used between retries.
     */
    readonly sleep?: (delayMs: number) => Promise<void>

    /**
     * Optional ACL request normalization options.
     */
    readonly requestNormalizationOptions?: ILlmAclRequestNormalizationOptions

    /**
     * Optional ACL response normalization options.
     */
    readonly responseNormalizationOptions?: ILlmAclResponseNormalizationOptions
}

/**
 * Groq implementation of the shared LLM provider contract.
 */
export class GroqProvider implements ILLMProvider {
    private readonly openAiCompatibleProvider: OpenAIProvider

    /**
     * Creates Groq provider.
     *
     * @param options Provider options.
     */
    public constructor(options: IGroqProviderOptions) {
        this.openAiCompatibleProvider = new OpenAIProvider(
            buildOpenAiCompatibleOptions(options),
        )
    }

    /**
     * Executes chat completion request.
     *
     * @param request Shared chat request DTO.
     * @returns Shared chat response DTO.
     */
    public async chat(request: IChatRequestDTO): Promise<IChatResponseDTO> {
        try {
            return await this.openAiCompatibleProvider.chat(request)
        } catch (error) {
            throw mapGroqProviderError(error)
        }
    }

    /**
     * Executes streaming chat completion request.
     *
     * @param request Shared chat request DTO.
     * @returns Async stream of normalized chunks.
     */
    public stream(request: IChatRequestDTO): IStreamingChatResponseDTO {
        let stream: IStreamingChatResponseDTO

        try {
            stream = this.openAiCompatibleProvider.stream(request)
        } catch (error) {
            throw mapGroqProviderError(error)
        }

        return createGroqStreamingResponse(stream)
    }

    /**
     * Creates embedding vectors for provided texts.
     *
     * @param texts Input text chunks.
     * @returns Embedding vectors.
     */
    public async embed(texts: readonly string[]): Promise<readonly number[][]> {
        try {
            return await this.openAiCompatibleProvider.embed(texts)
        } catch (error) {
            throw mapGroqProviderError(error)
        }
    }
}

/**
 * Maps Groq provider options into OpenAI-compatible provider options.
 *
 * @param options Groq provider options.
 * @returns OpenAI-compatible options.
 */
function buildOpenAiCompatibleOptions(options: IGroqProviderOptions): IOpenAIProviderOptions {
    return {
        apiKey: options.apiKey,
        baseUrl: options.baseUrl ?? DEFAULT_GROQ_BASE_URL,
        embeddingModel: options.embeddingModel,
        client: options.client,
        retryMaxAttempts: options.retryMaxAttempts,
        sleep: options.sleep,
        requestNormalizationOptions: options.requestNormalizationOptions,
        responseNormalizationOptions: options.responseNormalizationOptions,
    }
}

/**
 * Maps unknown provider error into typed Groq provider error.
 *
 * @param error Unknown upstream error.
 * @returns Typed Groq provider error.
 */
function mapGroqProviderError(error: unknown): GroqProviderError {
    if (error instanceof GroqProviderError) {
        return error
    }

    if (error instanceof OpenAIProviderError) {
        const details: IGroqProviderErrorDetails = {
            statusCode: error.statusCode,
            code: error.code,
            type: error.type,
            retryAfterMs: error.retryAfterMs,
            isRetryable: error.isRetryable,
        }

        return new GroqProviderError(error.message, details)
    }

    if (error instanceof Error) {
        return new GroqProviderError(error.message, {
            isRetryable: false,
        })
    }

    return new GroqProviderError("Groq request failed", {
        isRetryable: false,
    })
}

/**
 * Creates streaming response wrapper with Groq error mapping.
 *
 * @param stream Source stream.
 * @returns Wrapped stream.
 */
function createGroqStreamingResponse(stream: IStreamingChatResponseDTO): IStreamingChatResponseDTO {
    return {
        async *[Symbol.asyncIterator](): AsyncIterator<IChatChunkDTO> {
            try {
                for await (const chunk of stream) {
                    yield chunk
                }
            } catch (error) {
                throw mapGroqProviderError(error)
            }
        },
    }
}
