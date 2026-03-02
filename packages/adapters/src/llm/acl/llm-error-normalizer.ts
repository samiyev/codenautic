import {LLM_ACL_ERROR_CODE, LlmAclError} from "../errors/llm-acl.error"

import {readRecord, toRecord} from "./llm-acl-shared"

type UnknownRecord = Record<string, unknown>

/**
 * Normalizes provider-specific errors into stable LLM ACL errors.
 *
 * @param error Unknown provider error.
 * @returns Normalized LLM ACL error.
 */
export function normalizeLlmProviderError(error: unknown): LlmAclError {
    if (error instanceof LlmAclError) {
        return error
    }

    const statusCode = extractStatusCode(error)
    const message = extractErrorMessage(error)
    const retryAfterSeconds = extractRetryAfterSeconds(error)

    if (statusCode === 429) {
        return new LlmAclError({
            code: LLM_ACL_ERROR_CODE.RATE_LIMITED,
            message,
            statusCode,
            retryable: true,
            fallbackRecommended: true,
            retryAfterSeconds,
            cause: toError(error),
        })
    }

    if (statusCode === 401 || statusCode === 403) {
        return new LlmAclError({
            code: LLM_ACL_ERROR_CODE.UNAUTHORIZED,
            message,
            statusCode,
            retryable: false,
            fallbackRecommended: false,
            cause: toError(error),
        })
    }

    if (statusCode !== undefined && statusCode >= 500) {
        return new LlmAclError({
            code: LLM_ACL_ERROR_CODE.PROVIDER_UNAVAILABLE,
            message,
            statusCode,
            retryable: true,
            fallbackRecommended: true,
            cause: toError(error),
        })
    }

    return new LlmAclError({
        code: LLM_ACL_ERROR_CODE.UNKNOWN,
        message,
        statusCode,
        retryable: false,
        fallbackRecommended: false,
        cause: toError(error),
    })
}

/**
 * Extracts status code from unknown provider error payload.
 *
 * @param error Unknown provider error.
 * @returns Numeric status code when present.
 */
function extractStatusCode(error: unknown): number | undefined {
    const record = toRecord(error)
    if (record === undefined) {
        return undefined
    }

    const directStatusCode = readStatusCodeCandidate(record, "statusCode")
    if (directStatusCode !== undefined) {
        return directStatusCode
    }

    const directStatus = readStatusCodeCandidate(record, "status")
    if (directStatus !== undefined) {
        return directStatus
    }

    const responsePayload = readRecord(record, "response")
    if (responsePayload !== undefined) {
        const responseStatusCode = readStatusCodeCandidate(responsePayload, "statusCode")
        if (responseStatusCode !== undefined) {
            return responseStatusCode
        }

        const responseStatus = readStatusCodeCandidate(responsePayload, "status")
        if (responseStatus !== undefined) { return responseStatus }
    }

    const causePayload = readRecord(record, "cause")
    if (causePayload !== undefined) {
        return extractStatusCode(causePayload)
    }

    return undefined
}

/**
 * Extracts retry-after hint from provider error payload.
 *
 * @param error Unknown provider error.
 * @returns Retry delay in seconds when present.
 */
function extractRetryAfterSeconds(error: unknown): number | undefined {
    const record = toRecord(error)
    if (record === undefined) {
        return undefined
    }

    const directValue = readStatusCodeCandidate(record, "retryAfterSeconds")
    if (directValue !== undefined) {
        return directValue
    }

    const causePayload = readRecord(record, "cause")
    if (causePayload !== undefined) {
        const nested = extractRetryAfterSeconds(causePayload)
        if (nested !== undefined) { return nested }
    }

    const response = readRecord(record, "response")
    if (response === undefined) {
        return undefined
    }

    const headers = readRecord(response, "headers")
    if (headers === undefined) {
        return undefined
    }

    const lowerCaseRetryAfter = readStatusCodeCandidate(headers, "retry-after")
    if (lowerCaseRetryAfter !== undefined) {
        return lowerCaseRetryAfter
    }

    return readStatusCodeCandidate(headers, "Retry-After")
}

/**
 * Extracts human-readable message from unknown provider error.
 *
 * @param error Unknown provider error.
 * @returns Message value or default message.
 */
function extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message
    }

    const record = toRecord(error)
    if (record === undefined) {
        return "Unknown LLM provider error"
    }

    const message = readStringCandidate(record, "message")
    return message ?? "Unknown LLM provider error"
}

/**
 * Reads numeric status code candidate.
 *
 * @param value Source record.
 * @param key Key to read.
 * @returns Parsed status code.
 */
function readStatusCodeCandidate(value: UnknownRecord, key: string): number | undefined {
    const candidate = value[key]
    if (typeof candidate === "number" && Number.isInteger(candidate)) {
        return candidate
    }

    if (typeof candidate === "string" && candidate.length > 0) {
        const parsed = Number.parseInt(candidate, 10)
        if (Number.isInteger(parsed)) {
            return parsed
        }
    }

    return undefined
}

/**
 * Reads string candidate from record key.
 *
 * @param value Source record.
 * @param key Key to read.
 * @returns Trimmed string when valid.
 */
function readStringCandidate(value: UnknownRecord, key: string): string | undefined {
    const candidate = value[key]
    if (typeof candidate !== "string") {
        return undefined
    }

    const normalized = candidate.trim()
    if (normalized.length === 0) {
        return undefined
    }

    return normalized
}

/**
 * Converts unknown value to Error instance.
 *
 * @param error Unknown value.
 * @returns Error instance when possible.
 */
function toError(error: unknown): Error | undefined {
    if (error instanceof Error) {
        return error
    }

    return undefined
}
