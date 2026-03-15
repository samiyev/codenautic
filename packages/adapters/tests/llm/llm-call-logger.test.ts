import {describe, expect, test} from "bun:test"

import {type ILogger} from "@codenautic/core"

import {
    LLM_CALL_LOG_EVENT_KIND,
    LLM_CALL_LOGGER_ERROR_CODE,
    LlmCallLogger,
    LlmCallLoggerError,
    LANGCHAIN_CALLBACK_EVENT_TYPE,
    type ILangChainCallbackEvent,
} from "../../src/llm"

interface ILogRecord {
    readonly level: "info" | "warn" | "error" | "debug"
    readonly message: string
    readonly context?: Readonly<Record<string, unknown>>
}

interface ILoggerMock extends ILogger {
    readonly records: readonly ILogRecord[]
    readonly callCounts: Readonly<Record<ILogRecord["level"], number>>
}

/**
 * Creates logger mock with optional transient failure plan by level.
 *
 * @param options Failure options.
 * @returns Logger mock.
 */
function createLoggerMock(options: {
    readonly failTimesByLevel?: Partial<Record<ILogRecord["level"], number>>
} = {}): ILoggerMock {
    const records: ILogRecord[] = []
    const callCounts: Record<ILogRecord["level"], number> = {
        info: 0,
        warn: 0,
        error: 0,
        debug: 0,
    }
    const failTimesByLevel = {
        info: options.failTimesByLevel?.info ?? 0,
        warn: options.failTimesByLevel?.warn ?? 0,
        error: options.failTimesByLevel?.error ?? 0,
        debug: options.failTimesByLevel?.debug ?? 0,
    }

    function write(
        level: ILogRecord["level"],
        message: string,
        context?: Readonly<Record<string, unknown>>,
    ): Promise<void> {
        callCounts[level] += 1
        const failTimes = failTimesByLevel[level]
        if (failTimes > 0) {
            failTimesByLevel[level] = failTimes - 1
            return Promise.reject(new Error(`${level} failed`))
        }

        records.push({
            level,
            message,
            context,
        })
        return Promise.resolve()
    }

    const logger: ILoggerMock = {
        get records(): readonly ILogRecord[] {
            return records
        },
        get callCounts(): Readonly<Record<ILogRecord["level"], number>> {
            return callCounts
        },
        info(message: string, context?: Record<string, unknown>): Promise<void> {
            return write("info", message, context)
        },
        warn(message: string, context?: Record<string, unknown>): Promise<void> {
            return write("warn", message, context)
        },
        error(message: string, context?: Record<string, unknown>): Promise<void> {
            return write("error", message, context)
        },
        debug(message: string, context?: Record<string, unknown>): Promise<void> {
            return write("debug", message, context)
        },
        child(_context: Record<string, unknown>): ILogger {
            return logger
        },
    }

    return logger
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
 * Creates callback event fixture.
 *
 * @param type Callback event type.
 * @returns Callback event.
 */
function createCallbackEvent(type: ILangChainCallbackEvent["type"]): ILangChainCallbackEvent {
    return {
        type,
        runId: "run-1",
        name: "review.llm",
        timestamp: "2026-03-15T14:00:00.000Z",
        payload: {
            model: "gpt-review",
        },
    }
}

describe("LlmCallLogger", () => {
    test("writes structured direct call events with proper levels", async () => {
        const logger = createLoggerMock()
        const callLogger = new LlmCallLogger({
            logger,
            now: () => new Date("2026-03-15T14:30:00.000Z"),
        })

        await callLogger.log({
            kind: LLM_CALL_LOG_EVENT_KIND.REQUEST,
            runId: "run-1",
            name: "review.llm",
            payload: {
                model: "gpt-review",
            },
        })
        await callLogger.log({
            kind: LLM_CALL_LOG_EVENT_KIND.RESPONSE,
            runId: "run-1",
            name: "review.llm",
            payload: {
                content: "done",
            },
        })
        await callLogger.log({
            kind: LLM_CALL_LOG_EVENT_KIND.ERROR,
            runId: "run-1",
            name: "review.llm",
            payload: {
                error: "failed",
            },
        })

        expect(logger.records.map((record): string => record.level)).toEqual([
            "info",
            "info",
            "error",
        ])
        expect(logger.records[0]?.context).toMatchObject({
            kind: LLM_CALL_LOG_EVENT_KIND.REQUEST,
            runId: "run-1",
            name: "review.llm",
            loggedAt: "2026-03-15T14:30:00.000Z",
        })
    })

    test("maps LangChain callback events to LLM call logs", async () => {
        const logger = createLoggerMock()
        const callLogger = new LlmCallLogger({
            logger,
        })

        await callLogger.handle(createCallbackEvent(LANGCHAIN_CALLBACK_EVENT_TYPE.CHAIN_START))
        await callLogger.handle(createCallbackEvent(LANGCHAIN_CALLBACK_EVENT_TYPE.LLM_START))
        await callLogger.handle(createCallbackEvent(LANGCHAIN_CALLBACK_EVENT_TYPE.LLM_END))
        await callLogger.handle(createCallbackEvent(LANGCHAIN_CALLBACK_EVENT_TYPE.LLM_ERROR))

        expect(logger.records.map((record): string => record.level)).toEqual([
            "info",
            "info",
            "error",
        ])
        expect(logger.records.map((record): unknown => record.context?.["kind"])).toEqual([
            LLM_CALL_LOG_EVENT_KIND.REQUEST,
            LLM_CALL_LOG_EVENT_KIND.RESPONSE,
            LLM_CALL_LOG_EVENT_KIND.ERROR,
        ])
    })

    test("retries failed logger writes with configured backoff", async () => {
        const logger = createLoggerMock({
            failTimesByLevel: {
                info: 1,
            },
        })
        const slept: number[] = []
        const callLogger = new LlmCallLogger({
            logger,
            maxAttempts: 2,
            retryBackoffMs: 19,
            sleep(delayMs: number): Promise<void> {
                slept.push(delayMs)
                return Promise.resolve()
            },
        })

        await callLogger.log({
            kind: LLM_CALL_LOG_EVENT_KIND.REQUEST,
            runId: "run-2",
            name: "review.retry",
        })

        expect(logger.callCounts.info).toBe(2)
        expect(slept).toEqual([19])
    })

    test("deduplicates idempotent non-token events and keeps token events", async () => {
        const logger = createLoggerMock()
        const callLogger = new LlmCallLogger({
            logger,
        })

        await callLogger.log({
            kind: LLM_CALL_LOG_EVENT_KIND.RESPONSE,
            runId: "run-3",
            name: "review.idempotent",
            payload: {
                content: "ok",
            },
            idempotencyKey: "event-1",
        })
        await callLogger.log({
            kind: LLM_CALL_LOG_EVENT_KIND.RESPONSE,
            runId: "run-3",
            name: "review.idempotent",
            payload: {
                content: "ok",
            },
            idempotencyKey: "event-1",
        })
        await callLogger.log({
            kind: LLM_CALL_LOG_EVENT_KIND.TOKEN,
            runId: "run-3",
            name: "review.idempotent",
            payload: {
                token: "A",
            },
        })
        await callLogger.log({
            kind: LLM_CALL_LOG_EVENT_KIND.TOKEN,
            runId: "run-3",
            name: "review.idempotent",
            payload: {
                token: "A",
            },
        })

        expect(logger.records.map((record): unknown => record.context?.["kind"])).toEqual([
            LLM_CALL_LOG_EVENT_KIND.RESPONSE,
            LLM_CALL_LOG_EVENT_KIND.TOKEN,
            LLM_CALL_LOG_EVENT_KIND.TOKEN,
        ])
    })

    test("returns typed validation errors for invalid logger options and payload", async () => {
        expect(() =>
            new LlmCallLogger({
                logger: {} as ILogger,
            }),
        ).toThrow(LlmCallLoggerError)

        const callLogger = new LlmCallLogger({
            logger: createLoggerMock(),
        })
        const error = await captureRejectedError(() =>
            callLogger.log({
                kind: LLM_CALL_LOG_EVENT_KIND.REQUEST,
                runId: " ",
                name: "review.invalid",
            }),
        )

        expect(error).toBeInstanceOf(LlmCallLoggerError)
        if (error instanceof LlmCallLoggerError) {
            expect(error.code).toBe(LLM_CALL_LOGGER_ERROR_CODE.INVALID_RUN_ID)
            expect(error.runId).toBe(" ")
        }
    })
})
