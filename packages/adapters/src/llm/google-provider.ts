import {ApiError, GoogleGenAI} from "@google/genai"
import {
    CHAT_FINISH_REASON,
    CHAT_RESPONSE_FORMAT,
    MESSAGE_ROLE,
    type IChatChunkDTO,
    type IChatRequestDTO,
    type IChatResponseDTO,
    type IChatResponseFormatDTO,
    type ILLMProvider,
    type IMessageDTO,
    type IStreamingChatResponseDTO,
    type ITokenUsageDTO,
    type IToolCallDTO,
    type IToolDefinitionDTO,
} from "@codenautic/core"

import {
    GoogleProviderError,
    type IGoogleProviderErrorDetails,
} from "./google-provider.error"

const DEFAULT_CHAT_MODEL = "gemini-2.5-flash"
const DEFAULT_EMBEDDING_MODEL = "text-embedding-004"
const DEFAULT_RETRY_MAX_ATTEMPTS = 3
const DEFAULT_RETRY_BASE_DELAY_MS = 250
const CONTENT_FILTER_FINISH_REASONS = new Set([
    "SAFETY",
    "BLOCKLIST",
    "PROHIBITED_CONTENT",
    "SPII",
    "IMAGE_SAFETY",
    "IMAGE_PROHIBITED_CONTENT",
])
const DIRECT_FINISH_REASON_MAP: Readonly<Record<string, string>> = {
    STOP: CHAT_FINISH_REASON.STOP,
    MAX_TOKENS: CHAT_FINISH_REASON.LENGTH,
    MALFORMED_FUNCTION_CALL: CHAT_FINISH_REASON.TOOL_CALLS,
    UNEXPECTED_TOOL_CALL: CHAT_FINISH_REASON.TOOL_CALLS,
}

/**
 * Minimal Google content part payload.
 */
interface IGoogleContentPart {
    readonly text: string
}

/**
 * Minimal Google content payload.
 */
interface IGoogleContent {
    readonly role: "user" | "model"
    readonly parts: readonly IGoogleContentPart[]
}

/**
 * Minimal Google function declaration payload.
 */
interface IGoogleFunctionDeclaration {
    readonly name: string
    readonly description?: string
    readonly parametersJsonSchema: Readonly<Record<string, unknown>>
}

/**
 * Minimal Google tool payload.
 */
interface IGoogleTool {
    readonly functionDeclarations: readonly IGoogleFunctionDeclaration[]
}

/**
 * Minimal Google generate-content config payload.
 */
interface IGoogleGenerateContentConfig {
    readonly systemInstruction?: string
    readonly temperature?: number
    readonly maxOutputTokens?: number
    readonly responseMimeType?: string
    readonly responseJsonSchema?: Readonly<Record<string, unknown>>
    readonly tools?: readonly IGoogleTool[]
}

/**
 * Minimal Google generate-content request payload.
 */
interface IGoogleGenerateContentParameters {
    readonly model: string
    readonly contents: readonly IGoogleContent[]
    readonly config?: IGoogleGenerateContentConfig
}

/**
 * Minimal Google function call payload.
 */
interface IGoogleFunctionCall {
    readonly id?: string
    readonly name?: string
    readonly args?: Readonly<Record<string, unknown>>
}

/**
 * Minimal Google candidate content payload.
 */
interface IGoogleCandidateContent {
    readonly parts?: readonly {
        readonly text?: string
        readonly functionCall?: IGoogleFunctionCall
    }[]
}

/**
 * Minimal Google candidate payload.
 */
interface IGoogleCandidate {
    readonly finishReason?: string
    readonly content?: IGoogleCandidateContent
}

/**
 * Minimal Google usage metadata payload.
 */
interface IGoogleUsageMetadata {
    readonly promptTokenCount?: number
    readonly candidatesTokenCount?: number
    readonly totalTokenCount?: number
}

/**
 * Minimal Google generate-content response payload.
 */
