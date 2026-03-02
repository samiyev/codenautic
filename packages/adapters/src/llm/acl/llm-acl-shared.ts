import {Result} from "@codenautic/core"

import {type ILlmCompletionRequestDto, LLM_MODEL_PRICING, type LlmProvider} from "../contracts/completion.contract"
import {LLM_ACL_ERROR_CODE, LlmAclError} from "../errors/llm-acl.error"

type UnknownRecord = Record<string, unknown>

/**
 * Normalized request fields shared by provider-specific adapters.
 */
export interface INormalizedLlmRequestFields {
    readonly model: string
    readonly prompt: string
    readonly systemPrompt?: string
    readonly maxOutputTokens: number
    readonly temperature: number
    readonly correlationId: string
}

/**
 * Normalized usage fields shared by provider-specific adapters.
 */
export interface INormalizedLlmUsageFields {
    readonly inputTokens: number
    readonly outputTokens: number
    readonly totalTokens: number
}

/**
 * Validates and normalizes shared request DTO fields.
 *
 * @param request Stable domain request DTO.
 * @param expectedProvider Provider that the ACL handles.
 * @returns Normalized fields or invalid request error.
 */
export function normalizeCompletionRequest(
    request: ILlmCompletionRequestDto,
    expectedProvider: LlmProvider,
): Result<INormalizedLlmRequestFields, LlmAclError> {
    if (request.provider !== expectedProvider) {
        return Result.fail(
            createInvalidRequestError(`Provider mismatch for ${expectedProvider} ACL`),
        )
    }

    const model = normalizeNonEmptyString(request.model)
    const prompt = normalizeNonEmptyString(request.prompt)
    const correlationId = normalizeNonEmptyString(request.correlationId)
    if (model === undefined || prompt === undefined || correlationId === undefined) {
        return Result.fail(createInvalidRequestError("Request model, prompt and correlationId are required"))
    }

    if (Number.isInteger(request.maxOutputTokens) === false || request.maxOutputTokens <= 0) {
        return Result.fail(createInvalidRequestError("maxOutputTokens must be a positive integer"))
    }

    if (Number.isFinite(request.temperature) === false) {
        return Result.fail(createInvalidRequestError("temperature must be a finite number"))
    }
    if (request.temperature < 0 || request.temperature > 2) {
        return Result.fail(createInvalidRequestError("temperature must be in range [0, 2]"))
    }

    const systemPrompt = normalizeNonEmptyString(request.systemPrompt)
    return Result.ok({
        model,
        prompt,
        systemPrompt,
        maxOutputTokens: request.maxOutputTokens,
        temperature: request.temperature,
        correlationId,
    })
}

/**
 * Converts unknown value to record.
 *
 * @param value Unknown value.
 * @returns Record when value is object.
 */
export function toRecord(value: unknown): UnknownRecord | undefined {
    if (typeof value !== "object" || value === null) {
        return undefined
    }

    return value as UnknownRecord
}

/**
 * Reads required non-empty string from record.
 *
 * @param value Source object.
 * @param key Property key.
 * @returns Trimmed non-empty string.
 */
export function readRequiredString(value: UnknownRecord, key: string): string | undefined {
    const candidate = normalizeNonEmptyString(value[key])
    return candidate
}

/**
 * Reads optional string from record.
 *
 * @param value Source object.
 * @param key Property key.
 * @returns Trimmed string when present.
 */
export function readOptionalString(value: UnknownRecord, key: string): string | undefined {
    const candidate = value[key]
    if (typeof candidate !== "string") {
        return undefined
    }

    return candidate.trim()
}

/**
 * Reads nested record from record.
 *
 * @param value Source object.
 * @param key Property key.
 * @returns Nested record when valid.
 */
export function readRecord(value: UnknownRecord, key: string): UnknownRecord | undefined {
    return toRecord(value[key])
}

/**
 * Reads non-negative integer from record.
 *
 * @param value Source object.
 * @param key Property key.
 * @returns Integer when valid.
 */
export function readNonNegativeInteger(value: UnknownRecord, key: string): number | undefined {
    const candidate = value[key]
    if (typeof candidate !== "number" || Number.isInteger(candidate) === false) {
        return undefined
    }
    if (candidate < 0) {
        return undefined
    }

    return candidate
}

/**
 * Calculates deterministic estimated cost from model pricing and usage.
 *
 * @param model Model label.
 * @param inputTokens Prompt token count.
 * @param outputTokens Completion token count.
 * @returns Estimated cost in USD with 6-digit precision.
 */
export function calculateEstimatedCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = LLM_MODEL_PRICING[model]
    if (pricing === undefined) {
        return 0
    }

    const inputCost = (inputTokens / 1000) * pricing.inputPer1kUsd
    const outputCost = (outputTokens / 1000) * pricing.outputPer1kUsd
    return Number((inputCost + outputCost).toFixed(6))
}

/**
 * Creates normalized invalid request error.
 *
 * @param message Error message.
 * @returns Invalid request error.
 */
export function createInvalidRequestError(message: string): LlmAclError {
    return new LlmAclError({
        code: LLM_ACL_ERROR_CODE.INVALID_REQUEST,
        message,
        statusCode: 400,
        retryable: false,
        fallbackRecommended: false,
    })
}

/**
 * Creates normalized invalid response error.
 *
 * @param message Error message.
 * @returns Invalid response error.
 */
export function createInvalidResponseError(message: string): LlmAclError {
    return new LlmAclError({
        code: LLM_ACL_ERROR_CODE.INVALID_RESPONSE,
        message,
        statusCode: 502,
        retryable: false,
        fallbackRecommended: false,
    })
}

/**
 * Normalizes unknown value into non-empty string.
 *
 * @param value Unknown value.
 * @returns Trimmed non-empty string.
 */
function normalizeNonEmptyString(value: unknown): string | undefined {
    if (typeof value !== "string") {
        return undefined
    }

    const normalized = value.trim()
    if (normalized.length === 0) {
        return undefined
    }

    return normalized
}
