import {describe, expect, test} from "bun:test"

import {
    LANGCHAIN_CALLBACK_EVENT_TYPE,
    LANGSMITH_TRACING_SERVICE_ERROR_CODE,
    LangSmithTracingService,
    LangSmithTracingServiceError,
    type ILangChainCallbackEvent,
    type ILangSmithTraceCompleteInput,
    type ILangSmithTraceStartInput,
    type ILangSmithTracingClient,
} from "../../src/llm"

interface ILangSmithTracingClientMock extends ILangSmithTracingClient {
    readonly startedRuns: ReadonlyArray<ILangSmithTraceStartInput>
    readonly completedRuns: ReadonlyArray<{
        readonly runId: string
        readonly input: ILangSmithTraceCompleteInput
    }>
    readonly failedRuns: ReadonlyArray<{
        readonly runId: string
        readonly error: unknown
        readonly metadata?: Readonly<Record<string, unknown>>
    }>
}

/**
 * Creates LangSmith tracing client mock with optional transient failures.
 *
 * @param options Failure configuration.
 * @returns Client mock.
 */
function createTracingClientMock(options: {
    readonly failStartTimes?: number
    readonly failCompleteTimes?: number
    readonly failFailTimes?: number
} = {}): ILangSmithTracingClientMock {
    const startedRuns: ILangSmithTraceStartInput[] = []
    const completedRuns: Array<{
        readonly runId: string
        readonly input: ILangSmithTraceCompleteInput
    }> = []
    const failedRuns: Array<{
        readonly runId: string
        readonly error: unknown
        readonly metadata?: Readonly<Record<string, unknown>>
    }> = []
    let failStartTimes = options.failStartTimes ?? 0
    let failCompleteTimes = options.failCompleteTimes ?? 0
    let failFailTimes = options.failFailTimes ?? 0

    return {
        get startedRuns(): ReadonlyArray<ILangSmithTraceStartInput> {
            return startedRuns
        },
        get completedRuns(): ReadonlyArray<{
            readonly runId: string
            readonly input: ILangSmithTraceCompleteInput
        }> {
            return completedRuns
        },
        get failedRuns(): ReadonlyArray<{
            readonly runId: string
            readonly error: unknown
            readonly metadata?: Readonly<Record<string, unknown>>
        }> {
            return failedRuns
        },
        startRun(input: ILangSmithTraceStartInput): Promise<string> {
            if (failStartTimes > 0) {
                failStartTimes -= 1
                return Promise.reject(new Error("start failed"))
            }

            startedRuns.push(input)
            return Promise.resolve(`ls-run-${startedRuns.length}`)
        },
        completeRun(runId: string, input: ILangSmithTraceCompleteInput): Promise<void> {
            if (failCompleteTimes > 0) {
                failCompleteTimes -= 1
                return Promise.reject(new Error("complete failed"))
            }

            completedRuns.push({
                runId,
                input,
            })
            return Promise.resolve()
        },
        failRun(
            runId: string,
            error: unknown,
            metadata?: Readonly<Record<string, unknown>>,
        ): Promise<void> {
            if (failFailTimes > 0) {
                failFailTimes -= 1
                return Promise.reject(new Error("fail failed"))
            }

            failedRuns.push({
                runId,
                error,
                metadata,
            })
            return Promise.resolve()
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

/**
 * Creates normalized callback event fixture.
 *
 * @param type Callback event type.
 * @param runId Callback run identifier.
 * @param payload Optional event payload.
 * @returns Callback event.
 */
function createEvent(
    type: ILangChainCallbackEvent["type"],
    runId: string,
    payload: Readonly<Record<string, unknown>> = {},
): ILangChainCallbackEvent {
    return {
        type,
        runId,
        name: "review.pipeline",
        timestamp: "2026-03-15T12:00:00.000Z",
        payload,
    }
}

describe("LangSmithTracingService", () => {
    test("traces start and end callback lifecycle into LangSmith client", async () => {
        const client = createTracingClientMock()
        const service = new LangSmithTracingService({
            tracer: client,
        })

        await service.handle(
            createEvent(LANGCHAIN_CALLBACK_EVENT_TYPE.CHAIN_START, "run-1", {
                repositoryId: "repo-a",
            }),
        )
        await service.handle(
            createEvent(LANGCHAIN_CALLBACK_EVENT_TYPE.CHAIN_END, "run-1", {
                summary: "done",
            }),
        )

        expect(client.startedRuns).toHaveLength(1)
        expect(client.startedRuns[0]).toMatchObject({
            runName: "review.pipeline",
            inputs: {
                callbackRunId: "run-1",
            },
        })
        expect(client.completedRuns).toHaveLength(1)
        expect(client.completedRuns[0]).toMatchObject({
            runId: "ls-run-1",
            input: {
                outputs: {
                    eventType: LANGCHAIN_CALLBACK_EVENT_TYPE.CHAIN_END,
                    payload: {
                        summary: "done",
                    },
                },
                metadata: {
                    callbackRunId: "run-1",
                    callbackEventType: LANGCHAIN_CALLBACK_EVENT_TYPE.CHAIN_END,
                },
            },
        })
    })

    test("aggregates llm token events and flushes them on llm end", async () => {
        const client = createTracingClientMock()
        const service = new LangSmithTracingService({
            tracer: client,
        })

        await service.handle(createEvent(LANGCHAIN_CALLBACK_EVENT_TYPE.LLM_START, "run-2"))
        await service.handle(
            createEvent(LANGCHAIN_CALLBACK_EVENT_TYPE.LLM_TOKEN, "run-2", {
                token: "A",
            }),
        )
        await service.handle(
            createEvent(LANGCHAIN_CALLBACK_EVENT_TYPE.LLM_TOKEN, "run-2", {
                token: "B",
            }),
        )
        await service.handle(createEvent(LANGCHAIN_CALLBACK_EVENT_TYPE.LLM_END, "run-2"))

        expect(client.completedRuns).toHaveLength(1)
        expect(client.completedRuns[0]?.input.outputs).toEqual({
            eventType: LANGCHAIN_CALLBACK_EVENT_TYPE.LLM_END,
            payload: {},
            streamedText: "AB",
        })
    })

    test("starts synthetic run for error events when run was not started", async () => {
        const client = createTracingClientMock()
        const service = new LangSmithTracingService({
            tracer: client,
        })

        await service.handle(
            createEvent(LANGCHAIN_CALLBACK_EVENT_TYPE.CHAIN_ERROR, "run-3", {
                error: "chain failed",
            }),
        )

        expect(client.startedRuns).toHaveLength(1)
        expect(client.failedRuns).toHaveLength(1)
        expect(client.failedRuns[0]?.runId).toBe("ls-run-1")
        expect(client.failedRuns[0]?.error).toBe("chain failed")
    })

    test("retries tracing operations with configured backoff", async () => {
        const client = createTracingClientMock({
            failStartTimes: 1,
        })
        const slept: number[] = []
        const service = new LangSmithTracingService({
            tracer: client,
            maxAttempts: 2,
            retryBackoffMs: 11,
            sleep(delayMs: number): Promise<void> {
                slept.push(delayMs)
                return Promise.resolve()
            },
        })

        await service.handle(createEvent(LANGCHAIN_CALLBACK_EVENT_TYPE.LLM_START, "run-4"))

        expect(client.startedRuns).toHaveLength(1)
        expect(slept).toEqual([11])
    })

    test("deduplicates repeated non-token callback events", async () => {
        const client = createTracingClientMock()
        const service = new LangSmithTracingService({
            tracer: client,
        })
        const event = createEvent(LANGCHAIN_CALLBACK_EVENT_TYPE.CHAIN_START, "run-5")

        await service.handle(event)
        await service.handle(event)

        expect(client.startedRuns).toHaveLength(1)
    })

    test("returns typed errors for invalid payload and options", async () => {
        expect(() =>
            new LangSmithTracingService({
                tracer: createTracingClientMock(),
                maxAttempts: 0,
            }),
        ).toThrow(LangSmithTracingServiceError)

        const service = new LangSmithTracingService({
            tracer: createTracingClientMock(),
        })
        const error = await captureRejectedError(() =>
            service.handle(createEvent(LANGCHAIN_CALLBACK_EVENT_TYPE.CHAIN_START, " ")),
        )

        expect(error).toBeInstanceOf(LangSmithTracingServiceError)
        if (error instanceof LangSmithTracingServiceError) {
            expect(error.code).toBe(LANGSMITH_TRACING_SERVICE_ERROR_CODE.INVALID_RUN_ID)
            expect(error.runId).toBe(" ")
        }
    })
})