interface IGoogleGenerateContentResponse {
    readonly text?: string
    readonly functionCalls?: readonly IGoogleFunctionCall[]
    readonly candidates?: readonly IGoogleCandidate[]
    readonly usageMetadata?: IGoogleUsageMetadata
}

/**
 * Minimal Google embed-content request payload.
 */
interface IGoogleEmbedContentParameters {
    readonly model: string
    readonly contents: readonly string[]
}

/**
 * Minimal Google content embedding payload.
 */
interface IGoogleContentEmbedding {
    readonly values?: readonly number[]
}

/**
 * Minimal Google embed-content response payload.
 */
interface IGoogleEmbedContentResponse {
    readonly embeddings?: readonly IGoogleContentEmbedding[]
}

/**
 * Minimal subset of Google GenAI SDK used by adapter implementation.
 */
export interface IGoogleGenAIClient {
    readonly models: {
        readonly generateContent: (
            params: IGoogleGenerateContentParameters,
        ) => Promise<IGoogleGenerateContentResponse>
        readonly generateContentStream: (
            params: IGoogleGenerateContentParameters,
        ) => Promise<AsyncIterable<IGoogleGenerateContentResponse>>
        readonly embedContent: (
            params: IGoogleEmbedContentParameters,
        ) => Promise<IGoogleEmbedContentResponse>
    }
}

/**
 * Google provider constructor options.
 */
export interface IGoogleProviderOptions {
    /**
     * API key used when SDK client is constructed internally.
     */
    readonly apiKey?: string

    /**
     * Optional API version override.
     */
    readonly apiVersion?: string

    /**
     * Embedding model used by `embed()`.
     */
    readonly embeddingModel?: string

    /**
     * Optional injected Google-compatible client for tests.
     */
    readonly client?: IGoogleGenAIClient

    /**
     * Maximum retry attempts for retryable upstream failures.
     */
    readonly retryMaxAttempts?: number

    /**
     * Optional sleep implementation used between retries.
     */
    readonly sleep?: (delayMs: number) => Promise<void>
}

/**
 * Google (Gemini) implementation of the shared LLM provider contract.
 */
export class GoogleProvider implements ILLMProvider {
    private readonly client: IGoogleGenAIClient
    private readonly embeddingModel: string
    private readonly retryMaxAttempts: number
    private readonly sleep: (delayMs: number) => Promise<void>

    /**
     * Creates Google provider.
     *
     * @param options Provider options.
     */
    public constructor(options: IGoogleProviderOptions) {
        this.client = options.client ?? createGoogleClient(options)
        this.embeddingModel = normalizeOptionalText(options.embeddingModel) ?? DEFAULT_EMBEDDING_MODEL
        this.retryMaxAttempts = normalizeRetryMaxAttempts(options.retryMaxAttempts)
        this.sleep = options.sleep ?? defaultSleep
    }

    /**
     * Executes chat completion request.
     *
     * @param request Shared chat request DTO.
     * @returns Shared chat response DTO.
     */
    public async chat(request: IChatRequestDTO): Promise<IChatResponseDTO> {
        const response = await this.executeRequest(() => {
            return this.client.models.generateContent(buildGoogleGenerateContentParameters(request))
        })

        return normalizeGoogleChatResponse(response)
    }

    /**
     * Executes streaming chat completion request.
     *
     * @param request Shared chat request DTO.
     * @returns Async stream of normalized chunks.
     */
    public stream(request: IChatRequestDTO): IStreamingChatResponseDTO {
        const streamRequest = buildGoogleGenerateContentParameters(request)
        return createGoogleStreamingIterable(this.executeStreamingRequest(streamRequest))
    }

