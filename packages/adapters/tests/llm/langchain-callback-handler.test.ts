import {describe, expect, test} from "bun:test"

import {
    LANGCHAIN_CALLBACK_EVENT_TYPE,
    LANGCHAIN_CALLBACK_HANDLER_ERROR_CODE,
    LangChainCallbackHandler,
    LangChainCallbackHandlerError,
    type ILangChainCallbackEvent,
    type ILangChainCallbackSink,
} from "../../src/llm"

interface ILangChainCallbackSinkMock extends ILangChainCallbackSink {
    readonly events: readonly ILangChainCallbackEvent[]
}

/**
 * Creates callback sink mock with optional transient failure count.
 *
 * @param options Sink behavior options.
 * @returns Sink mock.
 */
function createSinkMock(options: {
    readonly failTimes?: number
} = {}): ILangChainCallbackSinkMock {
    const events: ILangChainCallbackEvent[] = []
    let failuresLeft = options.failTimes ?? 0

    return {
        get events(): readonly ILangChainCallbackEvent[] {
            return events
        },
        handle(event: ILangChainCallbackEvent): Promise<void> {
            events.push(event)

            if (failuresLeft > 0) {
                failuresLeft -= 1
                return Promise.reject(new Error("sink failed"))
            }

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

describe("LangChainCallbackHandler", () => {
    test("dispatches normalized callback event to configured sinks", async () => {
        const sink = createSinkMock()
        const handler = new LangChainCallbackHandler({
            sinks: [sink],
            now: () => new Date("2026-03-15T12:00:00.000Z"),
        })

        await handler.dispatch({
            type: LANGCHAIN_CALLBACK_EVENT_TYPE.CHAIN_START,
            runId: "run-1",
            name: "review.chain",
            payload: {
                repositoryId: "repo-a",
            },
        })

        expect(sink.events).toHaveLength(1)
        expect(sink.events[0]).toEqual({
            type: LANGCHAIN_CALLBACK_EVENT_TYPE.CHAIN_START,
            runId: "run-1",
            parentRunId: undefined,
            name: "review.chain",
            timestamp: "2026-03-15T12:00:00.000Z",
            payload: {
                repositoryId: "repo-a",
            },
        })
    })

    test("retries sink dispatch with configured backoff", async () => {
        const sink = createSinkMock({
            failTimes: 1,
        })
        const slept: number[] = []
        const handler = new LangChainCallbackHandler({
            sinks: [sink],
            maxAttempts: 2,
            retryBackoffMs: 15,
            sleep(delayMs: number): Promise<void> {
                slept.push(delayMs)
                return Promise.resolve()
            },
        })

        await handler.dispatch({
            type: LANGCHAIN_CALLBACK_EVENT_TYPE.LLM_START,
            runId: "run-2",
            name: "review.llm",
        })

        expect(sink.events).toHaveLength(2)
        expect(slept).toEqual([15])
    })

    test("deduplicates concurrent and repeated idempotent events", async () => {
        const events: ILangChainCallbackEvent[] = []
        let resolveDispatch: (() => void) | undefined
        const sink: ILangChainCallbackSink = {
            handle(event: ILangChainCallbackEvent): Promise<void> {
                events.push(event)
                return new Promise((resolve) => {
                    resolveDispatch = resolve
                })
            },
        }
        const handler = new LangChainCallbackHandler({
            sinks: [sink],
        })

        const firstDispatch = handler.dispatch({
            type: LANGCHAIN_CALLBACK_EVENT_TYPE.LLM_END,
            runId: "run-3",
            name: "review.llm",
            idempotencyKey: "event-1",
        })
        const secondDispatch = handler.dispatch({
            type: LANGCHAIN_CALLBACK_EVENT_TYPE.LLM_END,
            runId: "run-3",
            name: "review.llm",
            idempotencyKey: "event-1",
        })

        if (resolveDispatch === undefined) {
            throw new Error("Expected dispatch promise to be created")
        }
        resolveDispatch()

        await Promise.all([firstDispatch, secondDispatch])
        expect(events).toHaveLength(1)

        await handler.dispatch({
            type: LANGCHAIN_CALLBACK_EVENT_TYPE.LLM_END,
            runId: "run-3",
            name: "review.llm",
            idempotencyKey: "event-1",
        })
        expect(events).toHaveLength(1)
    })

    test("maps convenience methods to normalized events", async () => {
        const sink = createSinkMock()
        const handler = new LangChainCallbackHandler({
            sinks: [sink],
            now: () => new Date("2026-03-15T12:30:00.000Z"),
        })

        await handler.handleChainError({
            runId: "run-4",
            name: "review.chain",
            error: new Error("chain failed"),
        })
        await handler.handleLlmToken({
            runId: "run-4",
            name: "review.llm",
            token: "A",
        })

        expect(sink.events.map((event): string => event.type)).toEqual([
            LANGCHAIN_CALLBACK_EVENT_TYPE.CHAIN_ERROR,
            LANGCHAIN_CALLBACK_EVENT_TYPE.LLM_TOKEN,
        ])
        expect(sink.events[0]?.payload).toEqual({
            error: "chain failed",
        })
        expect(sink.events[1]?.payload).toEqual({
            token: "A",
        })
    })

    test("returns typed validation errors for invalid options and payload", async () => {
        expect(() =>
            new LangChainCallbackHandler({
                sinks: [],
            }),
        ).toThrow(LangChainCallbackHandlerError)

        const handler = new LangChainCallbackHandler({
            sinks: [createSinkMock()],
        })
        const error = await captureRejectedError(() =>
            handler.dispatch({
                type: LANGCHAIN_CALLBACK_EVENT_TYPE.CHAIN_START,
                runId: " ",
                name: "review.chain",
            }),
        )

        expect(error).toBeInstanceOf(LangChainCallbackHandlerError)
        if (error instanceof LangChainCallbackHandlerError) {
            expect(error.code).toBe(LANGCHAIN_CALLBACK_HANDLER_ERROR_CODE.INVALID_RUN_ID)
            expect(error.runId).toBe(" ")
        }
    })
})
