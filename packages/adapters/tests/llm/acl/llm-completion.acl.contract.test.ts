import {describe, expect, test} from "bun:test"

import {
    AnthropicCompletionAcl,
    LLM_ACL_ERROR_CODE,
    LLM_PROVIDER,
    LlmAclError,
    LlmFallbackPolicy,
    OpenAiCompletionAcl,
    type ILlmCompletionRequestDto,
} from "../../../src/llm"

const OPENAI_REQUEST: ILlmCompletionRequestDto = {
    provider: LLM_PROVIDER.OPENAI,
    model: "gpt-4o-mini",
    prompt: "Summarize this merge request",
    systemPrompt: "You are a strict code reviewer",
    maxOutputTokens: 400,
    temperature: 0.2,
    correlationId: "corr-123",
}

const ANTHROPIC_REQUEST: ILlmCompletionRequestDto = {
    provider: LLM_PROVIDER.ANTHROPIC,
    model: "claude-3-5-haiku-latest",
    prompt: "Summarize this merge request",
    systemPrompt: "You are a strict code reviewer",
    maxOutputTokens: 512,
    temperature: 0.3,
    correlationId: "corr-987",
}

describe("LLM ACL contracts", () => {
    test("normalizes OpenAI request payload into provider shape", () => {
        const acl = new OpenAiCompletionAcl()

        const result = acl.transformRequest(OPENAI_REQUEST)

        expect(result.isOk).toBe(true)
        if (result.isFail) {
            throw new Error("Expected successful request mapping")
        }

        expect(result.value).toEqual({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "You are a strict code reviewer",
                },
                {
                    role: "user",
                    content: "Summarize this merge request",
                },
            ],
            max_tokens: 400,
            temperature: 0.2,
            metadata: {
                correlation_id: "corr-123",
            },
        })
    })

    test("omits system message when systemPrompt is empty for OpenAI request", () => {
        const acl = new OpenAiCompletionAcl()

        const result = acl.transformRequest({
            ...OPENAI_REQUEST,
            systemPrompt: "   ",
        })

        expect(result.isOk).toBe(true)
        if (result.isFail) {
            throw new Error("Expected successful request mapping")
        }

        expect(result.value.messages).toEqual([
            {
                role: "user",
                content: "Summarize this merge request",
            },
        ])
    })

    test("returns invalid request when OpenAI prompt is empty", () => {
        const acl = new OpenAiCompletionAcl()

        const result = acl.transformRequest({
            ...OPENAI_REQUEST,
            prompt: "  ",
        })

        expect(result.isFail).toBe(true)
        if (result.isOk) {
            throw new Error("Expected invalid request mapping failure")
        }

        expect(result.error.code).toBe(LLM_ACL_ERROR_CODE.INVALID_REQUEST)
    })

    test("returns invalid request when maxOutputTokens is not a positive integer", () => {
        const acl = new OpenAiCompletionAcl()

        const result = acl.transformRequest({
            ...OPENAI_REQUEST,
            maxOutputTokens: 0,
        })

        expect(result.isFail).toBe(true)
        if (result.isOk) {
            throw new Error("Expected invalid request mapping failure")
        }

        expect(result.error.code).toBe(LLM_ACL_ERROR_CODE.INVALID_REQUEST)
    })

    test("returns invalid request when temperature is not finite", () => {
        const acl = new OpenAiCompletionAcl()

        const result = acl.transformRequest({
            ...OPENAI_REQUEST,
            temperature: Number.NaN,
        })

        expect(result.isFail).toBe(true)
        if (result.isOk) {
            throw new Error("Expected invalid request mapping failure")
        }

        expect(result.error.code).toBe(LLM_ACL_ERROR_CODE.INVALID_REQUEST)
    })

    test("returns invalid request when temperature is out of range", () => {
        const acl = new OpenAiCompletionAcl()

        const result = acl.transformRequest({
            ...OPENAI_REQUEST,
            temperature: 2.5,
        })

        expect(result.isFail).toBe(true)
        if (result.isOk) {
            throw new Error("Expected invalid request mapping failure")
        }

        expect(result.error.code).toBe(LLM_ACL_ERROR_CODE.INVALID_REQUEST)
    })

    test("normalizes Anthropic request payload into provider shape", () => {
        const acl = new AnthropicCompletionAcl()

        const result = acl.transformRequest(ANTHROPIC_REQUEST)

        expect(result.isOk).toBe(true)
        if (result.isFail) {
            throw new Error("Expected successful request mapping")
        }

        expect(result.value).toEqual({
            model: "claude-3-5-haiku-latest",
            system: "You are a strict code reviewer",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: "Summarize this merge request",
                        },
                    ],
                },
            ],
            max_tokens: 512,
            temperature: 0.3,
            metadata: {
                correlation_id: "corr-987",
            },
        })
    })

    test("returns invalid request when provider and ACL mismatch for Anthropic", () => {
        const acl = new AnthropicCompletionAcl()

        const result = acl.transformRequest(OPENAI_REQUEST)

        expect(result.isFail).toBe(true)
        if (result.isOk) {
            throw new Error("Expected invalid request mapping failure")
        }

        expect(result.error.code).toBe(LLM_ACL_ERROR_CODE.INVALID_REQUEST)
    })

    test("normalizes OpenAI response into unified LLM DTO with usage and cost", () => {
        const acl = new OpenAiCompletionAcl()

        const result = acl.transformResponse({
            id: "chatcmpl-1",
            model: "gpt-4o-mini",
            choices: [
                {
                    finish_reason: "stop",
                    message: {
                        content: "Looks safe after normalization.",
                    },
                },
            ],
            usage: {
                prompt_tokens: 120,
                completion_tokens: 30,
                total_tokens: 150,
            },
        })

        expect(result.isOk).toBe(true)
        if (result.isFail) {
            throw new Error("Expected successful response mapping")
        }

        expect(result.value).toEqual({
            provider: "openai",
            model: "gpt-4o-mini",
            responseId: "chatcmpl-1",
            content: "Looks safe after normalization.",
            finishReason: "stop",
            usage: {
                inputTokens: 120,
                outputTokens: 30,
                totalTokens: 150,
                estimatedCostUsd: 0.000036,
            },
        })
    })

    test("normalizes Anthropic response into unified LLM DTO with usage and cost", () => {
        const acl = new AnthropicCompletionAcl()

        const result = acl.transformResponse({
            id: "msg_1",
            model: "claude-3-5-haiku-latest",
            stop_reason: "max_tokens",
            content: [
                {
                    type: "text",
                    text: "Potential risk remains in parser fallback path.",
                },
            ],
            usage: {
                input_tokens: 80,
                output_tokens: 20,
            },
        })

        expect(result.isOk).toBe(true)
        if (result.isFail) {
            throw new Error("Expected successful response mapping")
        }

        expect(result.value).toEqual({
            provider: "anthropic",
            model: "claude-3-5-haiku-latest",
            responseId: "msg_1",
            content: "Potential risk remains in parser fallback path.",
            finishReason: "length",
            usage: {
                inputTokens: 80,
                outputTokens: 20,
                totalTokens: 100,
                estimatedCostUsd: 0.000045,
            },
        })
    })

    test("keeps unified domain response keys equal for OpenAI and Anthropic", () => {
        const openaiAcl = new OpenAiCompletionAcl()
        const anthropicAcl = new AnthropicCompletionAcl()

        const openai = openaiAcl.transformResponse({
            id: "chatcmpl-2",
            model: "gpt-4o-mini",
            choices: [
                {
                    finish_reason: "length",
                    message: {
                        content: "response",
                    },
                },
            ],
            usage: {
                prompt_tokens: 12,
                completion_tokens: 6,
                total_tokens: 18,
            },
        })
        const anthropic = anthropicAcl.transformResponse({
            id: "msg_2",
            model: "claude-3-5-haiku-latest",
            stop_reason: "end_turn",
            content: [
                {
                    type: "text",
                    text: "response",
                },
            ],
            usage: {
                input_tokens: 12,
                output_tokens: 6,
            },
        })

        expect(openai.isOk).toBe(true)
        expect(anthropic.isOk).toBe(true)
        if (openai.isFail || anthropic.isFail) {
            throw new Error("Expected successful response mapping")
        }

        expect(Object.keys(openai.value).sort()).toEqual(Object.keys(anthropic.value).sort())
        expect(Object.keys(openai.value.usage).sort()).toEqual(
            Object.keys(anthropic.value.usage).sort(),
        )
    })

    test("returns invalid response when OpenAI response has no usable text", () => {
        const acl = new OpenAiCompletionAcl()

        const result = acl.transformResponse({
            id: "chatcmpl-3",
            model: "gpt-4o-mini",
            choices: [
                {
                    finish_reason: "stop",
                    message: {},
                },
            ],
            usage: {
                prompt_tokens: 10,
                completion_tokens: 5,
                total_tokens: 15,
            },
        })

        expect(result.isFail).toBe(true)
        if (result.isOk) {
            throw new Error("Expected invalid response mapping failure")
        }

        expect(result.error.code).toBe(LLM_ACL_ERROR_CODE.INVALID_RESPONSE)
    })

    test("returns invalid response when OpenAI payload is not an object", () => {
        const acl = new OpenAiCompletionAcl()

        const result = acl.transformResponse("invalid")

        expect(result.isFail).toBe(true)
        if (result.isOk) {
            throw new Error("Expected invalid response mapping failure")
        }

        expect(result.error.code).toBe(LLM_ACL_ERROR_CODE.INVALID_RESPONSE)
    })

    test("returns invalid response when OpenAI response misses id or model", () => {
        const acl = new OpenAiCompletionAcl()

        const result = acl.transformResponse({
            choices: [],
        })

        expect(result.isFail).toBe(true)
        if (result.isOk) {
            throw new Error("Expected invalid response mapping failure")
        }

        expect(result.error.code).toBe(LLM_ACL_ERROR_CODE.INVALID_RESPONSE)
    })

    test("returns invalid response when OpenAI response has empty choices", () => {
        const acl = new OpenAiCompletionAcl()

        const result = acl.transformResponse({
            id: "chatcmpl-5",
            model: "gpt-4o-mini",
            choices: [],
            usage: {
                prompt_tokens: 10,
                completion_tokens: 5,
                total_tokens: 15,
            },
        })

        expect(result.isFail).toBe(true)
        if (result.isOk) {
            throw new Error("Expected invalid response mapping failure")
        }

        expect(result.error.code).toBe(LLM_ACL_ERROR_CODE.INVALID_RESPONSE)
    })

    test("returns invalid response when OpenAI choice has no message object", () => {
        const acl = new OpenAiCompletionAcl()

        const result = acl.transformResponse({
            id: "chatcmpl-6",
            model: "gpt-4o-mini",
            choices: [
                {
                    finish_reason: "stop",
                },
            ],
            usage: {
                prompt_tokens: 10,
                completion_tokens: 5,
                total_tokens: 15,
            },
        })

        expect(result.isFail).toBe(true)
        if (result.isOk) {
            throw new Error("Expected invalid response mapping failure")
        }

        expect(result.error.code).toBe(LLM_ACL_ERROR_CODE.INVALID_RESPONSE)
    })

    test("returns invalid response when OpenAI usage object is missing", () => {
        const acl = new OpenAiCompletionAcl()

        const result = acl.transformResponse({
            id: "chatcmpl-7",
            model: "gpt-4o-mini",
            choices: [
                {
                    finish_reason: "stop",
                    message: {
                        content: "ok",
                    },
                },
            ],
        })

        expect(result.isFail).toBe(true)
        if (result.isOk) {
            throw new Error("Expected invalid response mapping failure")
        }

        expect(result.error.code).toBe(LLM_ACL_ERROR_CODE.INVALID_RESPONSE)
    })

    test("returns invalid response when OpenAI usage tokens are invalid", () => {
        const acl = new OpenAiCompletionAcl()

        const result = acl.transformResponse({
            id: "chatcmpl-8",
            model: "gpt-4o-mini",
            choices: [
                {
                    finish_reason: "stop",
                    message: {
                        content: "ok",
                    },
                },
            ],
            usage: {
                prompt_tokens: "10",
                completion_tokens: 2,
                total_tokens: 12,
            },
        })

        expect(result.isFail).toBe(true)
        if (result.isOk) {
            throw new Error("Expected invalid response mapping failure")
        }

        expect(result.error.code).toBe(LLM_ACL_ERROR_CODE.INVALID_RESPONSE)
    })

    test("returns invalid response when OpenAI usage token value is negative", () => {
        const acl = new OpenAiCompletionAcl()

        const result = acl.transformResponse({
            id: "chatcmpl-10",
            model: "gpt-4o-mini",
            choices: [
                {
                    finish_reason: "stop",
                    message: {
                        content: "ok",
                    },
                },
            ],
            usage: {
                prompt_tokens: 10,
                completion_tokens: -1,
                total_tokens: 9,
            },
        })

        expect(result.isFail).toBe(true)
        if (result.isOk) {
            throw new Error("Expected invalid response mapping failure")
        }

        expect(result.error.code).toBe(LLM_ACL_ERROR_CODE.INVALID_RESPONSE)
    })

    test("returns invalid response when Anthropic text blocks are missing", () => {
        const acl = new AnthropicCompletionAcl()

        const result = acl.transformResponse({
            id: "msg_3",
            model: "claude-3-5-haiku-latest",
            stop_reason: "end_turn",
            content: [],
            usage: {
                input_tokens: 10,
                output_tokens: 5,
            },
        })

        expect(result.isFail).toBe(true)
        if (result.isOk) {
            throw new Error("Expected invalid response mapping failure")
        }

        expect(result.error.code).toBe(LLM_ACL_ERROR_CODE.INVALID_RESPONSE)
    })

    test("returns invalid response when Anthropic payload is not an object", () => {
        const acl = new AnthropicCompletionAcl()

        const result = acl.transformResponse(null)

        expect(result.isFail).toBe(true)
        if (result.isOk) {
            throw new Error("Expected invalid response mapping failure")
        }

        expect(result.error.code).toBe(LLM_ACL_ERROR_CODE.INVALID_RESPONSE)
    })

    test("returns invalid response when Anthropic response misses id or model", () => {
        const acl = new AnthropicCompletionAcl()

        const result = acl.transformResponse({
            content: [
                {
                    type: "text",
                    text: "ok",
                },
            ],
            usage: {
                input_tokens: 1,
                output_tokens: 1,
            },
        })

        expect(result.isFail).toBe(true)
        if (result.isOk) {
            throw new Error("Expected invalid response mapping failure")
        }

        expect(result.error.code).toBe(LLM_ACL_ERROR_CODE.INVALID_RESPONSE)
    })

    test("returns invalid response when Anthropic has text type but empty text", () => {
        const acl = new AnthropicCompletionAcl()

        const result = acl.transformResponse({
            id: "msg_31",
            model: "claude-3-5-haiku-latest",
            stop_reason: "end_turn",
            content: [
                {
                    type: "tool_use",
                    text: "ignored",
                },
                {
                    type: "text",
                    text: " ",
                },
            ],
            usage: {
                input_tokens: 10,
                output_tokens: 5,
            },
        })

        expect(result.isFail).toBe(true)
        if (result.isOk) {
            throw new Error("Expected invalid response mapping failure")
        }

        expect(result.error.code).toBe(LLM_ACL_ERROR_CODE.INVALID_RESPONSE)
    })

    test("returns invalid response when Anthropic usage object is missing", () => {
        const acl = new AnthropicCompletionAcl()

        const result = acl.transformResponse({
            id: "msg_32",
            model: "claude-3-5-haiku-latest",
            stop_reason: "end_turn",
            content: [
                {
                    type: "text",
                    text: "ok",
                },
            ],
        })

        expect(result.isFail).toBe(true)
        if (result.isOk) {
            throw new Error("Expected invalid response mapping failure")
        }

        expect(result.error.code).toBe(LLM_ACL_ERROR_CODE.INVALID_RESPONSE)
    })

    test("returns invalid response when Anthropic usage token fields are invalid", () => {
        const acl = new AnthropicCompletionAcl()

        const result = acl.transformResponse({
            id: "msg_33",
            model: "claude-3-5-haiku-latest",
            stop_reason: 42,
            content: [
                {
                    type: "text",
                    text: "ok",
                },
            ],
            usage: {
                input_tokens: "10",
                output_tokens: 5,
            },
        })

        expect(result.isFail).toBe(true)
        if (result.isOk) {
            throw new Error("Expected invalid response mapping failure")
        }

        expect(result.error.code).toBe(LLM_ACL_ERROR_CODE.INVALID_RESPONSE)
    })

    test("uses zero estimated cost for unknown model pricing", () => {
        const acl = new OpenAiCompletionAcl()

        const result = acl.transformResponse({
            id: "chatcmpl-4",
            model: "unknown-model",
            choices: [
                {
                    finish_reason: "content_filter",
                    message: {
                        content: "filtered",
                    },
                },
            ],
            usage: {
                prompt_tokens: 15,
                completion_tokens: 4,
                total_tokens: 19,
            },
        })

        expect(result.isOk).toBe(true)
        if (result.isFail) {
            throw new Error("Expected successful response mapping")
        }

        expect(result.value.finishReason).toBe("content_filter")
        expect(result.value.usage.estimatedCostUsd).toBe(0)
    })

    test("maps non-string OpenAI finish reason to normalized unknown", () => {
        const acl = new OpenAiCompletionAcl()

        const result = acl.transformResponse({
            id: "chatcmpl-9",
            model: "gpt-4o-mini",
            choices: [
                {
                    finish_reason: 42,
                    message: {
                        content: "ok",
                    },
                },
            ],
            usage: {
                prompt_tokens: 5,
                completion_tokens: 2,
                total_tokens: 7,
            },
        })

        expect(result.isOk).toBe(true)
        if (result.isFail) {
            throw new Error("Expected successful response mapping")
        }

        expect(result.value.finishReason).toBe("unknown")
    })

    test("maps unknown finish reasons to unknown normalized finish reason", () => {
        const acl = new AnthropicCompletionAcl()

        const result = acl.transformResponse({
            id: "msg_4",
            model: "claude-3-5-haiku-latest",
            stop_reason: "tool_use",
            content: [
                {
                    type: "text",
                    text: "some content",
                },
            ],
            usage: {
                input_tokens: 2,
                output_tokens: 1,
            },
        })

        expect(result.isOk).toBe(true)
        if (result.isFail) {
            throw new Error("Expected successful response mapping")
        }

        expect(result.value.finishReason).toBe("unknown")
    })

    test("maps Anthropic stop_sequence reason to normalized stop", () => {
        const acl = new AnthropicCompletionAcl()

        const result = acl.transformResponse({
            id: "msg_35",
            model: "claude-3-5-haiku-latest",
            stop_reason: "stop_sequence",
            content: [
                {
                    type: "text",
                    text: "done",
                },
            ],
            usage: {
                input_tokens: 1,
                output_tokens: 1,
            },
        })

        expect(result.isOk).toBe(true)
        if (result.isFail) {
            throw new Error("Expected successful response mapping")
        }

        expect(result.value.finishReason).toBe("stop")
    })

    test("normalizes rate limit errors as retryable and fallback-recommended", () => {
        const acl = new OpenAiCompletionAcl()

        const normalized = acl.normalizeError({
            message: "Too Many Requests",
            response: {
                status: 429,
                headers: {
                    "retry-after": "8",
                },
            },
        })

        expect(normalized.code).toBe(LLM_ACL_ERROR_CODE.RATE_LIMITED)
        expect(normalized.retryable).toBe(true)
        expect(normalized.fallbackRecommended).toBe(true)
        expect(normalized.retryAfterSeconds).toBe(8)
        expect(acl.shouldRetry(normalized)).toBe(true)
    })

    test("normalizes unauthorized errors as non-retryable", () => {
        const acl = new AnthropicCompletionAcl()

        const normalized = acl.normalizeError({
            message: "Forbidden",
            statusCode: 403,
        })

        expect(normalized.code).toBe(LLM_ACL_ERROR_CODE.UNAUTHORIZED)
        expect(normalized.retryable).toBe(false)
        expect(normalized.fallbackRecommended).toBe(false)
        expect(acl.shouldRetry(normalized)).toBe(false)
    })

    test("normalizes upstream 5xx errors as retryable", () => {
        const acl = new OpenAiCompletionAcl()

        const normalized = acl.normalizeError({
            message: "Bad Gateway",
            response: {
                statusCode: 502,
            },
        })

        expect(normalized.code).toBe(LLM_ACL_ERROR_CODE.PROVIDER_UNAVAILABLE)
        expect(normalized.retryable).toBe(true)
    })

    test("normalizes unknown errors with default message", () => {
        const acl = new AnthropicCompletionAcl()

        const normalized = acl.normalizeError({
            statusCode: "invalid",
        })

        expect(normalized.code).toBe(LLM_ACL_ERROR_CODE.UNKNOWN)
        expect(normalized.message).toBe("Unknown LLM provider error")
    })

    test("returns same error instance when input is already LlmAclError", () => {
        const acl = new OpenAiCompletionAcl()
        const existing = new LlmAclError({
            code: LLM_ACL_ERROR_CODE.UNKNOWN,
            message: "existing",
            retryable: false,
            fallbackRecommended: false,
        })

        const normalized = acl.normalizeError(existing)

        expect(normalized).toBe(existing)
    })

    test("normalizes direct status code from status field", () => {
        const acl = new AnthropicCompletionAcl()

        const normalized = acl.normalizeError({
            message: "Service unavailable",
            status: 503,
        })

        expect(normalized.code).toBe(LLM_ACL_ERROR_CODE.PROVIDER_UNAVAILABLE)
        expect(normalized.statusCode).toBe(503)
    })

    test("normalizes status from response.status field", () => {
        const acl = new OpenAiCompletionAcl()

        const normalized = acl.normalizeError({
            message: "Service unavailable",
            response: {
                status: "502",
            },
        })

        expect(normalized.code).toBe(LLM_ACL_ERROR_CODE.PROVIDER_UNAVAILABLE)
        expect(normalized.statusCode).toBe(502)
    })

    test("normalizes status from response.status when statusCode is invalid", () => {
        const acl = new OpenAiCompletionAcl()

        const normalized = acl.normalizeError({
            message: "Service unavailable",
            response: {
                statusCode: "not-a-number",
                status: 503,
            },
        })

        expect(normalized.code).toBe(LLM_ACL_ERROR_CODE.PROVIDER_UNAVAILABLE)
        expect(normalized.statusCode).toBe(503)
    })

    test("extracts retry-after from uppercase header", () => {
        const acl = new OpenAiCompletionAcl()

        const normalized = acl.normalizeError({
            message: "Too Many Requests",
            statusCode: 429,
            response: {
                headers: {
                    "Retry-After": "14",
                },
            },
        })

        expect(normalized.retryAfterSeconds).toBe(14)
    })

    test("extracts retry-after from direct retryAfterSeconds field", () => {
        const acl = new OpenAiCompletionAcl()

        const normalized = acl.normalizeError({
            message: "Too Many Requests",
            statusCode: 429,
            retryAfterSeconds: 6,
        })

        expect(normalized.retryAfterSeconds).toBe(6)
    })

    test("extracts status and retry-after from nested cause", () => {
        const acl = new AnthropicCompletionAcl()

        const normalized = acl.normalizeError({
            message: "Too Many Requests",
            cause: {
                response: {
                    statusCode: 429,
                    headers: {
                        "retry-after": "12",
                    },
                },
            },
        })

        expect(normalized.code).toBe(LLM_ACL_ERROR_CODE.RATE_LIMITED)
        expect(normalized.retryAfterSeconds).toBe(12)
    })

    test("normalizes native Error messages and preserves cause", () => {
        const acl = new OpenAiCompletionAcl()
        const nativeError = Object.assign(new Error("Gateway timeout"), {
            statusCode: 504,
        })

        const normalized = acl.normalizeError(nativeError)

        expect(normalized.message).toBe("Gateway timeout")
        expect(normalized.code).toBe(LLM_ACL_ERROR_CODE.PROVIDER_UNAVAILABLE)
        expect(normalized.cause).toBe(nativeError)
    })

    test("falls back to default message for empty string message", () => {
        const acl = new OpenAiCompletionAcl()

        const normalized = acl.normalizeError({
            message: "   ",
            statusCode: "invalid",
        })

        expect(normalized.code).toBe(LLM_ACL_ERROR_CODE.UNKNOWN)
        expect(normalized.message).toBe("Unknown LLM provider error")
    })

    test("normalizes unknown non-object errors", () => {
        const acl = new AnthropicCompletionAcl()

        const normalized = acl.normalizeError(42)

        expect(normalized.code).toBe(LLM_ACL_ERROR_CODE.UNKNOWN)
        expect(normalized.statusCode).toBeUndefined()
    })
})