    /**
     * Builds embeddings for input texts.
     *
     * @param texts Source texts.
     * @returns Embedding vectors.
     */
    public async embed(texts: readonly string[]): Promise<readonly number[][]> {
        if (texts.length === 0) {
            return []
        }

        const normalizedTexts = normalizeEmbeddingTexts(texts)
        const response = await this.executeRequest(() => {
            return this.client.models.embedContent({
                model: this.embeddingModel,
                contents: normalizedTexts,
            })
        })

        return normalizeEmbeddingResponse(response, normalizedTexts.length)
    }

    /**
     * Executes initial streaming request with explicit streaming result typing.
     *
     * @param request Streaming request payload.
     * @returns Async iterable over Google chunks.
     */
    private executeStreamingRequest(
        request: IGoogleGenerateContentParameters,
    ): Promise<AsyncIterable<IGoogleGenerateContentResponse>> {
        return this.executeRequest<AsyncIterable<IGoogleGenerateContentResponse>>(() => {
            return this.client.models.generateContentStream(request)
        })
    }

    /**
     * Executes Google request with retry semantics.
     *
     * @param operation Async operation factory.
     * @returns Successful operation result.
     * @throws {GoogleProviderError} When retries are exhausted or request is not retryable.
     */
    private async executeRequest<TResult>(operation: () => Promise<TResult>): Promise<TResult> {
        let attempt = 0

        while (attempt < this.retryMaxAttempts) {
            attempt += 1

            try {
                return await operation()
            } catch (error) {
                const normalizedError = normalizeGoogleProviderError(error)

                if (normalizedError.isRetryable === false || attempt >= this.retryMaxAttempts) {
                    throw new GoogleProviderError(normalizedError.message, normalizedError)
                }

                await this.sleep(resolveRetryDelayMs(normalizedError.retryAfterMs, attempt))
            }
        }

        throw new GoogleProviderError("Google request failed", {
            isRetryable: false,
        })
    }
}

/**
 * Creates real Google GenAI SDK client.
 *
 * @param options Provider options.
 * @returns Google-compatible client.
 */
function createGoogleClient(options: IGoogleProviderOptions): IGoogleGenAIClient {
    const apiKey = normalizeRequiredText(options.apiKey, "apiKey")
    const client = new GoogleGenAI({
        apiKey,
        apiVersion: normalizeOptionalText(options.apiVersion),
    })

    return client as unknown as IGoogleGenAIClient
}

/**
 * Builds Google generate-content request payload from shared DTO.
 *
 * @param request Shared chat request.
 * @returns Google request payload.
 */
function buildGoogleGenerateContentParameters(
    request: IChatRequestDTO,
): IGoogleGenerateContentParameters {
    const systemInstruction = extractSystemInstruction(request.messages)
    const config = buildGoogleGenerateContentConfig(request, systemInstruction)
    const contents = toGoogleContents(request.messages)

    return {
        model: resolveModel(request.model),
        contents,
        config,
    }
}

/**
 * Builds Google generate-content config from shared DTO.
 *
 * @param request Shared chat request.
 * @param systemInstruction Optional system instruction.
 * @returns Google config payload.
 */
function buildGoogleGenerateContentConfig(
    request: IChatRequestDTO,
    systemInstruction: string | undefined,
): IGoogleGenerateContentConfig | undefined {
    const temperature = resolveTemperature(request.temperature)
    const maxOutputTokens = resolveMaxOutputTokens(request.maxTokens)
    const tools = toGoogleTools(request.tools)
    const responseFormatConfig = buildResponseFormatConfig(request.responseFormat)

    if (
        systemInstruction === undefined &&
        temperature === undefined &&
        maxOutputTokens === undefined &&
        tools === undefined &&
        responseFormatConfig === undefined
    ) {
        return undefined
    }

    return {
        systemInstruction,
        temperature,
        maxOutputTokens,
        tools,
        responseMimeType: responseFormatConfig?.responseMimeType,
        responseJsonSchema: responseFormatConfig?.responseJsonSchema,
    }
}

/**
 * Converts shared messages to Google content payloads.
 *
 * @param messages Shared message list.
 * @returns Google contents in original order.
 */
