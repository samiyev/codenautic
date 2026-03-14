import {describe, expect, test} from "bun:test"

import {ApiError} from "@google/genai"
import {
    CHAT_FINISH_REASON,
    CHAT_RESPONSE_FORMAT,
    MESSAGE_ROLE,
    type IChatChunkDTO,
} from "@codenautic/core"

import {
    GoogleProvider,
    GoogleProviderError,
    type IGoogleGenAIClient,
} from "../../src/llm"

type AsyncMethod<TResult> = (...args: readonly unknown[]) => Promise<TResult>
type IGoogleClientMockOverrides = {
    readonly generateContent?: IGoogleGenAIClient["models"]["generateContent"]
    readonly generateContentStream?: IGoogleGenAIClient["models"]["generateContentStream"]
    readonly embedContent?: IGoogleGenAIClient["models"]["embedContent"]
}

/**
 * HTTP-shaped error used in retry tests.
 */
interface IGoogleHttpError extends Error {
    status: number
    headers: Headers
}

/**
 * Creates async mock from queued handlers.
 *
 * @param handlers Per-call handlers.
 * @returns Async function with captured calls.
 */
function createQueuedAsyncMethod<TResult>(
    handlers: readonly ((...args: readonly unknown[]) => TResult | Promise<TResult>)[],
): AsyncMethod<TResult> & {readonly calls: readonly (readonly unknown[])[]} {
    const calls: (readonly unknown[])[] = []
    let callIndex = 0

    const method = ((...args: readonly unknown[]): Promise<TResult> => {
        calls.push(args)

        const handler = handlers[callIndex]
        callIndex += 1
        if (handler === undefined) {
            return Promise.reject(new Error("Unexpected call"))
        }

        return Promise.resolve(handler(...args))
    }) as AsyncMethod<TResult> & {readonly calls: readonly (readonly unknown[])[]}

    Object.defineProperty(method, "calls", {
        value: calls,
    })

    return method
}

/**
 * Creates async iterable from static item list.
 *
 * @param items Streamed items.
 * @returns Async iterable over items.
 */
function createAsyncIterable<TItem>(items: readonly TItem[]): AsyncIterable<TItem> {
    return {
        [Symbol.asyncIterator](): AsyncIterator<TItem> {
            let index = 0

            return {
                next(): Promise<IteratorResult<TItem>> {
                    const item = items[index]
                    index += 1

                    if (item === undefined) {
                        return Promise.resolve({
                            done: true,
                            value: undefined,
                        })
                    }

                    return Promise.resolve({
                        done: false,
                        value: item,
                    })
                },
            }
        },
    }
}

/**
 * Creates default unexpected method for Google mock sections.
 *
 * @returns Method rejecting on unexpected invocation.
 */
function createUnexpectedMethod<TMethod>(): TMethod {
    return ((..._args: readonly unknown[]): Promise<never> => {
        return Promise.reject(new Error("Unexpected Google client call"))
    }) as TMethod
}

/**
 * Resolves override or fallback unexpected method.
 *
 * @param override Optional override.
 * @returns Override or default rejecting method.
 */
function resolveMethod<TMethod>(override: TMethod | undefined): TMethod {
    return override ?? createUnexpectedMethod<TMethod>()
}

/**
 * Creates Google client mock.
 *
 * @param overrides Partial method overrides.
 * @returns Google-compatible mock.
 */
function createGoogleClientMock(overrides: IGoogleClientMockOverrides): IGoogleGenAIClient {
    return {
        models: {
            generateContent: resolveMethod(overrides.generateContent),
            generateContentStream: resolveMethod(overrides.generateContentStream),
            embedContent: resolveMethod(overrides.embedContent),
        },
    }
}

/**
 * Creates retryable HTTP-style error with status and optional retry-after.
 *
 * @param statusCode HTTP status code.
 * @param message Error message.
 * @param retryAfterSeconds Optional retry-after seconds.
 * @returns Error object with status and headers.
 */
function createGoogleHttpError(
    statusCode: number,
    message: string,
    retryAfterSeconds: string | undefined,
): IGoogleHttpError {
    const error = new Error(message) as IGoogleHttpError
    error.status = statusCode
    error.headers = new Headers()

    if (retryAfterSeconds !== undefined) {
        error.headers.set("retry-after", retryAfterSeconds)
    }

    return error
}

/**
 * Collects all streamed chunks into array.
 *
 * @param stream Source chunk stream.
 * @returns Materialized chunk list.
 */
async function collectChunks(stream: AsyncIterable<IChatChunkDTO>): Promise<readonly IChatChunkDTO[]> {
    const chunks: IChatChunkDTO[] = []

    for await (const chunk of stream) {
        chunks.push(chunk)
    }

    return chunks
}

/**
 * Captures rejected error for assertion-friendly checks.
 *
 * @param execute Async action expected to fail.
 * @returns Rejected error instance.
 */
