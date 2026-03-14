import {describe, expect, test} from "bun:test"

import type {ConnectionOptions} from "bullmq"

import {
    BULLMQ_WORKER_PREFETCH,
    BullMqWorkerRuntime,
    WORKER_RUNTIME_STATUS,
    type IBullMqWorkerFactoryOptions,
    type IBullMqWorkerInstance,
} from "../../src/worker"

/**
 * Deferred promise helper.
 */
interface IDeferred<T> {
    /**
     * Pending promise.
     */
    readonly promise: Promise<T>

    /**
     * Resolves promise.
     *
     * @param value Resolution value.
     */
    readonly resolve: (value: T | PromiseLike<T>) => void

    /**
     * Rejects promise.
     *
     * @param reason Rejection reason.
     */
    readonly reject: (reason?: unknown) => void
}

/**
 * Worker double with scripted close behavior.
 */
class ScriptedWorker implements IBullMqWorkerInstance {
    public readonly closeCalls: Array<boolean | undefined> = []
    private readonly closeBehavior: (force: boolean | undefined) => Promise<void>

    /**
     * Creates worker double.
     *
     * @param closeBehavior Close behavior callback.
     */
    public constructor(closeBehavior: (force: boolean | undefined) => Promise<void>) {
        this.closeBehavior = closeBehavior
    }

    /**
     * Captures close call and delegates to scripted behavior.
     *
     * @param force Force close flag.
     * @returns Close promise.
     */
    public close(force?: boolean): Promise<void> {
        this.closeCalls.push(force)
        return this.closeBehavior(force)
    }
}

