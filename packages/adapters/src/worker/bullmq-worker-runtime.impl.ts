import {Worker, type ConnectionOptions, type Job} from "bullmq"

import {
    WORKER_RUNTIME_STATUS,
    type IWorkerRuntime,
    type IWorkerRuntimeHealth,
    type WorkerRuntimeStatus,
} from "./worker.types"

/**
 * Fixed worker prefetch value required by WORKER-001.
 */
export const BULLMQ_WORKER_PREFETCH = 1

/**
 * Default graceful shutdown timeout in milliseconds.
 */
export const DEFAULT_WORKER_GRACEFUL_SHUTDOWN_TIMEOUT_MS = 30_000

/**
 * Runtime job payload processor.
 */
export type WorkerPayloadProcessor = (payload: unknown) => Promise<void>

/**
 * Supported process signals for worker shutdown.
 */
export type WorkerShutdownSignal = "SIGTERM" | "SIGINT"

/**
 * Default process signals used for graceful shutdown.
 */
export const DEFAULT_WORKER_SHUTDOWN_SIGNALS: readonly WorkerShutdownSignal[] = [
    "SIGTERM",
] as const

/**
 * Process-like signal API used by runtime for testable signal handling.
 */
export interface IWorkerSignalProcess {
    /**
     * Subscribes one signal listener.
     *
     * @param signal Process signal.
     * @param listener Signal callback.
     * @returns Process reference.
     */
    on(signal: WorkerShutdownSignal, listener: () => void): IWorkerSignalProcess

    /**
     * Unsubscribes one signal listener.
     *
     * @param signal Process signal.
     * @param listener Signal callback.
     * @returns Process reference.
     */
    off(signal: WorkerShutdownSignal, listener: () => void): IWorkerSignalProcess
}

/**
 * Callback invoked when signal-driven graceful shutdown fails.
 */
export type WorkerSignalShutdownErrorHandler = (
    error: Error,
    signal: WorkerShutdownSignal,
) => void

/**
 * Processor resolver by logical job type.
 */
export type WorkerProcessorResolver = (
    jobType: string,
) => WorkerPayloadProcessor | undefined

/**
 * Minimal job contract consumed by runtime processor callback.
 */
export interface IBullMqWorkerRuntimeJob {
    /**
     * Stable job id when available.
     */
    readonly id: string | null

    /**
     * BullMQ job name.
     */
    readonly name: string

    /**
     * Raw job data.
     */
    readonly data: unknown
}

/**
 * Minimal BullMQ worker contract used by runtime.
 */
export interface IBullMqWorkerInstance {
    /**
     * Closes worker. When force=true active jobs are interrupted by BullMQ runtime.
     *
     * @param force Force-closes worker without waiting for active jobs.
     */
    close(force?: boolean): Promise<void>
}

/**
 * Factory options for building runtime worker.
 */
export interface IBullMqWorkerFactoryOptions {
    /**
     * Queue name.
     */
    readonly queueName: string

    /**
     * Redis connection options.
     */
    readonly connection: ConnectionOptions

    /**
     * Worker concurrency/prefetch value.
     */
    readonly concurrency: number

    /**
     * Runtime job processor callback.
     */
    readonly processor: (job: IBullMqWorkerRuntimeJob) => Promise<void>
}

/**
 * BullMQ worker factory contract.
 */
export type BullMqWorkerFactory = (
    options: IBullMqWorkerFactoryOptions,
) => IBullMqWorkerInstance

/**
 * Construction options for BullMQ runtime adapter.
 */
export interface IBullMqWorkerRuntimeOptions {
    /**
     * Queue name to consume.
     */
    readonly queueName: string

    /**
     * Redis connection options.
     */
    readonly connection: ConnectionOptions

    /**
     * Processor resolver for logical job type.
     */
    readonly resolveProcessor: WorkerProcessorResolver

    /**
     * Optional graceful shutdown timeout in milliseconds.
     */
    readonly shutdownTimeoutMs?: number

    /**
     * Optional worker factory override used by tests.
     */
    readonly workerFactory?: BullMqWorkerFactory

    /**
     * Optional clock for deterministic tests.
     */
    readonly now?: () => Date

