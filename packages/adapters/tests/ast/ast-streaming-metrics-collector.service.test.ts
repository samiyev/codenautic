import {describe, expect, test} from "bun:test"

import type {ILogger} from "@codenautic/core"

import {
    AST_STREAMING_METRICS_COLLECTOR_ERROR_CODE,
    AstStreamingMetricsCollectorError,
    AstStreamingMetricsCollectorService,
} from "../../src/ast"

interface IDeferred<TValue> {
    readonly promise: Promise<TValue>
    resolve(value: TValue): void
    reject(reason?: unknown): void
}

interface ILogCall {
    readonly message: string
    readonly context: Record<string, unknown> | undefined
}

interface ILoggerTestDouble extends ILogger {
    readonly infoCalls: readonly ILogCall[]
}

/**
 * Creates deferred promise fixture.
 *
 * @returns Deferred fixture.
 */
function createDeferred<TValue>(): IDeferred<TValue> {
    let resolve: ((value: TValue) => void) | undefined
    let reject: ((reason?: unknown) => void) | undefined

    const promise = new Promise<TValue>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise
        reject = rejectPromise
    })

    return {
        promise,
        resolve(value: TValue): void {
            if (resolve !== undefined) {
                resolve(value)
            }
        },
        reject(reason?: unknown): void {
            if (reject !== undefined) {
                reject(reason)
            }
        },
    }
}

/**
 * Creates logger test double with configurable info handler.
 *
 * @param infoHandler Optional info override.
 * @returns Logger test double.
 */
function createLoggerTestDouble(
    infoHandler?: (message: string, context?: Record<string, unknown>) => Promise<void>,
): ILoggerTestDouble {
    const infoCalls: ILogCall[] = []

    const logger: ILoggerTestDouble = {
        infoCalls,
        async info(message: string, context?: Record<string, unknown>): Promise<void> {
            infoCalls.push({
                message,
                context,
            })

            if (infoHandler !== undefined) {
                await infoHandler(message, context)
            }
        },
        async warn(): Promise<void> {
            return Promise.resolve()
        },
        async error(): Promise<void> {
            return Promise.resolve()
        },
        async debug(): Promise<void> {
            return Promise.resolve()
        },
        child(): ILogger {
            return logger
        },
    }

    return logger
}

/**
 * Asserts typed streaming-metrics-collector error for sync action.
 *
 * @param callback Action expected to throw.
 * @param code Expected error code.
 */
function expectAstStreamingMetricsCollectorError(
    callback: () => unknown,
    code:
        (typeof AST_STREAMING_METRICS_COLLECTOR_ERROR_CODE)[keyof typeof AST_STREAMING_METRICS_COLLECTOR_ERROR_CODE],
): void {
    try {
        callback()
    } catch (error) {
        expect(error).toBeInstanceOf(AstStreamingMetricsCollectorError)

        if (error instanceof AstStreamingMetricsCollectorError) {
            expect(error.code).toBe(code)
            return
        }
    }

    throw new Error("Expected AstStreamingMetricsCollectorError to be thrown")
}

/**
 * Asserts typed streaming-metrics-collector error for async action.
 *
 * @param callback Async action expected to reject.
 * @param code Expected error code.
 * @returns Promise resolved when assertion passes.
 */
async function expectAstStreamingMetricsCollectorErrorAsync(
    callback: () => Promise<unknown>,
    code:
        (typeof AST_STREAMING_METRICS_COLLECTOR_ERROR_CODE)[keyof typeof AST_STREAMING_METRICS_COLLECTOR_ERROR_CODE],
): Promise<void> {
    try {
        await callback()
    } catch (error) {
        expect(error).toBeInstanceOf(AstStreamingMetricsCollectorError)

        if (error instanceof AstStreamingMetricsCollectorError) {
            expect(error.code).toBe(code)
            return
        }
    }

    throw new Error("Expected AstStreamingMetricsCollectorError to be thrown")
}