function toGoogleContents(messages: readonly IMessageDTO[]): readonly IGoogleContent[] {
    const contents: IGoogleContent[] = []

    for (const message of messages) {
        if (message.role === MESSAGE_ROLE.SYSTEM) {
            continue
        }

        contents.push({
            role: mapGoogleRole(message.role),
            parts: [
                {
                    text: normalizeMessageContent(message.content),
                },
            ],
        })
    }

    if (contents.length > 0) {
        return contents
    }

    const systemInstruction = extractSystemInstruction(messages)
    if (systemInstruction !== undefined) {
        return [
            {
                role: "user",
                parts: [
                    {
                        text: systemInstruction,
                    },
                ],
            },
        ]
    }

    return [
        {
            role: "user",
            parts: [
                {
                    text: "",
                },
            ],
        },
    ]
}

/**
 * Maps shared role to Google role.
 *
 * @param role Shared message role.
 * @returns Google role.
 */
function mapGoogleRole(role: string): "user" | "model" {
    if (role === MESSAGE_ROLE.ASSISTANT) {
        return "model"
    }

    return "user"
}

/**
 * Extracts system instruction from message collection.
 *
 * @param messages Shared message list.
 * @returns Joined system instruction when available.
 */
function extractSystemInstruction(messages: readonly IMessageDTO[]): string | undefined {
    const systemParts: string[] = []

    for (const message of messages) {
        if (message.role !== MESSAGE_ROLE.SYSTEM) {
            continue
        }

        const normalized = normalizeMessageContent(message.content)
        if (normalized.length > 0) {
            systemParts.push(normalized)
        }
    }

    if (systemParts.length === 0) {
        return undefined
    }

    return systemParts.join("\n")
}

/**
 * Converts shared tools to Google function declaration payload.
 *
 * @param tools Shared tools list.
 * @returns Google tools payload or undefined.
 */
function toGoogleTools(tools: readonly IToolDefinitionDTO[] | undefined): readonly IGoogleTool[] | undefined {
    if (tools === undefined || tools.length === 0) {
        return undefined
    }

    return [
        {
            functionDeclarations: tools.map((tool) => {
                return {
                    name: normalizeRequiredText(tool.name, "tools.name"),
                    description: normalizeOptionalText(tool.description),
                    parametersJsonSchema: tool.parameters,
                }
            }),
        },
    ]
}

/**
 * Response format config payload for Google request.
 */
interface IGoogleResponseFormatConfig {
    readonly responseMimeType?: string
    readonly responseJsonSchema?: Readonly<Record<string, unknown>>
}

/**
 * Builds response format config from shared response format DTO.
 *
 * @param responseFormat Shared response format DTO.
 * @returns Google response format config or undefined.
 */
function buildResponseFormatConfig(
    responseFormat: IChatResponseFormatDTO | undefined,
): IGoogleResponseFormatConfig | undefined {
    if (responseFormat === undefined) {
        return undefined
    }

    if (responseFormat.type === CHAT_RESPONSE_FORMAT.TEXT) {
        return {
            responseMimeType: "text/plain",
        }
    }

    if (responseFormat.type === CHAT_RESPONSE_FORMAT.JSON_OBJECT) {
        return {
            responseMimeType: "application/json",
        }
    }

    return {
        responseMimeType: "application/json",
        responseJsonSchema: responseFormat.schema,
    }
}

/**
 * Normalizes Google chat response into shared DTO.
 *
 * @param response Raw Google response.
 * @returns Shared chat response.
 */
function normalizeGoogleChatResponse(response: IGoogleGenerateContentResponse): IChatResponseDTO {
    const content = resolveResponseText(response)
    const toolCalls = resolveResponseToolCalls(response)
    const usage = normalizeUsageMetadata(response.usageMetadata) ?? {
        input: 0,
        output: 0,
        total: 0,
    }
    const finishReason = normalizeFinishReason(readResponseFinishReason(response))

    if (toolCalls.length === 0) {
        return {
            content,
            usage,
            finishReason,
        }
    }

    return {
        content,
        toolCalls,
        usage,
        finishReason,
    }
}