    /**
     * Optional process-like signal API for graceful shutdown wiring.
     */
    readonly signalProcess?: IWorkerSignalProcess

    /**
     * Optional set of process signals triggering graceful shutdown.
     */
    readonly shutdownSignals?: readonly WorkerShutdownSignal[]

    /**
     * Optional callback invoked when signal shutdown fails.
     */
    readonly onSignalShutdownError?: WorkerSignalShutdownErrorHandler
}

/**
 * BullMQ-based worker runtime with fixed prefetch and graceful shutdown guard.
 */
export class BullMqWorkerRuntime implements IWorkerRuntime {
    private readonly queueName: string
    private readonly connection: ConnectionOptions
    private readonly resolveProcessor: WorkerProcessorResolver
    private readonly shutdownTimeoutMs: number
    private readonly workerFactory: BullMqWorkerFactory
    private readonly now: () => Date
    private readonly signalProcess: IWorkerSignalProcess
    private readonly shutdownSignals: readonly WorkerShutdownSignal[]
    private readonly onSignalShutdownError: WorkerSignalShutdownErrorHandler
    private worker: IBullMqWorkerInstance | null = null
    private activeJobs = 0
    private status: WorkerRuntimeStatus = WORKER_RUNTIME_STATUS.Idle
    private startedAt: Date | null = null
    private stoppedAt: Date | null = null
    private lastFailure: string | null = null
    private readonly signalHandlers = new Map<WorkerShutdownSignal, () => void>()

    /**
     * Creates runtime instance.
     *
     * @param options Runtime dependencies and settings.
     */
    public constructor(options: IBullMqWorkerRuntimeOptions) {
        this.queueName = normalizeQueueName(options.queueName)
        this.connection = options.connection
        this.resolveProcessor = options.resolveProcessor
        this.shutdownTimeoutMs = normalizePositiveInteger(
            options.shutdownTimeoutMs ?? DEFAULT_WORKER_GRACEFUL_SHUTDOWN_TIMEOUT_MS,
            "shutdownTimeoutMs",
        )
        this.workerFactory = options.workerFactory ?? defaultBullMqWorkerFactory
        this.now = options.now ?? defaultNow
        this.signalProcess = options.signalProcess ?? defaultSignalProcess
        this.shutdownSignals = normalizeShutdownSignals(
            options.shutdownSignals ?? DEFAULT_WORKER_SHUTDOWN_SIGNALS,
        )
        this.onSignalShutdownError =
            options.onSignalShutdownError ?? defaultSignalShutdownErrorHandler
    }

    /**
     * Starts worker runtime. Repeated starts are idempotent.
     */
    public start(): Promise<void> {
        if (this.worker !== null) {
            return Promise.resolve()
        }

        try {
            this.worker = this.workerFactory({
                queueName: this.queueName,
                connection: this.connection,
                concurrency: BULLMQ_WORKER_PREFETCH,
                processor: async (job: IBullMqWorkerRuntimeJob): Promise<void> => {
                    await this.processJob(job)
                },
            })
            this.status = WORKER_RUNTIME_STATUS.Running
            this.startedAt = this.now()
            this.stoppedAt = null
            this.lastFailure = null
            this.registerShutdownHandlers()
        } catch (error: unknown) {
            this.status = WORKER_RUNTIME_STATUS.Degraded
            this.lastFailure = toErrorMessage(error)
            return Promise.reject(toError(error))
        }

        return Promise.resolve()
    }

    /**
     * Stops worker runtime. Waits for graceful close and force-closes on timeout.
     */
    public async stop(): Promise<void> {
        this.unregisterShutdownHandlers()
        if (this.worker === null) {
            this.status = WORKER_RUNTIME_STATUS.Stopped
            this.stoppedAt = this.now()
            return
        }

        const runtimeWorker = this.worker
        this.status = WORKER_RUNTIME_STATUS.Stopping
        try {
            const closeResult = await closeWorkerWithTimeout(
                runtimeWorker,
                this.shutdownTimeoutMs,
            )
            if (closeResult === "timeout") {
                await runtimeWorker.close(true)
            }

            this.worker = null
            this.status = WORKER_RUNTIME_STATUS.Stopped
            this.stoppedAt = this.now()
        } catch (error: unknown) {
            this.worker = null
            this.status = WORKER_RUNTIME_STATUS.Degraded
            this.lastFailure = toErrorMessage(error)
            throw toError(error)
        }
    }

