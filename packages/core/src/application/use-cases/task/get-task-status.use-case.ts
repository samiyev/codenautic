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
 * Input for task status query.
 */
export interface IGetTaskStatusInput {
    /**
     * Task identifier.
     */
    readonly taskId: string
}

/**
 * Output for task status query.
 */
export interface IGetTaskStatusOutput {
    /**
     * Task snapshot.
     */
    readonly task: ITaskDTO
}

/**
 * Dependencies for get-task-status use case.
 */
export interface IGetTaskStatusUseCaseDependencies {
    /**
     * Task repository.
     */
    readonly taskRepository: ITaskRepository
}

/**
 * Loads current status snapshot for task.
 */
type TaskUseCaseError = DomainError

/**
 * Loads current status snapshot for task.
 */
export class GetTaskStatusUseCase implements IUseCase<IGetTaskStatusInput, IGetTaskStatusOutput, TaskUseCaseError> {
    private readonly taskRepository: ITaskRepository

    /**
     * Creates use case instance.
     *
     * @param dependencies Required repository.
     */
    public constructor(dependencies: IGetTaskStatusUseCaseDependencies) {
        this.taskRepository = dependencies.taskRepository
    }

    /**
     * Gets task status.
     *
     * @param input Query payload.
     * @returns Task DTO.
     */
    public async execute(
        input: IGetTaskStatusInput,
    ): Promise<Result<IGetTaskStatusOutput, TaskUseCaseError>> {
        const fields = this.validateInput(input)
        if (fields.length > 0) {
            return Result.fail<IGetTaskStatusOutput, TaskUseCaseError>(
                new ValidationError("Get task status validation failed", fields),
            )
        }

        const task = await this.loadTask(input.taskId)
        if (task === null) {
            return Result.fail<IGetTaskStatusOutput, TaskUseCaseError>(
                new NotFoundError("Task", input.taskId.trim()),
            )
        }

        return Result.ok<IGetTaskStatusOutput, TaskUseCaseError>({
            task: mapTaskToDTO(task),
        })
    }

    /**
     * Loads task by id.
     *
     * @param rawTaskId Raw identifier.
     * @returns Task or null.
     */
    private async loadTask(rawTaskId: string): Promise<Task | null> {
        const taskId = UniqueId.create(rawTaskId)
        return await this.taskRepository.findById(taskId)
    }

    /**
     * Validates query input.
     *
     * @param input Raw query.
     * @returns Validation fields.
     */
    private validateInput(input: IGetTaskStatusInput): IValidationErrorField[] {
        if (typeof input.taskId !== "string" || input.taskId.trim().length === 0) {
            return [
                {
                    field: "taskId",
                    message: "must be a non-empty string",
                },
            ]
        }

        return []
    }
}