/**
 * Resolves text content from Google response.
 *
 * @param response Raw Google response.
 * @returns Response text.
 */
function resolveResponseText(response: IGoogleGenerateContentResponse): string {
    const text = readRawString(response.text)
    if (text !== undefined) {
        return text
    }

    const firstCandidate = response.candidates?.[0]
    const parts = firstCandidate?.content?.parts
    if (parts === undefined) {
        return ""
    }

    const textParts: string[] = []
    for (const part of parts) {
        const partText = readRawString(part.text)
        if (partText !== undefined) {
            textParts.push(partText)
        }
    }

    return textParts.join("")
}

/**
 * Resolves function calls from Google response.
 *
 * @param response Raw Google response.
 * @returns Shared tool call DTO list.
 */
function resolveResponseToolCalls(response: IGoogleGenerateContentResponse): readonly IToolCallDTO[] {
    const directCalls = response.functionCalls
    if (directCalls !== undefined && directCalls.length > 0) {
        return directCalls.map((call, index) => {
            return normalizeFunctionCall(call, index)
        })
    }

    const firstCandidate = response.candidates?.[0]
    const parts = firstCandidate?.content?.parts
    if (parts === undefined || parts.length === 0) {
        return []
    }

    const calls: IToolCallDTO[] = []
    for (const part of parts) {
        if (part.functionCall === undefined) {
            continue
        }

        calls.push(normalizeFunctionCall(part.functionCall, calls.length))
    }

    return calls
}

/**
 * Normalizes one Google function call to shared tool call DTO.
 *
 * @param call Raw Google function call.
 * @param index Fallback index for id generation.
 * @returns Shared tool call DTO.
 */
function normalizeFunctionCall(call: IGoogleFunctionCall, index: number): IToolCallDTO {
    return {
        id: normalizeOptionalText(call.id) ?? `call-${String(index + 1)}`,
        name: normalizeOptionalText(call.name) ?? "",
        arguments: JSON.stringify(call.args ?? {}),
    }
}

/**
 * Reads finish reason from the first candidate.
 *
 * @param response Raw Google response.
 * @returns Raw finish reason string.
 */
function readResponseFinishReason(response: IGoogleGenerateContentResponse): string | undefined {
    return normalizeOptionalText(response.candidates?.[0]?.finishReason)
}

/**
 * Normalizes Google finish reason into shared finish reason semantics.
 *
 * @param finishReason Raw Google finish reason.
 * @returns Shared finish reason.
 */
function normalizeFinishReason(finishReason: string | undefined): string | undefined {
    if (finishReason === undefined) {
        return undefined
    }

    const mappedReason = DIRECT_FINISH_REASON_MAP[finishReason]
    if (mappedReason !== undefined) {
        return mappedReason
    }

    if (CONTENT_FILTER_FINISH_REASONS.has(finishReason)) {
        return CHAT_FINISH_REASON.CONTENT_FILTER
    }

    return finishReason.toLowerCase()
}

/**
 * Normalizes Google usage metadata to shared usage DTO.
 *
 * @param usageMetadata Raw Google usage metadata.
 * @returns Shared usage DTO or undefined.
 */
function normalizeUsageMetadata(usageMetadata: IGoogleUsageMetadata | undefined): ITokenUsageDTO | undefined {
    if (usageMetadata === undefined) {
        return undefined
    }

    const input = normalizeUsageNumber(usageMetadata.promptTokenCount)
    const output = normalizeUsageNumber(usageMetadata.candidatesTokenCount)
    const total = normalizeOptionalUsageNumber(usageMetadata.totalTokenCount) ?? input + output

    return {
        input,
        output,
        total,
    }
}