    /**
     * Returns runtime health snapshot.
     *
     * @returns Health data.
     */
    public healthCheck(): IWorkerRuntimeHealth {
        return {
            queueName: this.queueName,
            status: this.status,
            isHealthy:
                this.status === WORKER_RUNTIME_STATUS.Running &&
                this.lastFailure === null,
            activeJobs: this.activeJobs,
            prefetch: BULLMQ_WORKER_PREFETCH,
            gracefulShutdownTimeoutMs: this.shutdownTimeoutMs,
            startedAt: this.startedAt,
            stoppedAt: this.stoppedAt,
            lastFailure: this.lastFailure,
        }
    }

    /**
     * Executes one job by resolving processor from payload type.
     *
     * @param job Runtime job.
     */
    private async processJob(job: IBullMqWorkerRuntimeJob): Promise<void> {
        this.activeJobs += 1
        try {
            const normalizedPayload = normalizeRuntimeJobPayload(job.data)
            const processor = this.resolveProcessor(normalizedPayload.type)
            if (processor === undefined) {
                throw new Error(
                    `Processor is not registered for job type "${normalizedPayload.type}"`,
                )
            }

            await processor(normalizedPayload.payload)
        } catch (error: unknown) {
            this.lastFailure = toErrorMessage(error)
            throw toError(error)
        } finally {
            this.activeJobs = Math.max(0, this.activeJobs - 1)
        }
    }

    /**
     * Registers process signal handlers for graceful shutdown.
     */
    private registerShutdownHandlers(): void {
        if (this.signalHandlers.size > 0) {
            return
        }

        for (const signal of this.shutdownSignals) {
            const handler = (): void => {
                this.handleShutdownSignal(signal)
            }
            this.signalHandlers.set(signal, handler)
            this.signalProcess.on(signal, handler)
        }
    }

    /**
     * Unregisters previously attached process signal handlers.
     */
    private unregisterShutdownHandlers(): void {
        for (const [signal, handler] of this.signalHandlers.entries()) {
            this.signalProcess.off(signal, handler)
        }

        this.signalHandlers.clear()
    }

    /**
     * Handles one process signal by initiating graceful shutdown.
     *
     * @param signal Received process signal.
     */
    private handleShutdownSignal(signal: WorkerShutdownSignal): void {
        if (
            this.status === WORKER_RUNTIME_STATUS.Stopping ||
            this.status === WORKER_RUNTIME_STATUS.Stopped
        ) {
            return
        }

        void this.stop().catch((error: unknown): void => {
            const normalizedError = toError(error)
            this.status = WORKER_RUNTIME_STATUS.Degraded
            this.lastFailure = normalizedError.message
            this.onSignalShutdownError(normalizedError, signal)
        })
    }
}

/**
 * Worker close timeout result.
 */
type WorkerCloseResult = "closed" | "timeout"

/**
 * Closes worker gracefully with timeout fallback.
 *
 * @param worker Worker instance.
 * @param timeoutMs Graceful timeout.
 * @returns Close result.
 */
async function closeWorkerWithTimeout(
    worker: IBullMqWorkerInstance,
    timeoutMs: number,
): Promise<WorkerCloseResult> {
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null
    const timeoutPromise: Promise<{readonly kind: "timeout"}> = new Promise(
        (resolve): void => {
            timeoutHandle = setTimeout((): void => {
                resolve({kind: "timeout"})
            }, timeoutMs)
        },
    )
    const closePromise: Promise<
        | {readonly kind: "closed"}
        | {readonly kind: "failed"; readonly error: unknown}
    > = worker.close().then(
        (): {readonly kind: "closed"} => ({kind: "closed"}),
        (error: unknown): {readonly kind: "failed"; readonly error: unknown} => ({
            kind: "failed",
            error,
        }),
    )

    const closeOutcome = await Promise.race([closePromise, timeoutPromise])
    if (timeoutHandle !== null) {
        clearTimeout(timeoutHandle)
    }

    if (closeOutcome.kind === "failed") {
        throw toError(closeOutcome.error)
    }

    return closeOutcome.kind
}

