import {Result} from "@codenautic/core"

import {
    LLM_FINISH_REASON,
    LLM_PROVIDER,
    type ILlmCompletionRequestDto,
    type ILlmCompletionResponseDto,
    type IOpenAiCompletionRequest,
} from "../contracts/completion.contract"
import {type LlmAclError} from "../errors/llm-acl.error"

import {type ICompletionAcl} from "./completion-acl.interface"
import {
    calculateEstimatedCost,
    createInvalidResponseError,
    normalizeCompletionRequest,
    readNonNegativeInteger,
    readOptionalString,
    readRecord,
    readRequiredString,
    toRecord,
    type INormalizedLlmUsageFields,
} from "./llm-acl-shared"
import {normalizeLlmProviderError} from "./llm-error-normalizer"

type UnknownRecord = Record<string, unknown>

/**
 * OpenAI completion ACL with stable request/response contracts.
 */
export class OpenAiCompletionAcl implements ICompletionAcl<IOpenAiCompletionRequest> {
    /**
     * Creates OpenAI completion ACL instance.
     */
    public constructor() {}

    /**
     * Maps stable domain request DTO into OpenAI request payload.
     *
     * @param request Stable domain request DTO.
     * @returns OpenAI request payload or normalized error.
     */
    public transformRequest(
        request: ILlmCompletionRequestDto,
    ): Result<IOpenAiCompletionRequest, LlmAclError> {
        const normalized = normalizeCompletionRequest(request, LLM_PROVIDER.OPENAI)
        if (normalized.isFail) {
            return Result.fail(normalized.error)
        }

        return Result.ok({
            model: normalized.value.model,
            messages: buildMessages(normalized.value.prompt, normalized.value.systemPrompt),
            max_tokens: normalized.value.maxOutputTokens,
            temperature: normalized.value.temperature,
            metadata: {
                correlation_id: normalized.value.correlationId,
            },
        })
    }

    /**
     * Maps OpenAI response payload into stable domain DTO.
     *
     * @param response OpenAI response payload.
     * @returns Stable response DTO or normalized error.
     */
    public transformResponse(response: unknown): Result<ILlmCompletionResponseDto, LlmAclError> {
        return parseOpenAiResponse(response)
    }

    /**
     * Normalizes provider errors into stable ACL errors.
     *
     * @param error Unknown provider error.
     * @returns Normalized ACL error.
     */
    public normalizeError(error: unknown): LlmAclError {
        return normalizeLlmProviderError(error)
    }

    /**
     * Returns retry decision for normalized ACL error.
     *
     * @param error Normalized ACL error.
     * @returns True when request is retryable.
     */
    public shouldRetry(error: LlmAclError): boolean {
        return error.retryable
    }
}

/**
 * Builds OpenAI message list from normalized prompt fields.
 *
 * @param prompt User prompt.
 * @param systemPrompt Optional system prompt.
 * @returns OpenAI message sequence.
 */
function buildMessages(
    prompt: string,
    systemPrompt?: string,
): IOpenAiCompletionRequest["messages"] {
    const messages: IOpenAiCompletionRequest["messages"][number][] = []
    if (systemPrompt !== undefined) {
        messages.push({
            role: "system",
            content: systemPrompt,
        })
    }

    messages.push({
        role: "user",
        content: prompt,
    })

    return messages
}

/**
 * Parses OpenAI response payload into stable response DTO.
 *
 * @param response OpenAI response payload.
 * @returns Stable response DTO or normalized error.
 */
function parseOpenAiResponse(response: unknown): Result<ILlmCompletionResponseDto, LlmAclError> {
    const record = toRecord(response)
    if (record === undefined) {
        return Result.fail(createInvalidResponseError("OpenAI response payload must be an object"))
    }

    const responseId = readRequiredString(record, "id")
    const model = readRequiredString(record, "model")
    if (responseId === undefined || model === undefined) {
        return Result.fail(createInvalidResponseError("OpenAI response id and model are required"))
    }

    const choice = readFirstChoice(record)
    if (choice === undefined) {
        return Result.fail(createInvalidResponseError("OpenAI response must include at least one choice"))
    }

    const content = readChoiceContent(choice)
    if (content === undefined) {
        return Result.fail(createInvalidResponseError("OpenAI response choice does not contain text content"))
    }

    const usage = readOpenAiUsage(record)
    if (usage.isFail) {
        return Result.fail(usage.error)
    }

    return Result.ok({
        provider: LLM_PROVIDER.OPENAI,
        model,
        responseId,
        content,
        finishReason: mapOpenAiFinishReason(readOptionalString(choice, "finish_reason")),
        usage: {
            inputTokens: usage.value.inputTokens,
            outputTokens: usage.value.outputTokens,
            totalTokens: usage.value.totalTokens,
            estimatedCostUsd: calculateEstimatedCost(
                model,
                usage.value.inputTokens,
                usage.value.outputTokens,
            ),
        },
    })
}

/**
 * Reads first choice payload from OpenAI response.
 *
 * @param value OpenAI response object.
 * @returns First choice object.
 */
function readFirstChoice(value: UnknownRecord): UnknownRecord | undefined {
    const choices = value["choices"]
    if (Array.isArray(choices) === false || choices.length === 0) {
        return undefined
    }

    return toRecord(choices[0])
}

/**
 * Reads text content from OpenAI choice object.
 *
 * @param value OpenAI choice object.
 * @returns Text content when present.
 */
function readChoiceContent(value: UnknownRecord): string | undefined {
    const message = readRecord(value, "message")
    if (message === undefined) {
        return undefined
    }

    return readRequiredString(message, "content")
}

/**
 * Reads and validates OpenAI usage fields.
 *
 * @param value OpenAI response object.
 * @returns Normalized usage fields.
 */
function readOpenAiUsage(value: UnknownRecord): Result<INormalizedLlmUsageFields, LlmAclError> {
    const usage = readRecord(value, "usage")
    if (usage === undefined) {
        return Result.fail(createInvalidResponseError("OpenAI usage object is required"))
    }

    const inputTokens = readNonNegativeInteger(usage, "prompt_tokens")
    const outputTokens = readNonNegativeInteger(usage, "completion_tokens")
    if (inputTokens === undefined || outputTokens === undefined) {
        return Result.fail(
            createInvalidResponseError("OpenAI usage prompt_tokens and completion_tokens are required"),
        )
    }

    const totalTokens = readNonNegativeInteger(usage, "total_tokens") ?? inputTokens + outputTokens
    return Result.ok({
        inputTokens,
        outputTokens,
        totalTokens,
    })
}

/**
 * Maps OpenAI finish reason into normalized finish reason.
 *
 * @param finishReason OpenAI finish reason value.
 * @returns Normalized finish reason.
 */
function mapOpenAiFinishReason(finishReason: string | undefined): ILlmCompletionResponseDto["finishReason"] {
    if (finishReason === "stop") {
        return LLM_FINISH_REASON.STOP
    }
    if (finishReason === "length") {
        return LLM_FINISH_REASON.LENGTH
    }
    if (finishReason === "content_filter") {
        return LLM_FINISH_REASON.CONTENT_FILTER
    }

    return LLM_FINISH_REASON.UNKNOWN
}
