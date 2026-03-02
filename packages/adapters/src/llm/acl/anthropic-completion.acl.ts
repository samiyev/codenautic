import {Result} from "@codenautic/core"

import {
    LLM_FINISH_REASON,
    LLM_PROVIDER,
    type IAnthropicCompletionRequest,
    type ILlmCompletionRequestDto,
    type ILlmCompletionResponseDto,
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
 * Anthropic completion ACL with stable request/response contracts.
 */
export class AnthropicCompletionAcl implements ICompletionAcl<IAnthropicCompletionRequest> {
    /**
     * Creates Anthropic completion ACL instance.
     */
    public constructor() {}

    /**
     * Maps stable domain request DTO into Anthropic request payload.
     *
     * @param request Stable domain request DTO.
     * @returns Anthropic request payload or normalized error.
     */
    public transformRequest(
        request: ILlmCompletionRequestDto,
    ): Result<IAnthropicCompletionRequest, LlmAclError> {
        const normalized = normalizeCompletionRequest(request, LLM_PROVIDER.ANTHROPIC)
        if (normalized.isFail) {
            return Result.fail(normalized.error)
        }

        return Result.ok({
            model: normalized.value.model,
            system: normalized.value.systemPrompt,
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: normalized.value.prompt,
                        },
                    ],
                },
            ],
            max_tokens: normalized.value.maxOutputTokens,
            temperature: normalized.value.temperature,
            metadata: {
                correlation_id: normalized.value.correlationId,
            },
        })
    }

    /**
     * Maps Anthropic response payload into stable domain DTO.
     *
     * @param response Anthropic response payload.
     * @returns Stable response DTO or normalized error.
     */
    public transformResponse(response: unknown): Result<ILlmCompletionResponseDto, LlmAclError> {
        return parseAnthropicResponse(response)
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
 * Parses Anthropic response payload into stable response DTO.
 *
 * @param response Anthropic response payload.
 * @returns Stable response DTO or normalized error.
 */
function parseAnthropicResponse(response: unknown): Result<ILlmCompletionResponseDto, LlmAclError> {
    const record = toRecord(response)
    if (record === undefined) {
        return Result.fail(createInvalidResponseError("Anthropic response payload must be an object"))
    }

    const responseId = readRequiredString(record, "id")
    const model = readRequiredString(record, "model")
    if (responseId === undefined || model === undefined) {
        return Result.fail(createInvalidResponseError("Anthropic response id and model are required"))
    }

    const content = readAnthropicText(record)
    if (content === undefined) {
        return Result.fail(createInvalidResponseError("Anthropic response must contain text block"))
    }

    const usage = readAnthropicUsage(record)
    if (usage.isFail) {
        return Result.fail(usage.error)
    }

    return Result.ok({
        provider: LLM_PROVIDER.ANTHROPIC,
        model,
        responseId,
        content,
        finishReason: mapAnthropicFinishReason(readOptionalString(record, "stop_reason")),
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
 * Extracts first text block from Anthropic content array.
 *
 * @param value Anthropic response object.
 * @returns Text content when present.
 */
function readAnthropicText(value: UnknownRecord): string | undefined {
    const contentBlocks = value["content"]
    if (Array.isArray(contentBlocks) === false || contentBlocks.length === 0) {
        return undefined
    }

    for (const block of contentBlocks) {
        const blockRecord = toRecord(block)
        if (blockRecord === undefined) {
            continue
        }

        if (readRequiredString(blockRecord, "type") !== "text") {
            continue
        }

        const text = readRequiredString(blockRecord, "text")
        if (text !== undefined) {
            return text
        }
    }

    return undefined
}

/**
 * Reads and validates Anthropic usage fields.
 *
 * @param value Anthropic response object.
 * @returns Normalized usage fields.
 */
function readAnthropicUsage(value: UnknownRecord): Result<INormalizedLlmUsageFields, LlmAclError> {
    const usage = readRecord(value, "usage")
    if (usage === undefined) {
        return Result.fail(createInvalidResponseError("Anthropic usage object is required"))
    }

    const inputTokens = readNonNegativeInteger(usage, "input_tokens")
    const outputTokens = readNonNegativeInteger(usage, "output_tokens")
    if (inputTokens === undefined || outputTokens === undefined) {
        return Result.fail(
            createInvalidResponseError("Anthropic usage input_tokens and output_tokens are required"),
        )
    }

    return Result.ok({
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
    })
}

/**
 * Maps Anthropic stop reason into normalized finish reason.
 *
 * @param stopReason Anthropic stop reason value.
 * @returns Normalized finish reason.
 */
function mapAnthropicFinishReason(stopReason: string | undefined): ILlmCompletionResponseDto["finishReason"] {
    if (stopReason === "end_turn" || stopReason === "stop_sequence") {
        return LLM_FINISH_REASON.STOP
    }
    if (stopReason === "max_tokens") {
        return LLM_FINISH_REASON.LENGTH
    }

    return LLM_FINISH_REASON.UNKNOWN
}
