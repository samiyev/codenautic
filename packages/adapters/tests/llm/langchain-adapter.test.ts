import {describe, expect, test} from "bun:test"

import {MESSAGE_ROLE, type IChatRequestDTO} from "@codenautic/core"

import {
    LANGCHAIN_ADAPTER_ERROR_CODE,
    LangChainAdapter,
    LangChainAdapterError,
    type ILangChainAdapterInput,
    type ILangChainChatModel,
} from "../../src/llm"

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
 * Collects all stream chunks into array.
 *
 * @param stream Source stream.
 * @returns Collected chunks.
 */
async function collectStreamDeltas(stream: AsyncIterable<{readonly delta: string}>): Promise<readonly string[]> {
    const deltas: string[] = []

    for await (const chunk of stream) {
        deltas.push(chunk.delta)
    }

    return deltas
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

function buildRequest(messages: IChatRequestDTO["messages"]): IChatRequestDTO {
    return {
        model: "unused-model",
        messages,
    }
}

describe("LangChainAdapter", () => {
    test("maps chat request into prompt and returns normalized response", async () => {
        const capturedInputs: string[] = []
        const chatModel: ILangChainChatModel = {
            invoke(input: string): Promise<{content: unknown}> {
                capturedInputs.push(input)
                return Promise.resolve({
                    content: {
                        text: "answer",
                    },
                })
            },
            stream(): AsyncIterable<{content: unknown}> {
                return createAsyncIterable([])
            },
        }
        const adapter = new LangChainAdapter({
            chatModel,
        })

        const response = await adapter.chat(
            buildRequest([
                {
                    role: MESSAGE_ROLE.SYSTEM,
                    content: "rules",
                },
                {
                    role: MESSAGE_ROLE.USER,
                    content: "hello",
                },
            ]),
        )

        expect(capturedInputs).toEqual(["[SYSTEM] rules\n\n[USER] hello"])
        expect(response.content).toBe("answer")
        expect(response.usage.total).toBe(0)
    })

    test("supports custom request mapper for chat invocation", async () => {
        const capturedInputs: ILangChainAdapterInput[] = []
        const chatModel: ILangChainChatModel = {
            invoke(input: string, options?: unknown): Promise<{content: unknown}> {
                capturedInputs.push({input, options})
                return Promise.resolve({
                    content: "ok",
                })
            },
            stream(): AsyncIterable<{content: unknown}> {
                return createAsyncIterable([])
            },
        }
        const adapter = new LangChainAdapter({
            chatModel,
            requestMapper(request: IChatRequestDTO): ILangChainAdapterInput {
                return {
                    input: `model:${request.model}`,
                    options: {
                        temperature: request.temperature ?? 0,
                    },
                }
            },
        })

        const response = await adapter.chat(
            buildRequest([
                {
                    role: MESSAGE_ROLE.USER,
                    content: "ping",
                },
            ]),
        )

        expect(response.content).toBe("ok")
        expect(capturedInputs).toEqual([
            {
                input: "model:unused-model",
                options: {
                    temperature: 0,
                },
            },
        ])
    })

    test("normalizes stream chunks from string, object, and array content", async () => {
        const chatModel: ILangChainChatModel = {
            invoke(): Promise<{content: unknown}> {
                return Promise.resolve({
                    content: "",
                })
            },
            stream(): AsyncIterable<{content: unknown}> {
                return createAsyncIterable([
                    {
                        content: "a",
                    },
                    {
                        content: {
                            text: "b",
                        },
                    },
                    {
                        content: [
                            "c",
                            {
                                text: "d",
                            },
                        ],
                    },
                ])
            },
        }
        const adapter = new LangChainAdapter({
            chatModel,
        })

        const deltas = await collectStreamDeltas(
            adapter.stream(
                buildRequest([
                    {
                        role: MESSAGE_ROLE.USER,
                        content: "stream",
                    },
                ]),
            ),
        )

        expect(deltas).toEqual([
            "a",
            "b",
            "cd",
        ])
    })

    test("delegates embeddings to configured LangChain embeddings", async () => {
        const adapter = new LangChainAdapter({
            chatModel: {
                invoke(): Promise<{content: unknown}> {
                    return Promise.resolve({
                        content: "",
                    })
                },
                stream(): AsyncIterable<{content: unknown}> {
                    return createAsyncIterable([])
                },
            },
            embeddings: {
                embedDocuments(texts: readonly string[]): Promise<readonly number[][]> {
                    return Promise.resolve(texts.map((text): number[] => [text.length]))
                },
            },
        })

        const vectors = await adapter.embed(["ab", "abcd"])

        expect(vectors).toEqual([[2], [4]])
    })

    test("throws when embed is called without embeddings implementation", async () => {
        const adapter = new LangChainAdapter({
            chatModel: {
                invoke(): Promise<{content: unknown}> {
                    return Promise.resolve({
                        content: "",
                    })
                },
                stream(): AsyncIterable<{content: unknown}> {
                    return createAsyncIterable([])
                },
            },
        })

        const error = await captureRejectedError(() => adapter.embed(["a"]))

        expect(error).toBeInstanceOf(LangChainAdapterError)
        if (error instanceof LangChainAdapterError) {
            expect(error.code).toBe(LANGCHAIN_ADAPTER_ERROR_CODE.EMBEDDINGS_NOT_CONFIGURED)
        }
    })

    test("wraps invoke, stream, and embedding failures with typed errors", async () => {
        const failingAdapter = new LangChainAdapter({
            chatModel: {
                invoke(): Promise<{content: unknown}> {
                    return Promise.reject(new Error("invoke failed"))
                },
                stream(): AsyncIterable<{content: unknown}> {
                    return createAsyncIterable([
                        {
                            content: "ok",
                        },
                    ])
                },
            },
            embeddings: {
                embedDocuments(): Promise<readonly number[][]> {
                    return Promise.reject(new Error("embed failed"))
                },
            },
        })
        const invokeError = await captureRejectedError(() =>
            failingAdapter.chat(
                buildRequest([
                    {
                        role: MESSAGE_ROLE.USER,
                        content: "hi",
                    },
                ]),
            ),
        )

        expect(invokeError).toBeInstanceOf(LangChainAdapterError)
        if (invokeError instanceof LangChainAdapterError) {
            expect(invokeError.code).toBe(LANGCHAIN_ADAPTER_ERROR_CODE.INVOCATION_FAILED)
            expect(invokeError.causeMessage).toBe("invoke failed")
        }

        const streamAdapter = new LangChainAdapter({
            chatModel: {
                invoke(): Promise<{content: unknown}> {
                    return Promise.resolve({
                        content: "",
                    })
                },
                stream(): AsyncIterable<{content: unknown}> {
                    return {
                        [Symbol.asyncIterator](): AsyncIterator<{content: unknown}> {
                            return {
                                next(): Promise<IteratorResult<{content: unknown}>> {
                                    return Promise.reject(new Error("stream failed"))
                                },
                            }
                        },
                    }
                },
            },
        })
        const streamError = await captureRejectedError(() =>
            collectStreamDeltas(
                streamAdapter.stream(
                    buildRequest([
                        {
                            role: MESSAGE_ROLE.USER,
                            content: "stream",
                        },
                    ]),
                ),
            ),
        )

        expect(streamError).toBeInstanceOf(LangChainAdapterError)
        if (streamError instanceof LangChainAdapterError) {
            expect(streamError.code).toBe(LANGCHAIN_ADAPTER_ERROR_CODE.STREAM_FAILED)
            expect(streamError.causeMessage).toBe("stream failed")
        }

        const embedError = await captureRejectedError(() => failingAdapter.embed(["abc"]))

        expect(embedError).toBeInstanceOf(LangChainAdapterError)
        if (embedError instanceof LangChainAdapterError) {
            expect(embedError.code).toBe(LANGCHAIN_ADAPTER_ERROR_CODE.EMBEDDING_FAILED)
            expect(embedError.causeMessage).toBe("embed failed")
        }
    })

    test("validates constructor and default mapper invariants", async () => {
        expect(() => {
            return new LangChainAdapter({
                chatModel: {
                    invoke: undefined as unknown as ILangChainChatModel["invoke"],
                    stream: undefined as unknown as ILangChainChatModel["stream"],
                },
            })
        }).toThrow("LangChain adapter requires chatModel with invoke() method")

        expect(() => {
            return new LangChainAdapter({
                chatModel: {
                    invoke(): Promise<{content: unknown}> {
                        return Promise.resolve({
                            content: "",
                        })
                    },
                    stream(): AsyncIterable<{content: unknown}> {
                        return createAsyncIterable([])
                    },
                },
                requestMapper: 1 as unknown as never,
            })
        }).toThrow("LangChain adapter requestMapper must be a function when provided")

        const adapter = new LangChainAdapter({
            chatModel: {
                invoke(): Promise<{content: unknown}> {
                    return Promise.resolve({
                        content: "",
                    })
                },
                stream(): AsyncIterable<{content: unknown}> {
                    return createAsyncIterable([])
                },
            },
        })
        const error = await captureRejectedError(() =>
            adapter.chat(
                buildRequest([
                    {
                        role: MESSAGE_ROLE.USER,
                        content: "   ",
                    },
                ]),
            ),
        )

        expect(error).toBeInstanceOf(LangChainAdapterError)
        if (error instanceof LangChainAdapterError) {
            expect(error.code).toBe(LANGCHAIN_ADAPTER_ERROR_CODE.INVALID_MESSAGE_PAYLOAD)
        }
    })
})