describe("BullMqWorkerRuntime", () => {
    test("uses prefetch=1 and dispatches job payload via resolved processor", async () => {
        const capturedFactoryOptions: IBullMqWorkerFactoryOptions[] = []
        const worker = new ScriptedWorker((): Promise<void> => Promise.resolve())
        const processedPayloads: unknown[] = []
        const runtime = new BullMqWorkerRuntime({
            queueName: "review-jobs",
            connection: createConnectionOptions(),
            resolveProcessor: (jobType: string) => {
                if (jobType === "scan") {
                    return (payload: unknown): Promise<void> => {
                        processedPayloads.push(payload)
                        return Promise.resolve()
                    }
                }

                return undefined
            },
            workerFactory: (options: IBullMqWorkerFactoryOptions): IBullMqWorkerInstance => {
                capturedFactoryOptions.push(options)
                return worker
            },
            now: () => new Date("2026-03-14T10:00:00.000Z"),
        })

        await runtime.start()
        const factoryOptions = capturedFactoryOptions[0]
        if (factoryOptions === undefined) {
            throw new Error("Worker factory options were not captured")
        }

        await factoryOptions.processor({
            id: "job-1",
            name: "scan",
            data: {
                type: "scan",
                payload: {
                    repositoryId: "repo-1",
                },
            },
        })

        expect(factoryOptions.concurrency).toBe(BULLMQ_WORKER_PREFETCH)
        expect(processedPayloads).toEqual([
            {
                repositoryId: "repo-1",
            },
        ])
        expect(runtime.healthCheck()).toEqual({
            queueName: "review-jobs",
            status: WORKER_RUNTIME_STATUS.Running,
            isHealthy: true,
            activeJobs: 0,
            prefetch: BULLMQ_WORKER_PREFETCH,
            gracefulShutdownTimeoutMs: 30_000,
            startedAt: new Date("2026-03-14T10:00:00.000Z"),
            stoppedAt: null,
            lastFailure: null,
        })
    })

    test("marks health as unhealthy when processor is missing for job type", async () => {
        const capturedFactoryOptions: IBullMqWorkerFactoryOptions[] = []
        const runtime = new BullMqWorkerRuntime({
            queueName: "review-jobs",
            connection: createConnectionOptions(),
            resolveProcessor: () => undefined,
            workerFactory: (options: IBullMqWorkerFactoryOptions): IBullMqWorkerInstance => {
                capturedFactoryOptions.push(options)
                return new ScriptedWorker((): Promise<void> => Promise.resolve())
            },
        })

        await runtime.start()
        const factoryOptions = capturedFactoryOptions[0]
        if (factoryOptions === undefined) {
            throw new Error("Worker factory options were not captured")
        }

        await expectPromiseRejectMessage(
            factoryOptions.processor({
                id: "job-2",
                name: "unknown",
                data: {
                    type: "unknown",
                    payload: {
                        id: "x",
                    },
                },
            }),
            'Processor is not registered for job type "unknown"',
        )

        const health = runtime.healthCheck()
        expect(health.status).toBe(WORKER_RUNTIME_STATUS.Running)
        expect(health.isHealthy).toBe(false)
        expect(health.activeJobs).toBe(0)
        expect(health.lastFailure).toBe(
            'Processor is not registered for job type "unknown"',
        )
    })

    test("stops gracefully and updates health state to stopped", async () => {
        const worker = new ScriptedWorker((): Promise<void> => Promise.resolve())
        const runtime = new BullMqWorkerRuntime({
            queueName: "review-jobs",
            connection: createConnectionOptions(),
            resolveProcessor: () => undefined,
            workerFactory: (): IBullMqWorkerInstance => worker,
            now: () => new Date("2026-03-14T10:05:00.000Z"),
        })

        await runtime.start()
        await runtime.stop()

        expect(worker.closeCalls).toEqual([undefined])
        expect(runtime.healthCheck().status).toBe(WORKER_RUNTIME_STATUS.Stopped)
        expect(runtime.healthCheck().stoppedAt).toEqual(
            new Date("2026-03-14T10:05:00.000Z"),
        )
    })

    test("force closes worker when graceful shutdown exceeds timeout", async () => {
        const gracefulCloseDeferred = createDeferred<void>()
        const worker = new ScriptedWorker((force: boolean | undefined): Promise<void> => {
            if (force === true) {
                return Promise.resolve()
            }

            return gracefulCloseDeferred.promise
        })
        const runtime = new BullMqWorkerRuntime({
            queueName: "review-jobs",
            connection: createConnectionOptions(),
            resolveProcessor: () => undefined,
            workerFactory: (): IBullMqWorkerInstance => worker,
            shutdownTimeoutMs: 5,
        })

        await runtime.start()
        await runtime.stop()

        expect(worker.closeCalls).toEqual([
            undefined,
            true,
        ])
        expect(runtime.healthCheck().status).toBe(WORKER_RUNTIME_STATUS.Stopped)
        gracefulCloseDeferred.resolve()
    })

    test("validates runtime options and surfaces factory failures in health state", async () => {
        expect(
            () =>
                new BullMqWorkerRuntime({
                    queueName: " ",
                    connection: createConnectionOptions(),
                    resolveProcessor: () => undefined,
                }),
        ).toThrow("queueName must be a non-empty string")
        expect(
            () =>
                new BullMqWorkerRuntime({
                    queueName: "review-jobs",
                    connection: createConnectionOptions(),
                    resolveProcessor: () => undefined,
                    shutdownTimeoutMs: 0,
                }),
        ).toThrow("shutdownTimeoutMs must be greater than zero")

        const runtime = new BullMqWorkerRuntime({
            queueName: "review-jobs",
            connection: createConnectionOptions(),
            resolveProcessor: () => undefined,
            workerFactory: (): IBullMqWorkerInstance => {
                throw new Error("worker-factory-failed")
            },
        })

        await expectPromiseRejectMessage(
            runtime.start(),
            "worker-factory-failed",
        )
        expect(runtime.healthCheck().status).toBe(WORKER_RUNTIME_STATUS.Degraded)
        expect(runtime.healthCheck().lastFailure).toBe("worker-factory-failed")
    })
})

/**
 * Creates test connection options object.
 *
 * @returns Redis connection options.
 */
function createConnectionOptions(): ConnectionOptions {
    return {
        host: "127.0.0.1",
        port: 6379,
    }
}

/**
 * Creates deferred promise.
 *
 * @returns Deferred helper.
 */
function createDeferred<T>(): IDeferred<T> {
    let resolve!: (value: T | PromiseLike<T>) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((innerResolve, innerReject): void => {
        resolve = innerResolve
        reject = innerReject
    })

    return {
        promise,
        resolve,
        reject,
    }
}

/**
 * Asserts that promise rejects with expected message.
 *
 * @param promise Promise expected to reject.
 * @param message Expected message text.
 */
async function expectPromiseRejectMessage(
    promise: Promise<unknown>,
    message: string,
): Promise<void> {
    try {
        await promise
        throw new Error("Expected promise to reject")
    } catch (error: unknown) {
        if (error instanceof Error) {
            expect(error.message).toBe(message)
            return
        }

        throw error
    }
}
