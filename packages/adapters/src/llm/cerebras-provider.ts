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
    CerebrasProviderError,
    type ICerebrasProviderErrorDetails,
} from "./cerebras-provider.error"

const DEFAULT_CEREBRAS_BASE_URL = "https://api.cerebras.ai/v1"

/**
 * Minimal OpenAI-compatible client accepted by Cerebras provider.
 */
export interface ICerebrasClient extends IOpenAIClient {}

/**
 * Cerebras provider constructor options.
 */
export interface ICerebrasProviderOptions {
    /**
     * API key used when SDK client is constructed internally.
     */
    readonly apiKey?: string

    /**
     * Optional alternative Cerebras-compatible base URL.
     */
    readonly baseUrl?: string

    /**
     * Embedding model used by `embed()`.
     */
    readonly embeddingModel?: string

    /**
     * Optional injected OpenAI-compatible client for tests.
     */
    readonly client?: ICerebrasClient

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
 * Cerebras implementation of the shared LLM provider contract.
 */
export class CerebrasProvider implements ILLMProvider {
    private readonly openAiCompatibleProvider: OpenAIProvider

    /**
     * Creates Cerebras provider.
     *
     * @param options Provider options.
     */
    public constructor(options: ICerebrasProviderOptions) {
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
            throw mapCerebrasProviderError(error)
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
            throw mapCerebrasProviderError(error)
        }

        return createCerebrasStreamingResponse(stream)
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
            throw mapCerebrasProviderError(error)
        }
    }
}

/**
 * Maps Cerebras provider options into OpenAI-compatible provider options.
 *
 * @param options Cerebras provider options.
 * @returns OpenAI-compatible options.
 */
function buildOpenAiCompatibleOptions(options: ICerebrasProviderOptions): IOpenAIProviderOptions {
    return {
        apiKey: options.apiKey,
        baseUrl: options.baseUrl ?? DEFAULT_CEREBRAS_BASE_URL,
        embeddingModel: options.embeddingModel,
        client: options.client,
        retryMaxAttempts: options.retryMaxAttempts,
        sleep: options.sleep,
        requestNormalizationOptions: options.requestNormalizationOptions,
        responseNormalizationOptions: options.responseNormalizationOptions,
    }
}

/**
 * Maps unknown provider error into typed Cerebras provider error.
 *
 * @param error Unknown upstream error.
 * @returns Typed Cerebras provider error.
 */
function mapCerebrasProviderError(error: unknown): CerebrasProviderError {
    if (error instanceof CerebrasProviderError) {
        return error
    }

    if (error instanceof OpenAIProviderError) {
        const details: ICerebrasProviderErrorDetails = {
            statusCode: error.statusCode,
            code: error.code,
            type: error.type,
            retryAfterMs: error.retryAfterMs,
            isRetryable: error.isRetryable,
        }

        return new CerebrasProviderError(error.message, details)
    }

    if (error instanceof Error) {
        return new CerebrasProviderError(error.message, {
            isRetryable: false,
        })
    }

    return new CerebrasProviderError("Cerebras request failed", {
        isRetryable: false,
    })
}

/**
 * Creates streaming response wrapper with Cerebras error mapping.
 *
 * @param stream Source stream.
 * @returns Wrapped stream.
 */
function createCerebrasStreamingResponse(
    stream: IStreamingChatResponseDTO,
): IStreamingChatResponseDTO {
    return {
        async *[Symbol.asyncIterator](): AsyncIterator<IChatChunkDTO> {
            try {
                for await (const chunk of stream) {
                    yield chunk
                }
            } catch (error) {
                throw mapCerebrasProviderError(error)
            }
        },
    }
}