/**
 * Creates normalized streaming iterable wrapper around Google stream.
 *
 * @param streamPromise Promise resolving to Google stream.
 * @returns Streaming chat response iterable.
 */
function createGoogleStreamingIterable(
    streamPromise: Promise<AsyncIterable<IGoogleGenerateContentResponse>>,
): IStreamingChatResponseDTO {
    return {
        async *[Symbol.asyncIterator](): AsyncIterator<IChatChunkDTO> {
            const stream = await streamPromise

            for await (const chunk of stream) {
                const normalizedChunk = normalizeStreamingChunk(chunk)
                if (normalizedChunk !== undefined) {
                    yield normalizedChunk
                }
            }
        },
    }
}

/**
 * Normalizes one Google stream chunk.
 *
 * @param chunk Raw Google stream chunk.
 * @returns Shared stream chunk or undefined.
 */
function normalizeStreamingChunk(chunk: IGoogleGenerateContentResponse): IChatChunkDTO | undefined {
    const delta = resolveResponseText(chunk)
    const finishReason = normalizeFinishReason(readResponseFinishReason(chunk))
    const usage = normalizeUsageMetadata(chunk.usageMetadata)

    if (delta.length === 0 && finishReason === undefined && usage === undefined) {
        return undefined
    }

    return {
        delta,
        finishReason,
        usage,
    }
}

/**
 * Normalizes embeddings response payload.
 *
 * @param response Raw embeddings response.
 * @param expectedCount Expected number of vectors.
 * @returns Immutable list of vectors.
 */
function normalizeEmbeddingResponse(
    response: IGoogleEmbedContentResponse,
    expectedCount: number,
): readonly number[][] {
    const embeddings = response.embeddings ?? []

    if (embeddings.length !== expectedCount) {
        throw new Error(
            `Google embeddings response count mismatch: expected ${String(expectedCount)}, received ${String(embeddings.length)}`,
        )
    }

    return embeddings.map((embedding, index) => {
        return normalizeEmbeddingVector(embedding.values, index)
    })
}

/**
 * Normalizes one embedding vector payload.
 *
 * @param values Raw vector values.
 * @param index Vector index for error reporting.
 * @returns Immutable normalized vector.
 */
function normalizeEmbeddingVector(values: readonly number[] | undefined, index: number): number[] {
    if (values === undefined || values.length === 0) {
        throw new Error(`embeddings[${String(index)}] cannot be empty`)
    }

    const vector: number[] = []
    for (const value of values) {
        if (Number.isFinite(value) === false) {
            throw new Error(`embeddings[${String(index)}] contains invalid number`)
        }

        vector.push(value)
    }

    return vector
}

/**
 * Normalizes embedding text input list.
 *
 * @param texts Raw text list.
 * @returns Trimmed, validated text list.
 */
function normalizeEmbeddingTexts(texts: readonly string[]): readonly string[] {
    return texts.map((text, index) => {
        return normalizeRequiredText(text, `texts[${index}]`)
    })
}

/**
 * Normalizes Google SDK or transport error to provider metadata.
 *
 * @param error Unknown error value.
 * @returns Normalized provider error payload.
 */
function normalizeGoogleProviderError(
    error: unknown,
): IGoogleProviderErrorDetails & {readonly message: string} {
    if (error instanceof ApiError) {
        const statusCode = normalizeStatusCode(error.status)

        return {
            message: error.message,
            statusCode,
            code: statusCode !== undefined ? `HTTP_${String(statusCode)}` : undefined,
            type: "api_error",
            isRetryable: isRetryableStatus(statusCode),
        }
    }

    if (error instanceof Error) {
        const statusCode = readErrorStatus(error)
        const retryAfterMs = readRetryAfterMs(readErrorHeaders(error))

        return {
            message: error.message,
            statusCode,
            code: readRecordText(error, "code"),
            type: normalizeOptionalText(error.name),
            retryAfterMs,
            isRetryable: isRetryableStatus(statusCode) || isTimeoutError(error),
        }
    }

    return {
        message: "Google request failed",
        isRetryable: false,
    }
}

