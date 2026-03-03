import type {Task, TaskStatus} from "../../../domain/entities/task.entity"
import type {IRepository} from "./common/repository.port"

/**
 * Outbound persistence contract for task entities.
 */
export interface ITaskRepository extends IRepository<Task> {
    /**
     * Finds tasks by lifecycle status.
     *
     * @param status Target status.
     * @returns Matching tasks.
     */
    findByStatus(status: TaskStatus): Promise<readonly Task[]>

    /**
     * Finds tasks by task type.
     *
     * @param type Task type.
     * @returns Matching tasks.
     */
    findByType(type: string): Promise<readonly Task[]>

    /**
     * Finds tasks that are considered stale before provided timestamp.
     *
     * @param olderThan Cut-off timestamp.
     * @returns Matching stale tasks.
     */
    findStale(olderThan: Date): Promise<readonly Task[]>
}
