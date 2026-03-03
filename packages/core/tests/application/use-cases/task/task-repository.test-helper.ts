import type {ITaskRepository} from "../../../../src/application/ports/outbound/task-repository.port"
import type {Task, TaskStatus} from "../../../../src/domain/entities/task.entity"
import type {UniqueId} from "../../../../src/domain/value-objects/unique-id.value-object"

/**
 * In-memory task repository for application tests.
 */
export class InMemoryTaskRepository implements ITaskRepository {
    private readonly storage: Map<string, Task>
    private readonly updatedAt: Map<string, Date>

    public constructor() {
        this.storage = new Map<string, Task>()
        this.updatedAt = new Map<string, Date>()
    }

    public findById(id: UniqueId): Promise<Task | null> {
        return Promise.resolve(this.storage.get(id.value) ?? null)
    }

    public save(entity: Task): Promise<void> {
        this.storage.set(entity.id.value, entity)
        this.updatedAt.set(entity.id.value, new Date())
        return Promise.resolve()
    }

    public findByStatus(status: TaskStatus): Promise<readonly Task[]> {
        return Promise.resolve(
            [...this.storage.values()].filter((task: Task) => task.status === status),
        )
    }

    public findByType(type: string): Promise<readonly Task[]> {
        return Promise.resolve(
            [...this.storage.values()].filter((task: Task) => task.type === type),
        )
    }

    public findStale(olderThan: Date): Promise<readonly Task[]> {
        return Promise.resolve(
            [...this.storage.values()].filter((task: Task) => {
                const updatedDate = this.updatedAt.get(task.id.value) ?? new Date()
                return updatedDate <= olderThan
            }),
        )
    }

    public taskCount(): number {
        return this.storage.size
    }
}
