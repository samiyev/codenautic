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
}