/**
 * Creates default BullMQ worker instance.
 *
 * @param options Factory options.
 * @returns Worker instance.
 */
function defaultBullMqWorkerFactory(
    options: IBullMqWorkerFactoryOptions,
): IBullMqWorkerInstance {
    const worker = new Worker<unknown>(
        options.queueName,
        async (job: Job<unknown>): Promise<void> => {
            await options.processor({
                id: resolveJobId(job.id),
                name: job.name,
                data: job.data,
            })
        },
        {
            connection: options.connection,
            concurrency: options.concurrency,
        },
    )

    return {
        close(force?: boolean): Promise<void> {
            return worker.close(force)
        },
    }
}

/**
 * Normalizes runtime job payload from queue data.
 *
 * @param value Raw queue payload.
 * @returns Normalized payload.
 */
function normalizeRuntimeJobPayload(value: unknown): {
    readonly type: string
    readonly payload: unknown
} {
    if (isRecord(value) === false) {
        throw new Error("Job payload must be an object with type and payload fields")
    }

    const rawType = value.type
    if (typeof rawType !== "string" || rawType.trim().length === 0) {
        throw new Error("Job payload type must be a non-empty string")
    }

    return {
        type: rawType.trim(),
        payload: value.payload,
    }
}

/**
 * Validates queue name.
 *
 * @param queueName Raw queue name.
 * @returns Normalized queue name.
 */
function normalizeQueueName(queueName: string): string {
    if (queueName.trim().length === 0) {
        throw new Error("queueName must be a non-empty string")
    }

    return queueName.trim()
}

/**
 * Validates positive integer numeric option.
 *
 * @param value Raw number.
 * @param fieldName Field name.
 * @returns Normalized integer.
 */
function normalizePositiveInteger(value: number, fieldName: string): number {
    if (Number.isFinite(value) === false || Number.isNaN(value)) {
        throw new Error(`${fieldName} must be finite number`)
    }

    const normalized = Math.trunc(value)
    if (normalized < 1) {
        throw new Error(`${fieldName} must be greater than zero`)
    }

    return normalized
}

/**
 * Resolves string job id.
 *
 * @param id Raw BullMQ job id.
 * @returns String id or null.
 */
function resolveJobId(id: string | number | undefined): string | null {
    if (id === undefined) {
        return null
    }

    return `${id}`
}

/**
 * Type guard for plain object records.
 *
 * @param value Unknown value.
 * @returns True when value is object record.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && Array.isArray(value) === false
}

/**
 * Returns current timestamp.
 *
 * @returns Current date.
 */
function defaultNow(): Date {
    return new Date()
}

/**
 * Default process-like object used for signal subscriptions.
 */
const defaultSignalProcess: IWorkerSignalProcess = process

/**
 * Validates and normalizes shutdown signals list.
 *
 * @param signals Raw signals.
 * @returns Normalized unique signals preserving order.
 */
function normalizeShutdownSignals(
    signals: readonly WorkerShutdownSignal[],
): readonly WorkerShutdownSignal[] {
    if (signals.length === 0) {
        throw new Error("shutdownSignals must contain at least one signal")
    }

    const normalized: WorkerShutdownSignal[] = []
    for (const signal of signals) {
        if (signal !== "SIGTERM" && signal !== "SIGINT") {
            throw new Error("shutdownSignals contains unsupported signal")
        }
        if (normalized.includes(signal) === false) {
            normalized.push(signal)
        }
    }

    return normalized
}

/**
 * Default no-op shutdown error callback.
 *
 * @param error Shutdown error.
 * @param signal Received signal.
 */
function defaultSignalShutdownErrorHandler(
    error: Error,
    signal: WorkerShutdownSignal,
): void {
    void error
    void signal
}

/**
 * Normalizes unknown error to Error instance.
 *
 * @param value Unknown error value.
 * @returns Error instance.
 */
function toError(value: unknown): Error {
    if (value instanceof Error) {
        return value
    }

    if (typeof value === "string" && value.length > 0) {
        return new Error(value)
    }

    return new Error("Unknown runtime error")
}

/**
 * Resolves error message from unknown value.
 *
 * @param value Unknown value.
 * @returns Error message string.
 */
function toErrorMessage(value: unknown): string {
    return toError(value).message
}
