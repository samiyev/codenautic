/**
 * Normalized worker queue payload.
 */
export interface IWorkerJobPayload {
    /**
     * Logical job type identifier.
     */
    readonly type: string

    /**
     * Unvalidated job payload.
     */
    readonly payload: unknown

    /**
     * Optional queue priority (higher means sooner).
     */
    readonly priority?: number
}

/**
 * Runtime lifecycle statuses for worker adapter.
 */
export const WORKER_RUNTIME_STATUS = {
    Idle: "IDLE",
    Running: "RUNNING",
    Stopping: "STOPPING",
    Stopped: "STOPPED",
    Degraded: "DEGRADED",
} as const

/**
 * Worker runtime lifecycle status.
 */
export type WorkerRuntimeStatus =
    (typeof WORKER_RUNTIME_STATUS)[keyof typeof WORKER_RUNTIME_STATUS]

/**
 * Health snapshot for worker runtime.
 */
export interface IWorkerRuntimeHealth {
    /**
     * Queue name served by this runtime.
     */
    readonly queueName: string

    /**
     * Current runtime lifecycle state.
     */
    readonly status: WorkerRuntimeStatus

    /**
     * True when runtime is healthy and currently consuming jobs.
     */
    readonly isHealthy: boolean

    /**
     * Number of currently active jobs.
     */
    readonly activeJobs: number

    /**
     * Worker prefetch/concurrency value.
     */
    readonly prefetch: number

    /**
     * Graceful shutdown timeout in milliseconds.
     */
    readonly gracefulShutdownTimeoutMs: number

    /**
     * Runtime start timestamp.
     */
    readonly startedAt: Date | null

    /**
     * Runtime stop timestamp.
     */
    readonly stoppedAt: Date | null

    /**
     * Last failure message captured by runtime.
     */
    readonly lastFailure: string | null
}

/**
 * Queue service contract used by worker adapters.
 */
export interface IWorkerQueueService {
    /**
     * Enqueues one worker job.
     *
     * @param payload Job payload.
     * @returns Stable queue job identifier.
     */
    enqueue(payload: IWorkerJobPayload): Promise<string>
}

/**
 * Processor registry contract used by worker adapters.
 */
export interface IWorkerProcessorRegistry {
    /**
     * Registers one processor callback for job type.
     *
     * @param jobType Logical job type.
     * @param processor Processor callback.
     */
    register(jobType: string, processor: (payload: unknown) => Promise<void>): void
}

/**
 * Worker runtime contract used by infrastructure adapters.
 */
export interface IWorkerRuntime {
    /**
     * Starts job-consumer runtime loop.
     */
    start(): Promise<void>

    /**
     * Stops runtime gracefully.
     */
    stop(): Promise<void>

    /**
     * Returns current runtime health snapshot.
     */
    healthCheck(): IWorkerRuntimeHealth
}
