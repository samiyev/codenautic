import {describe, expect, test} from "bun:test"

import {TASK_STATUS, type Task} from "../../../../src/domain/entities/task.entity"
import {ValidationError} from "../../../../src/domain/errors/validation.error"
import {
    CreateTaskUseCase,
    type ICreateTaskInput,
} from "../../../../src/application/use-cases/task/create-task.use-case"
import {
    UpdateTaskProgressUseCase,
    type IUpdateTaskProgressInput,
} from "../../../../src/application/use-cases/task/update-task-progress.use-case"
import {
    CompleteTaskUseCase,
    type ICompleteTaskInput,
} from "../../../../src/application/use-cases/task/complete-task.use-case"
import {
    FailTaskUseCase,
    type IFailTaskInput,
} from "../../../../src/application/use-cases/task/fail-task.use-case"
import {
    GetTaskStatusUseCase,
    type IGetTaskStatusInput,
} from "../../../../src/application/use-cases/task/get-task-status.use-case"
import {InMemoryTaskRepository} from "./task-repository.test-helper"
import {TaskFactory} from "../../../../src/domain/factories/task.factory"

type TaskCreator = (factory: TaskFactory) => Task

const createPendingTask: TaskCreator = (factory: TaskFactory): Task => {
    return factory.create({
        type: "pending-task",
    })
}

const createRunningTask: TaskCreator = (factory: TaskFactory): Task => {
    const task = factory.create({
        type: "scan",
    })
    task.start()
    return task
}

describe("Task use cases", () => {
    test("creates task with normalized input", async () => {
        const repository = new InMemoryTaskRepository()
        const taskFactory = new TaskFactory()
        const useCase = new CreateTaskUseCase({
            taskFactory,
            taskRepository: repository,
        })
        const input: ICreateTaskInput = {
            type: "  scan-repo  ",
            metadata: {
                owner: "agent",
            },
        }

        const result = await useCase.execute(input)

        expect(result.isOk).toBe(true)
        expect(repository.taskCount()).toBe(1)
        if (result.isFail) {
            throw new Error("Expected success")
        }

        expect(result.value.task.type).toBe("scan-repo")
        expect(result.value.task.status).toBe(TASK_STATUS.PENDING)
        expect(result.value.task.progress).toBe(0)
    })

    test("fails create task for invalid input", async () => {
        const repository = new InMemoryTaskRepository()
        const taskFactory = new TaskFactory()
        const useCase = new CreateTaskUseCase({
            taskFactory,
            taskRepository: repository,
        })
        const result = await useCase.execute({
            type: "",
            metadata: null as unknown as Record<string, unknown>,
        })

        expect(result.isFail).toBe(true)
        expect(result.error.code).toBe("VALIDATION_ERROR")
        if (result.isOk) {
            throw new Error("Expected failure")
        }

        expect(result.error).toBeInstanceOf(ValidationError)
    })

    test("updates running task progress", async () => {
        const repository = new InMemoryTaskRepository()
        const taskFactory = new TaskFactory()
        const task = createRunningTask(taskFactory)
        await repository.save(task)
        const useCase = new UpdateTaskProgressUseCase({
            taskRepository: repository,
        })
        const input: IUpdateTaskProgressInput = {
            taskId: task.id.value,
            progress: 55,
        }
        const result = await useCase.execute(input)

        expect(result.isOk).toBe(true)
        expect(repository.taskCount()).toBe(1)
        if (result.isFail) {
            throw new Error("Expected success")
        }

        expect(result.value.task.progress).toBe(55)
        expect(result.value.task.status).toBe(TASK_STATUS.RUNNING)
    })

    test("fails updating progress when task is not running", async () => {
        const repository = new InMemoryTaskRepository()
        const taskFactory = new TaskFactory()
        const task = taskFactory.create({
            type: "pending-task",
        })
        await repository.save(task)
        const useCase = new UpdateTaskProgressUseCase({
            taskRepository: repository,
        })
        const result = await useCase.execute({
            taskId: task.id.value,
            progress: 20,
        })

        expect(result.isFail).toBe(true)
        expect(result.error.code).toBe("VALIDATION_ERROR")
        if (result.isOk) {
            throw new Error("Expected failure")
        }
    })

    test("completes task", async () => {
        const repository = new InMemoryTaskRepository()
        const taskFactory = new TaskFactory()
        const task = createRunningTask(taskFactory)
        await repository.save(task)
        const useCase = new CompleteTaskUseCase({
            taskRepository: repository,
        })
        const input: ICompleteTaskInput = {
            taskId: task.id.value,
            result: {
                checksum: "ok",
            },
        }
        const result = await useCase.execute(input)

        expect(result.isOk).toBe(true)
        if (result.isFail) {
            throw new Error("Expected success")
        }

        expect(result.value.task.status).toBe(TASK_STATUS.COMPLETED)
        expect(result.value.task.progress).toBe(100)
        expect(result.value.task.result).toEqual({
            checksum: "ok",
        })
    })

    test("fails task", async () => {
        const repository = new InMemoryTaskRepository()
        const taskFactory = new TaskFactory()
        const task = createRunningTask(taskFactory)
        await repository.save(task)
        const useCase = new FailTaskUseCase({
            taskRepository: repository,
        })
        const input: IFailTaskInput = {
            taskId: task.id.value,
            reason: {
                message: "boom",
            },
        }
        const result = await useCase.execute(input)

        expect(result.isOk).toBe(true)
        if (result.isFail) {
            throw new Error("Expected success")
        }

        expect(result.value.task.status).toBe(TASK_STATUS.FAILED)
        expect(result.value.task.error).toEqual({
            message: "boom",
        })
    })

    test("gets task status", async () => {
        const repository = new InMemoryTaskRepository()
        const taskFactory = new TaskFactory()
        const task = createPendingTask(taskFactory)
        await repository.save(task)
        const useCase = new GetTaskStatusUseCase({
            taskRepository: repository,
        })
        const input: IGetTaskStatusInput = {
            taskId: task.id.value,
        }
        const result = await useCase.execute(input)

        expect(result.isOk).toBe(true)
        if (result.isFail) {
            throw new Error("Expected success")
        }

        expect(result.value.task.id).toBe(task.id.value)
        expect(result.value.task.status).toBe(TASK_STATUS.PENDING)
    })

    test("returns not found for missing task", async () => {
        const repository = new InMemoryTaskRepository()
        const useCase = new GetTaskStatusUseCase({
            taskRepository: repository,
        })
        const result = await useCase.execute({
            taskId: "missing",
        })

        expect(result.isFail).toBe(true)
        expect(result.error.code).toBe("NOT_FOUND")
        if (result.isOk) {
            throw new Error("Expected failure")
        }
    })
})