describe("LlmFallbackPolicy", () => {
    test("builds deterministic fallback chain with deduplication", () => {
        const policy = new LlmFallbackPolicy()

        const chain = policy.buildProviderChain(LLM_PROVIDER.OPENAI, [
            LLM_PROVIDER.ANTHROPIC,
            LLM_PROVIDER.OPENAI,
            LLM_PROVIDER.ANTHROPIC,
        ])

        expect(chain).toEqual([LLM_PROVIDER.OPENAI, LLM_PROVIDER.ANTHROPIC])
    })

    test("returns next provider when error is retryable and fallback-recommended", () => {
        const policy = new LlmFallbackPolicy()
        const error = new LlmAclError({
            code: LLM_ACL_ERROR_CODE.RATE_LIMITED,
            message: "Rate limited",
            retryable: true,
            fallbackRecommended: true,
        })

        const next = policy.nextProvider(
            [LLM_PROVIDER.OPENAI, LLM_PROVIDER.ANTHROPIC],
            [LLM_PROVIDER.OPENAI],
            error,
        )

        expect(next).toBe(LLM_PROVIDER.ANTHROPIC)
    })

    test("returns undefined when fallback is not recommended", () => {
        const policy = new LlmFallbackPolicy()
        const error = new LlmAclError({
            code: LLM_ACL_ERROR_CODE.UNAUTHORIZED,
            message: "Forbidden",
            retryable: false,
            fallbackRecommended: false,
        })

        const next = policy.nextProvider(
            [LLM_PROVIDER.OPENAI, LLM_PROVIDER.ANTHROPIC],
            [LLM_PROVIDER.OPENAI],
            error,
        )

        expect(next).toBeUndefined()
    })

    test("returns undefined when providers are exhausted", () => {
        const policy = new LlmFallbackPolicy()
        const error = new LlmAclError({
            code: LLM_ACL_ERROR_CODE.RATE_LIMITED,
            message: "Rate limited",
            retryable: true,
            fallbackRecommended: true,
        })

        const next = policy.nextProvider(
            [LLM_PROVIDER.OPENAI, LLM_PROVIDER.ANTHROPIC],
            [LLM_PROVIDER.OPENAI, LLM_PROVIDER.ANTHROPIC],
            error,
        )

        expect(next).toBeUndefined()
    })
})