async function captureRejectedError(execute: () => Promise<unknown>): Promise<Error> {
    try {
        await execute()
    } catch (error) {
        if (error instanceof Error) {
            return error
        }

        throw new Error("Expected error object to be thrown")
    }

    throw new Error("Expected promise to reject")
}

describe("GoogleProvider", () => {
    test("executes chat request with tools, finish reason and JSON mode", async () => {
        const generateContent = createQueuedAsyncMethod([
            () => {
                return {
                    text: "{\"ok\":true}",
                    functionCalls: [
                        {
                            id: "call-1",
                            name: "calc",
                            args: {
                                a: 1,
                            },
                        },
                    ],
                    usageMetadata: {
                        promptTokenCount: 12,
                        candidatesTokenCount: 4,
                        totalTokenCount: 16,
                    },
                    candidates: [
                        {
                            finishReason: "STOP",
                        },
                    ],
                }
            },
        ])
        const provider = new GoogleProvider({
            client: createGoogleClientMock({
                generateContent,
            }),
        })

        const response = await provider.chat({
            model: " gemini-2.5-flash ",
            maxTokens: 300,
            temperature: 1.5,
            messages: [
                {
                    role: MESSAGE_ROLE.SYSTEM,
                    content: " return JSON only ",
                },
                {
                    role: MESSAGE_ROLE.USER,
                    content: " solve task ",
                },
            ],
            tools: [
                {
                    name: "calc",
                    description: "calculator",
                    parameters: {
                        type: "object",
                    },
                },
            ],
            responseFormat: {
                type: CHAT_RESPONSE_FORMAT.JSON_OBJECT,
            },
        })

        expect(response).toEqual({
            content: "{\"ok\":true}",
            toolCalls: [
                {
                    id: "call-1",
                    name: "calc",
                    arguments: "{\"a\":1}",
                },
            ],
            usage: {
                input: 12,
                output: 4,
                total: 16,
            },
            finishReason: CHAT_FINISH_REASON.STOP,
        })
        expect(generateContent.calls).toHaveLength(1)
        expect(generateContent.calls[0]?.[0]).toMatchObject({
            model: "gemini-2.5-flash",
            config: {
                systemInstruction: "return JSON only",
                temperature: 1.5,
                maxOutputTokens: 300,
                responseMimeType: "application/json",
                tools: [
                    {
                        functionDeclarations: [
                            {
                                name: "calc",
                                description: "calculator",
                            },
                        ],
                    },
                ],
            },
            contents: [
                {
                    role: "user",
                    parts: [
                        {
                            text: "solve task",
                        },
                    ],
                },
            ],
        })
    })

    test("streams text deltas, finish reason and final usage chunk", async () => {
        const generateContentStream = createQueuedAsyncMethod([
            () => {
                return createAsyncIterable([
                    {
                        text: "Hel",
                    },
                    {
                        text: "lo",
                    },
                    {
                        text: "",
                        candidates: [
                            {
                                finishReason: "STOP",
                            },
                        ],
                        usageMetadata: {
                            promptTokenCount: 5,
                            candidatesTokenCount: 2,
                            totalTokenCount: 7,
                        },
                    },
                ])
            },
        ])
        const provider = new GoogleProvider({
            client: createGoogleClientMock({
                generateContentStream: generateContentStream as unknown as IGoogleGenAIClient["models"]["generateContentStream"],
            }),
        })

        const chunks = await collectChunks(
            provider.stream({
                model: "gemini-2.5-flash",
                messages: [
                    {
                        role: MESSAGE_ROLE.USER,
                        content: "Say hello",
                    },
                ],
            }),
        )

        expect(chunks).toEqual([
            {
                delta: "Hel",
                finishReason: undefined,
                usage: undefined,
            },
            {
                delta: "lo",
                finishReason: undefined,
                usage: undefined,
            },
            {
                delta: "",
                finishReason: CHAT_FINISH_REASON.STOP,
                usage: {
                    input: 5,
                    output: 2,
                    total: 7,
                },
            },
        ])
        expect(generateContentStream.calls[0]?.[0]).toMatchObject({
            model: "gemini-2.5-flash",
        })
    })

    test("creates embeddings with configured embedding model", async () => {
        const embedContent = createQueuedAsyncMethod([
            () => {
                return {
                    embeddings: [
                        {
                            values: [0.1, 0.2],
                        },
                        {
                            values: [0.3, 0.4],
                        },
                    ],
                }
            },
        ])
        const provider = new GoogleProvider({
            client: createGoogleClientMock({
                embedContent,
            }),
            embeddingModel: "text-embedding-004",
        })

        const embeddings = await provider.embed(["first", "second"])

        expect(embeddings).toEqual([
            [0.1, 0.2],
            [0.3, 0.4],
        ])
        expect(embedContent.calls[0]?.[0]).toEqual({
            model: "text-embedding-004",
            contents: ["first", "second"],
        })
    })

    test("retries retryable failures using retry-after header", async () => {
        const sleepCalls: number[] = []
        const generateContent = createQueuedAsyncMethod([
            () => {
                throw createGoogleHttpError(429, "rate limited", "1")
            },
            () => {
                return {
                    text: "ok",
                    usageMetadata: {
                        promptTokenCount: 1,
                        candidatesTokenCount: 1,
                        totalTokenCount: 2,
                    },
                    candidates: [
                        {
                            finishReason: "STOP",
                        },
                    ],
                }
            },
        ])
        const provider = new GoogleProvider({
            client: createGoogleClientMock({
                generateContent,
            }),
            sleep(delayMs: number): Promise<void> {
                sleepCalls.push(delayMs)
                return Promise.resolve()
            },
        })

        const response = await provider.chat({
            model: "gemini-2.5-flash",
            messages: [
                {
                    role: MESSAGE_ROLE.USER,
                    content: "retry please",
                },
            ],
        })

        expect(response.content).toBe("ok")
        expect(sleepCalls).toEqual([1000])
        expect(generateContent.calls).toHaveLength(2)
    })

    test("uses default sleep implementation for retry backoff when custom sleeper is omitted", async () => {
        const generateContent = createQueuedAsyncMethod([
            () => {
                throw createGoogleHttpError(429, "rate limited", "0")
            },
            () => {
                return {
                    text: "ok after default sleep",
                    usageMetadata: {
                        promptTokenCount: 2,
                        candidatesTokenCount: 1,
                        totalTokenCount: 3,
                    },
                    candidates: [
                        {
                            finishReason: "STOP",
                        },
                    ],
                }
            },
        ])
        const provider = new GoogleProvider({
            client: createGoogleClientMock({
                generateContent,
            }),
        })

        const response = await provider.chat({
            model: "gemini-2.5-flash",
            messages: [
                {
                    role: MESSAGE_ROLE.USER,
                    content: "retry with default sleep",
                },
            ],
        })

        expect(response.content).toBe("ok after default sleep")
        expect(generateContent.calls).toHaveLength(2)
    })

    test("stops on non-retryable errors and exposes exhausted retry metadata", async () => {
        const badRequestProvider = new GoogleProvider({
            client: createGoogleClientMock({
                generateContent: createQueuedAsyncMethod([
                    () => {
                        throw new ApiError({
                            message: "bad request",
                            status: 400,
                        })
                    },
                ]),
            }),
        })

        const badRequestError = await captureRejectedError(() =>
            badRequestProvider.chat({
                model: "gemini-2.5-flash",
                messages: [
                    {
                        role: MESSAGE_ROLE.USER,
                        content: "invalid",
                    },
                ],
            }),
        )

        expect(badRequestError).toBeInstanceOf(GoogleProviderError)
        expect(badRequestError).toMatchObject({
            name: "GoogleProviderError",
            statusCode: 400,
            isRetryable: false,
        })

        const sleepCalls: number[] = []
        const serverProvider = new GoogleProvider({
            client: createGoogleClientMock({
                generateContent: createQueuedAsyncMethod([
                    () => {
                        throw new ApiError({
                            message: "server down",
                            status: 503,
                        })
                    },
                    () => {
                        throw new ApiError({
                            message: "server down",
                            status: 503,
                        })
                    },
                ]),
            }),
            retryMaxAttempts: 2,
            sleep(delayMs: number): Promise<void> {
                sleepCalls.push(delayMs)
                return Promise.resolve()
            },
        })

        const serverError = await captureRejectedError(() =>
            serverProvider.chat({
                model: "gemini-2.5-flash",
                messages: [
                    {
                        role: MESSAGE_ROLE.USER,
                        content: "server",
                    },
                ],
            }),
        )

        expect(serverError).toBeInstanceOf(GoogleProviderError)
        expect(serverError).toMatchObject({
            name: "GoogleProviderError",
            statusCode: 503,
            isRetryable: true,
        })
        expect(sleepCalls).toEqual([250])
    })

    test("validates constructor and embedding inputs", async () => {
        expect(() => {
            return new GoogleProvider({
                apiKey: " ",
            })
        }).toThrow("apiKey cannot be empty")

        expect(() => {
            return new GoogleProvider({
                client: createGoogleClientMock({}),
                retryMaxAttempts: 0,
            })
        }).toThrow("retryMaxAttempts must be positive integer")

        const provider = new GoogleProvider({
            client: createGoogleClientMock({
                embedContent: createQueuedAsyncMethod([
                    () => {
                        return {
                            embeddings: [
                                {
                                    values: [1, 2],
                                },
                            ],
                        }
                    },
                ]),
            }),
        })

        const invalidTextError = await captureRejectedError(() => provider.embed([" "]))
        expect(invalidTextError.message).toContain("texts[0] cannot be empty")

        const mismatchError = await captureRejectedError(() =>
            provider.embed(["first", "second"]),
        )
        expect(mismatchError.message).toContain("Google embeddings response count mismatch")
        expect(await provider.embed([])).toEqual([])
    })
})