describe("AstStreamingMetricsCollectorService", () => {
    test("tracks files processed and average processing time", async () => {
        const service = new AstStreamingMetricsCollectorService({
            logEveryBatches: 10,
        })

        await service.recordBatch({
            filesProcessed: 3,
            batchDurationMs: 90,
        })
        const snapshot = await service.recordBatch({
            filesProcessed: 1,
            batchDurationMs: 30,
        })

        expect(snapshot.batchCount).toBe(2)
        expect(snapshot.filesProcessed).toBe(4)
        expect(snapshot.totalProcessingTimeMs).toBe(120)
        expect(snapshot.avgProcessingTimeMs).toBe(30)
        expect(snapshot.logCount).toBe(0)
    })

    test("logs checkpoint every configured five batches", async () => {
        const logger = createLoggerTestDouble()
        const service = new AstStreamingMetricsCollectorService({
            logger,
            logEveryBatches: 5,
            now: () => 1_700_000_000_000,
        })

        for (let index = 0; index < 5; index += 1) {
            await service.recordBatch({
                filesProcessed: 2,
                batchDurationMs: 10,
            })
        }

        const snapshot = service.getSnapshot()
        expect(snapshot.batchCount).toBe(5)
        expect(snapshot.filesProcessed).toBe(10)
        expect(snapshot.logCount).toBe(1)
        expect(snapshot.lastCheckpoint?.batchCount).toBe(5)
        expect(logger.infoCalls).toHaveLength(1)

        const firstLogCall = logger.infoCalls[0]
        expect(firstLogCall?.message).toBe("AST streaming metrics checkpoint")
        expect(firstLogCall?.context?.["batchCount"]).toBe(5)
    })

    test("deduplicates in-flight and completed records by idempotency key", async () => {
        const gate = createDeferred<void>()
        const logger = createLoggerTestDouble(async () => gate.promise)
        const service = new AstStreamingMetricsCollectorService({
            logger,
            logEveryBatches: 1,
        })

        const firstRecord = service.recordBatch({
            filesProcessed: 2,
            batchDurationMs: 20,
            idempotencyKey: "same-key",
        })
        const duplicatedInFlightRecord = service.recordBatch({
            filesProcessed: 99,
            batchDurationMs: 999,
            idempotencyKey: "same-key",
        })

        expect(firstRecord).toBe(duplicatedInFlightRecord)

        gate.resolve(undefined)
        const resolvedSnapshot = await firstRecord
        expect(resolvedSnapshot.batchCount).toBe(1)
        expect(resolvedSnapshot.filesProcessed).toBe(2)
        expect(logger.infoCalls).toHaveLength(1)

        const completedDuplicateSnapshot = await service.recordBatch({
            filesProcessed: 50,
            batchDurationMs: 500,
            idempotencyKey: "same-key",
        })

        expect(completedDuplicateSnapshot.batchCount).toBe(1)
        expect(completedDuplicateSnapshot.filesProcessed).toBe(2)
        expect(logger.infoCalls).toHaveLength(1)
    })

    test("retries logger failures with exponential backoff", async () => {
        const backoffDurations: number[] = []
        let attempt = 0
        const logger = createLoggerTestDouble(async () => {
            attempt += 1

            if (attempt < 3) {
                return Promise.reject(new Error("temporary logger outage"))
            }
        })
        const service = new AstStreamingMetricsCollectorService({
            logger,
            logEveryBatches: 1,
            sleep: (durationMs) => {
                backoffDurations.push(durationMs)
                return Promise.resolve()
            },
        })

        const snapshot = await service.recordBatch({
            filesProcessed: 1,
            batchDurationMs: 10,
            retryPolicy: {
                maxAttempts: 3,
                initialBackoffMs: 5,
                maxBackoffMs: 10,
            },
        })

        expect(snapshot.batchCount).toBe(1)
        expect(snapshot.logCount).toBe(1)
        expect(attempt).toBe(3)
        expect(backoffDurations).toEqual([5, 10])
    })

    test("throws typed errors for invalid options input and logging failure", async () => {
        expectAstStreamingMetricsCollectorError(
            () => {
                void new AstStreamingMetricsCollectorService({
                    logEveryBatches: 0,
                })
            },
            AST_STREAMING_METRICS_COLLECTOR_ERROR_CODE.INVALID_LOG_EVERY_BATCHES,
        )

        expectAstStreamingMetricsCollectorError(
            () => {
                void new AstStreamingMetricsCollectorService({
                    logger: {
                        info: async () => Promise.resolve(),
                    } as never,
                })
            },
            AST_STREAMING_METRICS_COLLECTOR_ERROR_CODE.INVALID_LOGGER,
        )

        const service = new AstStreamingMetricsCollectorService({
            logEveryBatches: 1,
            logger: createLoggerTestDouble(async () => Promise.reject(new Error("down"))),
            sleep: () => Promise.resolve(),
        })

        await expectAstStreamingMetricsCollectorErrorAsync(
            async () =>
                service.recordBatch({
                    filesProcessed: -1,
                    batchDurationMs: 10,
                }),
            AST_STREAMING_METRICS_COLLECTOR_ERROR_CODE.INVALID_FILES_PROCESSED,
        )

        await expectAstStreamingMetricsCollectorErrorAsync(
            async () =>
                service.recordBatch({
                    filesProcessed: 1,
                    batchDurationMs: 10,
                    retryPolicy: {
                        maxAttempts: 2,
                        initialBackoffMs: 1,
                        maxBackoffMs: 1,
                    },
                }),
            AST_STREAMING_METRICS_COLLECTOR_ERROR_CODE.LOGGING_FAILED,
        )

        expect(service.getSnapshot().batchCount).toBe(0)
    })
})
