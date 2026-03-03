import type {DomainError} from "../../../domain/errors/domain.error"
import type {IUseCase} from "../../ports/inbound/use-case.port"
import {NotFoundError} from "../../../domain/errors/not-found.error"
import {ValidationError, type IValidationErrorField} from "../../../domain/errors/validation.error"
import type {ITaskRepository} from "../../ports/outbound/task-repository.port"
import {UniqueId} from "../../../domain/value-objects/unique-id.value-object"
import type {Task} from "../../../domain/entities/task.entity"
import {mapTaskToDTO, type ITaskDTO} from "../../dto/task/task.dto"
import {Result} from "../../../shared/result"

/**
 * Input for progress update.
 */
export interface IUpdateTaskProgressInput {
    /**
     * Task identifier.
     */
    readonly taskId: string

    /**
     * Next progress value.
     */
    readonly progress: number
}

/**
 * Output for progress update.
 */
export interface IUpdateTaskProgressOutput {
    /**
     * Updated task snapshot.
     */
    readonly task: ITaskDTO
}

/**
 * Dependencies for updating task progress.
 */
export interface IUpdateTaskProgressUseCaseDependencies {
    /**
     * Task repository.
     */
    readonly taskRepository: ITaskRepository
}

/**
 * Updates progress for RUNNING task.
 */
type TaskUseCaseError = DomainError

/**
 * Updates progress for RUNNING task.
 */
export class UpdateTaskProgressUseCase implements IUseCase<IUpdateTaskProgressInput, IUpdateTaskProgressOutput, TaskUseCaseError> {
    private readonly taskRepository: ITaskRepository

    /**
     * Creates use case instance.
     *
     * @param dependencies Required repository.
     */
    public constructor(dependencies: IUpdateTaskProgressUseCaseDependencies) {
        this.taskRepository = dependencies.taskRepository
    }

    /**
     * Updates task progress after validation.
     *
     * @param input Request payload.
     * @returns Updated task DTO.
     */
    public async execute(
        input: IUpdateTaskProgressInput,
    ): Promise<Result<IUpdateTaskProgressOutput, TaskUseCaseError>> {
        const fields = this.validateInput(input)
        if (fields.length > 0) {
            return Result.fail<IUpdateTaskProgressOutput, TaskUseCaseError>(
                new ValidationError("Update task progress validation failed", fields),
            )
        }

        const task = await this.loadTask(input.taskId)
        if (task === null) {
            return Result.fail<IUpdateTaskProgressOutput, TaskUseCaseError>(
                new NotFoundError("Task", input.taskId.trim()),
            )
        }

        try {
            task.updateProgress(input.progress)
            await this.taskRepository.save(task)

            return Result.ok<IUpdateTaskProgressOutput, TaskUseCaseError>({
                task: mapTaskToDTO(task),
            })
        } catch (error: unknown) {
            if (error instanceof Error) {
                return Result.fail<IUpdateTaskProgressOutput, TaskUseCaseError>(
                    new ValidationError("Update task progress validation failed", [
                        {
                            field: "progress",
                            message: error.message,
                        },
                    ]),
                )
            }

            throw error
        }
    }

    /**
     * Loads task by id.
     *
     * @param rawTaskId Raw identifier.
     * @returns Task instance or null.
     */
    private async loadTask(rawTaskId: string): Promise<Task | null> {
        const taskId = UniqueId.create(rawTaskId)
        return await this.taskRepository.findById(taskId)
    }

    /**
     * Validates input shape.
     *
     * @param input Raw payload.
     * @returns Validation fields.
     */
    private validateInput(input: IUpdateTaskProgressInput): IValidationErrorField[] {
        const fields: IValidationErrorField[] = []

        if (typeof input.taskId !== "string" || input.taskId.trim().length === 0) {
            fields.push({
                field: "taskId",
                message: "must be a non-empty string",
            })
        }

        if (typeof input.progress !== "number" || Number.isNaN(input.progress) || Number.isFinite(input.progress) === false) {
            fields.push({
                field: "progress",
                message: "must be a finite number",
            })
        }

        return fields
    }
}
