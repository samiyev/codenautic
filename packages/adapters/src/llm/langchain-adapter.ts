import type {
    IChatChunkDTO,
    IChatRequestDTO,
    IChatResponseDTO,
    ILLMProvider,
    IStreamingChatResponseDTO,
} from "@codenautic/core"

import {
    LANGCHAIN_ADAPTER_ERROR_CODE,
    LangChainAdapterError,
} from "./langchain-adapter.error"

interface ILangChainMessageLike {
    readonly content: unknown
}

/**
 * Minimal LangChain chat model contract used by adapter.
 */
export interface ILangChainChatModel {
    /**
     * Executes one non-streaming model invocation.
     *
     * @param input Prompt input.
     * @param options Optional invocation options.
     * @returns LangChain response message.
     */
    invoke(input: string, options?: unknown): Promise<ILangChainMessageLike>

    /**
     * Executes one streaming model invocation.
     *
     * @param input Prompt input.
     * @param options Optional invocation options.
     * @returns LangChain streaming message chunks.
     */
    stream(input: string, options?: unknown): AsyncIterable<ILangChainMessageLike>
}

/**
 * Minimal LangChain embeddings contract used by adapter.
 */
export interface ILangChainEmbeddings {
    /**
     * Creates embeddings for provided text documents.
     *
     * @param texts Input texts.
     * @returns Embedding vectors.
     */
    embedDocuments(texts: readonly string[]): Promise<readonly number[][]>
}

/**
 * LangChain invocation payload produced from core chat request.
 */
export interface ILangChainAdapterInput {
    /**
     * Prompt text passed into LangChain model.
     */
    readonly input: string

    /**
     * Optional provider-specific invocation options.
     */
    readonly options?: unknown
}

/**
 * Request mapper from core DTO into LangChain model input.
 */
export type LangChainRequestMapper = (
    request: IChatRequestDTO,
) => ILangChainAdapterInput

/**
 * Constructor options for LangChain adapter.
 */
export interface ILangChainAdapterOptions {
    /**
     * LangChain chat model implementation.
     */
    readonly chatModel: ILangChainChatModel

    /**
     * Optional LangChain embeddings implementation.
     */
    readonly embeddings?: ILangChainEmbeddings

    /**
     * Optional custom mapper from core chat request to LangChain input.
     */
    readonly requestMapper?: LangChainRequestMapper
}

/**
 * Adapter that bridges LangChain models into core ILLMProvider contract.
 */
export class LangChainAdapter implements ILLMProvider {
    private readonly chatModel: ILangChainChatModel
    private readonly embeddings?: ILangChainEmbeddings
    private readonly requestMapper: LangChainRequestMapper

    /**
     * Creates LangChain adapter.
     *
     * @param options Adapter options.
     */
    public constructor(options: ILangChainAdapterOptions) {
        this.chatModel = validateChatModel(options.chatModel)
        this.embeddings = options.embeddings
        this.requestMapper = validateRequestMapper(options.requestMapper)
    }

    /**
     * Executes non-streaming chat request through LangChain invoke API.
     *
     * @param request Core chat request DTO.
     * @returns Core chat response DTO.
     */
    public async chat(request: IChatRequestDTO): Promise<IChatResponseDTO> {
        const mapped = this.requestMapper(request)

        try {
            const message = await this.chatModel.invoke(mapped.input, mapped.options)

            return {
                content: normalizeLangChainContent(message.content),
                usage: {
                    input: 0,
                    output: 0,
                    total: 0,
                },
            }
        } catch (error) {
            throw new LangChainAdapterError(
                LANGCHAIN_ADAPTER_ERROR_CODE.INVOCATION_FAILED,
                {
                    causeMessage: resolveCauseMessage(error),
                },
            )
        }
    }

    /**
     * Executes streaming chat request through LangChain stream API.
     *
     * @param request Core chat request DTO.
     * @returns Core streaming chat response.
     */
    public stream(request: IChatRequestDTO): IStreamingChatResponseDTO {
        const mapped = this.requestMapper(request)
        let stream: AsyncIterable<ILangChainMessageLike>

        try {
            stream = this.chatModel.stream(mapped.input, mapped.options)
        } catch (error) {
            throw new LangChainAdapterError(
                LANGCHAIN_ADAPTER_ERROR_CODE.STREAM_FAILED,
                {
                    causeMessage: resolveCauseMessage(error),
                },
            )
        }

        return createStreamingResponse(stream)
    }

    /**
     * Creates embeddings through LangChain embeddings API.
     *
     * @param texts Input text chunks.
     * @returns Embedding vectors.
     */
    public async embed(texts: readonly string[]): Promise<readonly number[][]> {
        if (this.embeddings === undefined) {
            throw new LangChainAdapterError(
                LANGCHAIN_ADAPTER_ERROR_CODE.EMBEDDINGS_NOT_CONFIGURED,
            )
        }

        try {
            return await this.embeddings.embedDocuments(texts)
        } catch (error) {
            throw new LangChainAdapterError(
                LANGCHAIN_ADAPTER_ERROR_CODE.EMBEDDING_FAILED,
                {
                    causeMessage: resolveCauseMessage(error),
                },
            )
        }
    }
}

