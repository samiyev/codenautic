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
 * Input for task completion.
 */
export interface ICompleteTaskInput {
    /**
     * Task identifier.
     */
    readonly taskId: string

    /**
     * Optional result payload.
     */
    readonly result?: unknown
}

/**
 * Output for task completion.
 */
export interface ICompleteTaskOutput {
    /**
     * Completed task snapshot.
     */
    readonly task: ITaskDTO
}

/**
 * Dependencies for complete-task use case.
 */
export interface ICompleteTaskUseCaseDependencies {
    /**
     * Task repository.
     */
    readonly taskRepository: ITaskRepository
}

/**
 * Completes a task and stores optional result.
 */
type TaskUseCaseError = DomainError

/**
 * Completes a task and stores optional result.
 */
export class CompleteTaskUseCase implements IUseCase<ICompleteTaskInput, ICompleteTaskOutput, TaskUseCaseError> {
    private readonly taskRepository: ITaskRepository

    /**
     * Creates use case instance.
     *
     * @param dependencies Required repository.
     */
    public constructor(dependencies: ICompleteTaskUseCaseDependencies) {
        this.taskRepository = dependencies.taskRepository
    }

    /**
     * Completes task.
     *
     * @param input Completion payload.
     * @returns Updated task DTO.
     */
    public async execute(
        input: ICompleteTaskInput,
    ): Promise<Result<ICompleteTaskOutput, TaskUseCaseError>> {
        const fields = this.validateInput(input)
        if (fields.length > 0) {
            return Result.fail<ICompleteTaskOutput, TaskUseCaseError>(
                new ValidationError("Complete task validation failed", fields),
            )
        }

        const task = await this.loadTask(input.taskId)
        if (task === null) {
            return Result.fail<ICompleteTaskOutput, TaskUseCaseError>(
                new NotFoundError("Task", input.taskId.trim()),
            )
        }

        try {
            task.complete(input.result)
            await this.taskRepository.save(task)

            return Result.ok<ICompleteTaskOutput, TaskUseCaseError>({
                task: mapTaskToDTO(task),
            })
        } catch (error: unknown) {
            if (error instanceof Error) {
                return Result.fail<ICompleteTaskOutput, TaskUseCaseError>(
                    new ValidationError("Complete task validation failed", [
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
     * Validates complete payload.
     *
     * @param input Raw payload.
     * @returns Validation errors.
     */
    private validateInput(input: ICompleteTaskInput): IValidationErrorField[] {
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
