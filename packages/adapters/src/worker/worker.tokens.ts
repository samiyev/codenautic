import {createToken} from "@codenautic/core"

import type {
    IWorkerProcessorRegistry,
    IWorkerQueueService,
    IWorkerRuntime,
} from "./worker.types"

/**
 * DI tokens for worker adapter domain.
 */
export const WORKER_TOKENS = {
    ProcessorRegistry: createToken<IWorkerProcessorRegistry>(
        "adapters.worker.processor-registry",
    ),
    QueueService: createToken<IWorkerQueueService>("adapters.worker.queue-service"),
    Runtime: createToken<IWorkerRuntime>("adapters.worker.runtime"),
} as const

