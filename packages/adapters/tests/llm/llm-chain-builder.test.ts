import {describe, expect, test} from "bun:test"

import {
    MESSAGE_ROLE,
    type IChatRequestDTO,
    type IChatResponseDTO,
    type ILLMProvider,
    type IStreamingChatResponseDTO,
} from "@codenautic/core"

import {
    LLM_CHAIN_BUILDER_ERROR_CODE,
    LlmChainBuilder,
    LlmChainBuilderError,
    PromptTemplateManager,
} from "../../src/llm"

interface IProviderMock extends ILLMProvider {
    readonly requests: readonly IChatRequestDTO[]
    readonly chatCallCount: number
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
 * Creates one empty streaming response.
 *
 * @returns Empty streaming response payload.
 */
function createEmptyStreamingResponse(): IStreamingChatResponseDTO {
    return createAsyncIterable([])
}

/**
 * Creates deterministic chat response payload.
 *
 * @param content Response content.
 * @returns Chat response DTO.
 */
function buildChatResponse(content: string): IChatResponseDTO {
    return {
        content,
        usage: {
            input: 0,
            output: 0,
            total: 0,
        },
    }
}

/**
 * Creates minimal LLM provider mock with deterministic responses.
 *
 * @param responses Ordered response contents.
 * @returns Provider mock.
 */
function createProviderMock(responses: readonly string[]): IProviderMock {
    const requests: IChatRequestDTO[] = []
    let responseIndex = 0

    return {
        get requests(): readonly IChatRequestDTO[] {
            return requests
        },
        get chatCallCount(): number {
            return requests.length
        },
        chat(request: IChatRequestDTO): Promise<IChatResponseDTO> {
            requests.push(request)

            const response = responses[responseIndex] ?? `response-${responseIndex + 1}`
            responseIndex += 1

            return Promise.resolve(buildChatResponse(response))
        },
        stream(_request: IChatRequestDTO): IStreamingChatResponseDTO {
            return createEmptyStreamingResponse()
        },
        embed(texts: readonly string[]): Promise<readonly number[][]> {
            return Promise.resolve(texts.map((): number[] => []))
        },
    }
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

describe("LlmChainBuilder", () => {
    test("registers chains and lists them in alphabetical order", () => {
        const manager = new PromptTemplateManager()
        const provider = createProviderMock([])
        const builder = new LlmChainBuilder({
            provider,
            promptTemplateManager: manager,
            defaultModel: "gpt-review",
        })

        builder.registerChain({
            name: "review.summary",
            steps: [{
                name: "summary",
                templateName: "summary.template",
            }],
        })
        builder.registerChain({
            name: "review.analysis",
            steps: [{
                name: "analysis",
                templateName: "analysis.template",
            }],
        })

        expect(builder.listChains().map((chain): string => chain.name)).toEqual([
            "review.analysis",
            "review.summary",
        ])
        expect(builder.hasChain("review.summary")).toBe(true)
        expect(builder.removeChain("review.summary")).toBe(true)
        expect(builder.hasChain("review.summary")).toBe(false)
        expect(builder.removeChain("review.summary")).toBe(false)
    })

    test("executes review chain sequentially and carries step output variables", async () => {
        const manager = new PromptTemplateManager()
        manager.registerTemplate("review.system", "Repository {{repository}}")
        manager.registerTemplate("review.first", "Analyze diff: {{diff}}")
        manager.registerTemplate(
            "review.second",
            "Summarize previous output: {{firstStepResponse}}",
        )

        const provider = createProviderMock([
            "analysis-ready",
            "final-summary",
        ])
        const builder = new LlmChainBuilder({
            provider,
            promptTemplateManager: manager,
            defaultModel: "gpt-review",
        })
        builder.registerChain({
            name: "review.pipeline",
            systemTemplateName: "review.system",
            steps: [
                {
                    name: "firstStep",
                    templateName: "review.first",
                },
                {
                    name: "secondStep",
                    templateName: "review.second",
                    outputVariableName: "summary",
                },
            ],
        })

        const result = await builder.execute({
            chainName: "review.pipeline",
            runtimeVariables: {
                repository: "repo-a",
                diff: "line-a",
            },
        })

        expect(provider.requests).toHaveLength(2)
        expect(provider.requests[0]?.model).toBe("gpt-review")
        expect(provider.requests[0]?.messages).toEqual([
            {
                role: MESSAGE_ROLE.SYSTEM,
                content: "Repository repo-a",
            },
            {
                role: MESSAGE_ROLE.USER,
                content: "Analyze diff: line-a",
            },
        ])
        expect(provider.requests[1]?.messages).toEqual([
            {
                role: MESSAGE_ROLE.SYSTEM,
                content: "Repository repo-a",
            },
            {
                role: MESSAGE_ROLE.USER,
                content: "Analyze diff: line-a",
            },
            {
                role: MESSAGE_ROLE.ASSISTANT,
                content: "analysis-ready",
            },
            {
                role: MESSAGE_ROLE.USER,
                content: "Summarize previous output: analysis-ready",
            },
        ])

        expect(result.finalContent).toBe("final-summary")
        expect(result.runtimeVariables["firstStepResponse"]).toBe("analysis-ready")
        expect(result.runtimeVariables["summary"]).toBe("final-summary")
        expect(result.stepResults.map((step): number => step.attemptCount)).toEqual([1, 1])
    })

    test("retries step execution with configured backoff and succeeds", async () => {
        const manager = new PromptTemplateManager()
        manager.registerTemplate("review.step", "Prompt {{input}}")

        const requests: IChatRequestDTO[] = []
        let chatCallCount = 0
        const provider: ILLMProvider = {
            chat(request: IChatRequestDTO): Promise<IChatResponseDTO> {
                requests.push(request)
                chatCallCount += 1

                if (chatCallCount === 1) {
                    return Promise.reject(new Error("transient"))
                }

                return Promise.resolve(buildChatResponse("recovered"))
            },
            stream(_request: IChatRequestDTO): IStreamingChatResponseDTO {
                return createEmptyStreamingResponse()
            },
            embed(texts: readonly string[]): Promise<readonly number[][]> {
                return Promise.resolve(texts.map((): number[] => []))
            },
        }
        const slept: number[] = []
        const builder = new LlmChainBuilder({
            provider,
            promptTemplateManager: manager,
            defaultModel: "gpt-review",
            defaultMaxAttempts: 2,
            defaultRetryBackoffMs: 17,
            sleep(delayMs: number): Promise<void> {
                slept.push(delayMs)
                return Promise.resolve()
            },
        })
        builder.registerChain({
            name: "review.retry",
            steps: [{
                name: "retryStep",
                templateName: "review.step",
            }],
        })

        const result = await builder.execute({
            chainName: "review.retry",
            runtimeVariables: {
                input: "x",
            },
        })

        expect(chatCallCount).toBe(2)
        expect(requests).toHaveLength(2)
        expect(slept).toEqual([17])
        expect(result.finalContent).toBe("recovered")
        expect(result.stepResults[0]?.attemptCount).toBe(2)
    })

    test("returns typed error when chain is not registered", async () => {
        const builder = new LlmChainBuilder({
            provider: createProviderMock([]),
            promptTemplateManager: new PromptTemplateManager(),
            defaultModel: "gpt-review",
        })

        const error = await captureRejectedError(() =>
            builder.execute({
                chainName: "missing.chain",
            }),
        )

        expect(error).toBeInstanceOf(LlmChainBuilderError)
        if (error instanceof LlmChainBuilderError) {
            expect(error.code).toBe(LLM_CHAIN_BUILDER_ERROR_CODE.CHAIN_NOT_FOUND)
            expect(error.chainName).toBe("missing.chain")
        }
    })

    test("deduplicates concurrent idempotent executions and serves cached result", async () => {
        const manager = new PromptTemplateManager()
        manager.registerTemplate("review.single", "Single {{value}}")

        const requests: IChatRequestDTO[] = []
        let resolveChat:
            | ((response: IChatResponseDTO) => void)
            | undefined
        const provider: ILLMProvider = {
            chat(request: IChatRequestDTO): Promise<IChatResponseDTO> {
                requests.push(request)
                return new Promise((resolve) => {
                    resolveChat = resolve
                })
            },
            stream(_request: IChatRequestDTO): IStreamingChatResponseDTO {
                return createEmptyStreamingResponse()
            },
            embed(texts: readonly string[]): Promise<readonly number[][]> {
                return Promise.resolve(texts.map((): number[] => []))
            },
        }
        const builder = new LlmChainBuilder({
            provider,
            promptTemplateManager: manager,
            defaultModel: "gpt-review",
        })
        builder.registerChain({
            name: "review.single",
            steps: [{
                name: "singleStep",
                templateName: "review.single",
            }],
        })

        const firstRunPromise = builder.execute({
            chainName: "review.single",
            runtimeVariables: {
                value: "A",
            },
            idempotencyKey: "request-1",
        })
        const secondRunPromise = builder.execute({
            chainName: "review.single",
            runtimeVariables: {
                value: "A",
            },
            idempotencyKey: "request-1",
        })

        if (resolveChat === undefined) {
            throw new Error("Expected provider execution to be started")
        }
        resolveChat(buildChatResponse("single-result"))

        const [firstRun, secondRun] = await Promise.all([
            firstRunPromise,
            secondRunPromise,
        ])

        expect(firstRun.finalContent).toBe("single-result")
        expect(secondRun.finalContent).toBe("single-result")
        expect(requests).toHaveLength(1)

        const cachedRun = await builder.execute({
            chainName: "review.single",
            runtimeVariables: {
                value: "A",
            },
            idempotencyKey: "request-1",
        })

        expect(cachedRun.finalContent).toBe("single-result")
        expect(requests).toHaveLength(1)
    })

    test("validates duplicate step names in one chain", () => {
        const builder = new LlmChainBuilder({
            provider: createProviderMock([]),
            promptTemplateManager: new PromptTemplateManager(),
            defaultModel: "gpt-review",
        })

        expect(() =>
            builder.registerChain({
                name: "review.invalid",
                steps: [
                    {
                        name: "dup",
                        templateName: "a",
                    },
                    {
                        name: "dup",
                        templateName: "b",
                    },
                ],
            }),
        ).toThrow(LlmChainBuilderError)
    })
})
