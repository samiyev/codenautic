import type {IWorkerProcessorRegistry, WorkerProcessor} from "./worker.types"

/**
 * Options for worker processor registry.
 */
export interface IWorkerProcessorRegistryOptions {
    /**
     * Enables overriding previously registered processors.
     */
    readonly allowOverwrite?: boolean
}

/**
 * In-memory worker processor registry.
 */
export class WorkerProcessorRegistry implements IWorkerProcessorRegistry {
    private readonly processorsByType: Map<string, WorkerProcessor> = new Map()
    private readonly allowOverwrite: boolean

    /**
     * Creates registry instance.
     *
     * @param options Registry options.
     */
    public constructor(options: IWorkerProcessorRegistryOptions = {}) {
        this.allowOverwrite = options.allowOverwrite ?? false
    }

    /**
     * Registers processor for one job type.
     *
     * @param jobType Job type name.
     * @param processor Processor callback.
     */
    public register(jobType: string, processor: WorkerProcessor): void {
        const normalizedJobType = normalizeJobType(jobType)
        const alreadyRegistered = this.processorsByType.has(normalizedJobType)
        if (alreadyRegistered && this.allowOverwrite === false) {
            throw new Error(`Processor is already registered for job type "${normalizedJobType}"`)
        }

        this.processorsByType.set(normalizedJobType, processor)
    }

    /**
     * Resolves processor by job type.
     *
     * @param jobType Job type name.
     * @returns Processor callback or undefined.
     */
    public get(jobType: string): WorkerProcessor | undefined {
        const normalizedJobType = normalizeJobType(jobType)
        return this.processorsByType.get(normalizedJobType)
    }
}

/**
 * Validates and normalizes job type.
 *
 * @param value Raw job type.
 * @returns Trimmed job type.
 */
function normalizeJobType(value: string): string {
    if (value.trim().length === 0) {
        throw new Error("jobType must be a non-empty string")
    }

    return value.trim()
}
