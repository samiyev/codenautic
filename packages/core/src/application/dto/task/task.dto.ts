import type {Task, TaskStatus} from "../../../domain/entities/task.entity"

/**
 * Transport shape for async task payloads.
 */
export interface ITaskDTO {
    /**
     * Unique task identifier.
     */
    readonly id: string

    /**
     * Task type.
     */
    readonly type: string

    /**
     * Current task status.
     */
    readonly status: TaskStatus

    /**
     * Progress in percent.
     */
    readonly progress: number

    /**
     * Task metadata.
     */
    readonly metadata: Record<string, unknown>

    /**
     * Optional execution result.
     */
    readonly result?: unknown

    /**
     * Optional execution error.
     */
    readonly error?: unknown
}

/**
 * Maps task entity into API/use-case DTO.
 *
 * @param task Task entity.
 * @returns DTO representation.
 */
export const mapTaskToDTO = (task: Task): ITaskDTO => {
    return {
        id: task.id.value,
        type: task.type,
        status: task.status,
        progress: task.progress,
        metadata: task.metadata,
        result: task.result,
        error: task.error,
    }
}