/**
 * Validates LangChain chat model contract.
 *
 * @param chatModel Chat model candidate.
 * @returns Validated chat model.
 */
function validateChatModel(chatModel: ILangChainChatModel): ILangChainChatModel {
    if (typeof chatModel.invoke !== "function" || typeof chatModel.stream !== "function") {
        throw new LangChainAdapterError(
            LANGCHAIN_ADAPTER_ERROR_CODE.INVALID_CHAT_MODEL,
        )
    }

    return chatModel
}

/**
 * Validates custom request mapper or returns default mapper.
 *
 * @param requestMapper Optional custom request mapper.
 * @returns Validated mapper.
 */
function validateRequestMapper(
    requestMapper?: LangChainRequestMapper,
): LangChainRequestMapper {
    if (requestMapper === undefined) {
        return mapRequestToPrompt
    }

    if (typeof requestMapper !== "function") {
        throw new LangChainAdapterError(
            LANGCHAIN_ADAPTER_ERROR_CODE.INVALID_REQUEST_MAPPER,
        )
    }

    return requestMapper
}

/**
 * Maps core chat request messages into default LangChain prompt text.
 *
 * @param request Core chat request.
 * @returns LangChain invocation input.
 */
function mapRequestToPrompt(request: IChatRequestDTO): ILangChainAdapterInput {
    if (request.messages.length === 0) {
        throw new LangChainAdapterError(
            LANGCHAIN_ADAPTER_ERROR_CODE.INVALID_MESSAGE_PAYLOAD,
        )
    }

    const segments = request.messages
        .map((message): string => toPromptSegment(message.role, message.content, message.name))
        .filter((segment): boolean => segment.length > 0)

    if (segments.length === 0) {
        throw new LangChainAdapterError(
            LANGCHAIN_ADAPTER_ERROR_CODE.INVALID_MESSAGE_PAYLOAD,
        )
    }

    return {
        input: segments.join("\n\n"),
    }
}

/**
 * Converts one message into prompt segment.
 *
 * @param role Message role.
 * @param content Message content.
 * @param name Optional message name.
 * @returns Prompt segment.
 */
function toPromptSegment(role: string, content: string, name?: string): string {
    const normalizedContent = content.trim()
    if (normalizedContent.length === 0) {
        return ""
    }

    const normalizedRole = role.trim().toUpperCase()
    const normalizedName = name?.trim() ?? ""
    if (normalizedName.length > 0) {
        return `[${normalizedRole}:${normalizedName}] ${normalizedContent}`
    }

    return `[${normalizedRole}] ${normalizedContent}`
}

/**
 * Wraps LangChain stream into core streaming DTO.
 *
 * @param stream LangChain stream.
 * @returns Core streaming response.
 */
function createStreamingResponse(
    stream: AsyncIterable<ILangChainMessageLike>,
): IStreamingChatResponseDTO {
    return {
        async *[Symbol.asyncIterator](): AsyncIterator<IChatChunkDTO> {
            try {
                for await (const message of stream) {
                    yield {
                        delta: normalizeLangChainContent(message.content),
                    }
                }
            } catch (error) {
                throw new LangChainAdapterError(
                    LANGCHAIN_ADAPTER_ERROR_CODE.STREAM_FAILED,
                    {
                        causeMessage: resolveCauseMessage(error),
                    },
                )
            }
        },
    }
}

/**
 * Normalizes LangChain content payload into plain string.
 *
 * @param content LangChain content payload.
 * @returns Plain string content.
 */
function normalizeLangChainContent(content: unknown): string {
    if (typeof content === "string") {
        return content
    }

    if (Array.isArray(content)) {
        return content
            .map((chunk): string => normalizeLangChainContent(chunk))
            .join("")
    }

    if (isRecord(content)) {
        const textValue = content["text"]
        if (typeof textValue === "string") {
            return textValue
        }

        return safeStringify(content)
    }

    if (content === null || content === undefined) {
        return ""
    }

    if (typeof content === "number" || typeof content === "boolean") {
        return String(content)
    }

    return ""
}

/**
 * Type guard for object records.
 *
 * @param value Unknown value.
 * @returns True when value is object record.
 */
function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
    return typeof value === "object" && value !== null
}

/**
 * Safely stringifies record values.
 *
 * @param value Record payload.
 * @returns JSON string when serialization succeeds, empty string otherwise.
 */
function safeStringify(value: Readonly<Record<string, unknown>>): string {
    try {
        return JSON.stringify(value)
    } catch {
        return ""
    }
}

/**
 * Resolves safe lower-level cause message from unknown error.
 *
 * @param error Unknown error payload.
 * @returns Cause message or undefined.
 */
function resolveCauseMessage(error: unknown): string | undefined {
    if (error instanceof Error) {
        return error.message
    }
    if (typeof error === "string") {
        return error
    }
    return undefined
}
