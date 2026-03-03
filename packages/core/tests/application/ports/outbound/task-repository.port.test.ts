import {describe, expect, test} from "bun:test"

import type {ITaskRepository} from "../../../../src/application/ports/outbound/task-repository.port"
import {TASK_STATUS, type TaskStatus} from "../../../../src/domain/entities/task.entity"
import type {Task} from "../../../../src/domain/entities/task.entity"
import type {UniqueId} from "../../../../src/domain/value-objects/unique-id.value-object"
import {TaskFactory} from "../../../../src/domain/factories/task.factory"

class InMemoryTaskRepository implements ITaskRepository {
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
            [...this.storage.values()].filter((task) => {
            return task.status === status
            }),
        )
    }

    public findByType(type: string): Promise<readonly Task[]> {
        return Promise.resolve(
            [...this.storage.values()].filter((task) => {
                return task.type === type
            }),
        )
    }

    public findStale(olderThan: Date): Promise<readonly Task[]> {
        return Promise.resolve(
            [...this.storage.values()].filter((task) => {
                const updatedAt = this.updatedAt.get(task.id.value)
                if (updatedAt === undefined) {
                    return false
                }

                return updatedAt < olderThan
            }),
        )
    }
}

class StaleTaskStore {
    private readonly storage: Map<string, Task>
    private readonly updatedAt: Map<string, Date>

    public constructor() {
        this.storage = new Map<string, Task>()
        this.updatedAt = new Map<string, Date>()
    }

    public seed(task: Task, updatedAt: Date): void {
        this.storage.set(task.id.value, task)
        this.updatedAt.set(task.id.value, updatedAt)
    }

    public findStale(olderThan: Date): readonly Task[] {
        return [...this.storage.values()].filter((task) => {
            const updatedAt = this.updatedAt.get(task.id.value) ?? new Date()
            return updatedAt < olderThan
        })
    }
}

describe("ITaskRepository contract", () => {
    test("saves task and reads by status", async () => {
        const repository = new InMemoryTaskRepository()
        const taskFactory = new TaskFactory()
        const pendingTask = taskFactory.create({
            type: "pending",
        })
        const runningTask = taskFactory.create({
            type: "running",
        })
        runningTask.start()

        await repository.save(pendingTask)
        await repository.save(runningTask)

        const running = await repository.findByStatus(TASK_STATUS.RUNNING)

        expect(running).toHaveLength(1)
        expect(running[0]?.id.value).toBe(runningTask.id.value)
    })

    test("finds tasks by type", async () => {
        const repository = new InMemoryTaskRepository()
        const taskFactory = new TaskFactory()
        const scanTask = taskFactory.create({
            type: "scan",
        })
        const analyzeTask = taskFactory.create({
            type: "analyze",
        })

        await repository.save(scanTask)
        await repository.save(analyzeTask)

        const scan = await repository.findByType("scan")

        expect(scan).toHaveLength(1)
        expect(scan[0]?.id.value).toBe(scanTask.id.value)
    })

    test("finds stale tasks by update date", async () => {
        const repository = new InMemoryTaskRepository()
        const taskFactory = new TaskFactory()
        const oldTask = taskFactory.create({
            type: "old",
        })
        const freshTask = taskFactory.create({
            type: "fresh",
        })
        const oldDate = new Date("2025-01-01T00:00:00.000Z")
        const freshDate = new Date("2025-03-01T00:00:00.000Z")
        const staleRepo = new StaleTaskStore()

        await repository.save(oldTask)
        await repository.save(freshTask)
        staleRepo.seed(oldTask, oldDate)
        staleRepo.seed(freshTask, freshDate)

        const stale = staleRepo.findStale(new Date("2025-02-01T00:00:00.000Z"))

        expect(stale).toHaveLength(1)
        expect(stale[0]?.id.value).toBe(oldTask.id.value)
    })
})