/**
 * Resolves retryable status class.
 *
 * @param statusCode HTTP status code.
 * @returns True when request should be retried.
 */
function isRetryableStatus(statusCode: number | undefined): boolean {
    if (statusCode === undefined) {
        return false
    }

    return statusCode === 429 || statusCode >= 500
}

/**
 * Detects timeout-style errors.
 *
 * @param error Error instance.
 * @returns True when error indicates timeout semantics.
 */
function isTimeoutError(error: Error): boolean {
    const name = error.name.toLowerCase()
    const message = error.message.toLowerCase()

    return (
        name.includes("timeout") ||
        message.includes("timeout") ||
        message.includes("timed out")
    )
}

/**
 * Reads status code from error object.
 *
 * @param error Error object.
 * @returns Status code or undefined.
 */
function readErrorStatus(error: Error): number | undefined {
    const status = readRecordNumber(error, "status")
    if (status !== undefined) {
        return normalizeStatusCode(status)
    }

    return normalizeStatusCode(readRecordNumber(error, "statusCode"))
}

/**
 * Reads headers from error object.
 *
 * @param error Error object.
 * @returns Headers collection or undefined.
 */
function readErrorHeaders(error: Error): Headers | undefined {
    const record = toRecord(error)
    const headers = record?.["headers"]

    if (headers instanceof Headers) {
        return headers
    }

    return undefined
}

/**
 * Reads retry-after header from provider headers.
 *
 * @param headers Raw header collection.
 * @returns Retry delay in milliseconds.
 */
function readRetryAfterMs(headers: Headers | undefined): number | undefined {
    const retryAfter = headers?.get("retry-after")
    if (retryAfter === null || retryAfter === undefined) {
        return undefined
    }

    const seconds = Number(retryAfter)
    if (Number.isFinite(seconds) === false || seconds < 0) {
        return undefined
    }

    return Math.round(seconds * 1000)
}

/**
 * Resolves retry delay using header hint or exponential fallback.
 *
 * @param retryAfterMs Retry-after hint.
 * @param attempt Current attempt number.
 * @returns Delay in milliseconds.
 */
function resolveRetryDelayMs(retryAfterMs: number | undefined, attempt: number): number {
    if (retryAfterMs !== undefined) {
        return retryAfterMs
    }

    return DEFAULT_RETRY_BASE_DELAY_MS * (2 ** (attempt - 1))
}

/**
 * Resolves final model name with default fallback.
 *
 * @param model Raw model name.
 * @returns Normalized model name.
 */
function resolveModel(model: string): string {
    return normalizeOptionalText(model) ?? DEFAULT_CHAT_MODEL
}

/**
 * Normalizes optional temperature value.
 *
 * @param temperature Raw temperature.
 * @returns Bounded temperature or undefined.
 */
function resolveTemperature(temperature: number | undefined): number | undefined {
    if (temperature === undefined || Number.isFinite(temperature) === false) {
        return undefined
    }

    if (temperature < 0) {
        return 0
    }

    if (temperature > 2) {
        return 2
    }

    return temperature
}

/**
 * Normalizes optional max token value for Google payload.
 *
 * @param maxTokens Raw max token value.
 * @returns Positive max token count or undefined.
 */
function resolveMaxOutputTokens(maxTokens: number | undefined): number | undefined {
    if (maxTokens === undefined || Number.isFinite(maxTokens) === false) {
        return undefined
    }

    if (maxTokens <= 0) {
        return undefined
    }

    return Math.trunc(maxTokens)
}

/**
 * Normalizes message content.
 *
 * @param content Raw content.
 * @returns Trimmed content.
 */
function normalizeMessageContent(content: string): string {
    return content.trim()
}

