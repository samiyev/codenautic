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
 * Input for task failure handling.
 */
export interface IFailTaskInput {
    /**
     * Task identifier.
     */
    readonly taskId: string

    /**
     * Failure reason.
     */
    readonly reason?: unknown
}

/**
 * Output for failed task snapshot.
 */
export interface IFailTaskOutput {
    /**
     * Failed task payload.
     */
    readonly task: ITaskDTO
}

/**
 * Dependencies for failing task.
 */
export interface IFailTaskUseCaseDependencies {
    /**
     * Task repository.
     */
    readonly taskRepository: ITaskRepository
}

/**
 * Marks task as failed.
 */
type TaskUseCaseError = DomainError

/**
 * Marks task as failed.
 */
export class FailTaskUseCase implements IUseCase<IFailTaskInput, IFailTaskOutput, TaskUseCaseError> {
    private readonly taskRepository: ITaskRepository

    /**
     * Creates use case instance.
     *
     * @param dependencies Required repository.
     */
    public constructor(dependencies: IFailTaskUseCaseDependencies) {
        this.taskRepository = dependencies.taskRepository
    }

    /**
     * Marks task as failed.
     *
     * @param input Failure payload.
     * @returns Failed task DTO.
     */
    public async execute(
        input: IFailTaskInput,
    ): Promise<Result<IFailTaskOutput, TaskUseCaseError>> {
        const fields = this.validateInput(input)
        if (fields.length > 0) {
            return Result.fail<IFailTaskOutput, TaskUseCaseError>(
                new ValidationError("Fail task validation failed", fields),
            )
        }

        const task = await this.loadTask(input.taskId)
        if (task === null) {
            return Result.fail<IFailTaskOutput, TaskUseCaseError>(
                new NotFoundError("Task", input.taskId.trim()),
            )
        }

        try {
            task.fail(input.reason)
            await this.taskRepository.save(task)

            return Result.ok<IFailTaskOutput, TaskUseCaseError>({
                task: mapTaskToDTO(task),
            })
        } catch (error: unknown) {
            if (error instanceof Error) {
                return Result.fail<IFailTaskOutput, TaskUseCaseError>(
                    new ValidationError("Fail task validation failed", [
                        {
                            field: "taskId",
                            message: error.message,
                        },
                    ]),
                )
            }

            throw error
        }
    }

    /**
     * Loads task by identifier.
     *
     * @param rawTaskId Raw identifier.
     * @returns Task or null.
     */
    private async loadTask(rawTaskId: string): Promise<Task | null> {
        const taskId = UniqueId.create(rawTaskId)
        return await this.taskRepository.findById(taskId)
    }

    /**
     * Validates fail payload.
     *
     * @param input Raw payload.
     * @returns Validation fields.
     */
    private validateInput(input: IFailTaskInput): IValidationErrorField[] {
        const fields: IValidationErrorField[] = []

        if (typeof input.taskId !== "string" || input.taskId.trim().length === 0) {
            fields.push({
                field: "taskId",
                message: "must be a non-empty string",
            })
        }

        return fields
    }
}
