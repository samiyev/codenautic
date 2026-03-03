import type {DomainError} from "../../../domain/errors/domain.error"
import type {IUseCase} from "../../ports/inbound/use-case.port"
import type {IValidationErrorField} from "../../../domain/errors/validation.error"
import {ValidationError} from "../../../domain/errors/validation.error"
import type {ITaskRepository} from "../../ports/outbound/task-repository.port"
import {TaskFactory} from "../../../domain/factories/task.factory"
import {mapTaskToDTO, type ITaskDTO} from "../../dto/task/task.dto"
import {Result} from "../../../shared/result"

/**
 * Input for creating asynchronous task.
 */
export interface ICreateTaskInput {
    /**
     * Raw task type.
     */
    readonly type: string

    /**
     * Optional metadata.
     */
    readonly metadata?: Record<string, unknown>
}

/**
 * Output for create-task use case.
 */
export interface ICreateTaskOutput {
    /**
     * Created task payload.
     */
    readonly task: ITaskDTO
}

/**
 * Dependencies for create-task use case.
 */
export interface ICreateTaskUseCaseDependencies {
    /**
     * Task repository.
     */
    readonly taskRepository: ITaskRepository

    /**
     * Task factory.
     */
    readonly taskFactory: TaskFactory
}

/**
 * Creates task with validated input.
 */
type TaskUseCaseError = DomainError

/**
 * Creates task with validated input.
 */
export class CreateTaskUseCase implements IUseCase<ICreateTaskInput, ICreateTaskOutput, TaskUseCaseError> {
    private readonly taskRepository: ITaskRepository
    private readonly taskFactory: TaskFactory

    /**
     * Creates use case instance.
     *
     * @param dependencies Required dependencies.
     */
    public constructor(dependencies: ICreateTaskUseCaseDependencies) {
        this.taskRepository = dependencies.taskRepository
        this.taskFactory = dependencies.taskFactory
    }

    /**
     * Creates task and persists it.
     *
     * @param input Request payload.
     * @returns Created task DTO.
     */
    public async execute(input: ICreateTaskInput): Promise<Result<ICreateTaskOutput, TaskUseCaseError>> {
        const fields = this.validateInput(input)
        if (fields.length > 0) {
            return Result.fail<ICreateTaskOutput, TaskUseCaseError>(
                new ValidationError("Create task validation failed", fields),
            )
        }

        try {
            const task = this.taskFactory.create({
                type: input.type.trim(),
                metadata: input.metadata,
            })

            await this.taskRepository.save(task)

            return Result.ok<ICreateTaskOutput, TaskUseCaseError>({
                task: mapTaskToDTO(task),
            })
        } catch (error: unknown) {
            if (error instanceof Error) {
                return Result.fail<ICreateTaskOutput, TaskUseCaseError>(
                    new ValidationError("Create task validation failed", [
                        {
                            field: "type",
                            message: error.message,
                        },
                    ]),
                )
            }

            throw error
        }
    }

    /**
     * Validates create input shape.
     *
     * @param input Raw payload.
     * @returns Validation fields.
     */
    private validateInput(input: ICreateTaskInput): IValidationErrorField[] {
        const fields: IValidationErrorField[] = []

        if (typeof input.type !== "string" || input.type.trim().length === 0) {
            fields.push({
                field: "type",
                message: "must be a non-empty string",
            })
        }

        if (input.metadata !== undefined && this.isInvalidMetadata(input.metadata) === true) {
            fields.push({
                field: "metadata",
                message: "must be a metadata object",
            })
        }

        return fields
    }

    /**
     * Validates metadata shape.
     *
     * @param metadata Raw metadata.
     * @returns True when metadata is invalid.
     */
    private isInvalidMetadata(metadata: Record<string, unknown>): boolean {
        return typeof metadata !== "object" || metadata === null
    }
}