/**
 * Normalizes status code value.
 *
 * @param statusCode Raw status code.
 * @returns Normalized status code or undefined.
 */
function normalizeStatusCode(statusCode: number | undefined): number | undefined {
    if (statusCode === undefined || Number.isFinite(statusCode) === false || statusCode <= 0) {
        return undefined
    }

    return Math.trunc(statusCode)
}

/**
 * Reads numeric field from plain record.
 *
 * @param value Source value.
 * @param key Field key.
 * @returns Number or undefined.
 */
function readRecordNumber(value: unknown, key: string): number | undefined {
    const record = toRecord(value)
    const fieldValue = record?.[key]
    if (typeof fieldValue !== "number" || Number.isFinite(fieldValue) === false) {
        return undefined
    }

    return fieldValue
}

/**
 * Reads optional string field from plain record.
 *
 * @param value Source value.
 * @param key Field key.
 * @returns Normalized text or undefined.
 */
function readRecordText(value: unknown, key: string): string | undefined {
    const record = toRecord(value)
    return normalizeOptionalText(typeof record?.[key] === "string" ? record?.[key] : undefined)
}

/**
 * Reads optional raw string without trimming.
 *
 * @param value Raw value.
 * @returns Raw string or undefined.
 */
function readRawString(value: unknown): string | undefined {
    if (typeof value !== "string") {
        return undefined
    }

    return value
}

/**
 * Converts unknown to plain record.
 *
 * @param value Unknown value.
 * @returns Plain record or null.
 */
function toRecord(value: unknown): Readonly<Record<string, unknown>> | null {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return null
    }

    return value as Readonly<Record<string, unknown>>
}

/**
 * Normalizes numeric usage values.
 *
 * @param value Raw token count.
 * @returns Safe integer value.
 */
function normalizeUsageNumber(value: number | undefined): number {
    if (value === undefined || Number.isFinite(value) === false || value < 0) {
        return 0
    }

    return Math.trunc(value)
}

/**
 * Normalizes optional usage number.
 *
 * @param value Raw token count.
 * @returns Safe integer value or undefined.
 */
function normalizeOptionalUsageNumber(value: number | undefined): number | undefined {
    if (value === undefined || Number.isFinite(value) === false || value < 0) {
        return undefined
    }

    return Math.trunc(value)
}

/**
 * Normalizes optional text value.
 *
 * @param value Raw string value.
 * @returns Trimmed string or undefined.
 */
function normalizeOptionalText(value: string | null | undefined): string | undefined {
    if (typeof value !== "string") {
        return undefined
    }

    const normalized = value.trim()
    if (normalized.length === 0) {
        return undefined
    }

    return normalized
}

/**
 * Normalizes required text input.
 *
 * @param value Raw string value.
 * @param fieldName Field label for error message.
 * @returns Trimmed non-empty string.
 */
function normalizeRequiredText(value: string | null | undefined, fieldName: string): string {
    const normalized = normalizeOptionalText(value)
    if (normalized === undefined) {
        throw new Error(`${fieldName} cannot be empty`)
    }

    return normalized
}

/**
 * Normalizes retry attempt count.
 *
 * @param retryMaxAttempts Raw retry count.
 * @returns Positive integer retry count.
 */
function normalizeRetryMaxAttempts(retryMaxAttempts: number | undefined): number {
    if (retryMaxAttempts === undefined) {
        return DEFAULT_RETRY_MAX_ATTEMPTS
    }

    if (Number.isFinite(retryMaxAttempts) === false || retryMaxAttempts <= 0) {
        throw new Error("retryMaxAttempts must be positive integer")
    }

    return Math.trunc(retryMaxAttempts)
}

/**
 * Default sleep implementation for retry backoff.
 *
 * @param delayMs Delay in milliseconds.
 * @returns Promise resolved after timeout.
 */
function defaultSleep(delayMs: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, delayMs)
    })
}
