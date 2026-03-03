import type {IUseCase} from "../ports/inbound/use-case.port"
import type {IProjectRepository} from "../ports/outbound/project-repository.port"
import {ValidationError, type IValidationErrorField} from "../../domain/errors/validation.error"
import {UniqueId} from "../../domain/value-objects/unique-id.value-object"
import {
    type IDeleteProjectOutput,
    type IProjectIdInput,
} from "../dto/project/project.dto"
import {Result} from "../../shared/result"

/**
 * Deletes project by identifier.
 */
export class DeleteProjectUseCase
    implements IUseCase<IProjectIdInput, IDeleteProjectOutput, ValidationError>
{
    private readonly projectRepository: IProjectRepository

    /**
     * Creates use case instance.
     *
     * @param projectRepository Project persistence port.
     */
    public constructor(projectRepository: IProjectRepository) {
        this.projectRepository = projectRepository
    }

    /**
     * Removes project if it exists.
     *
     * @param input Request payload.
     * @returns Identifier of removed project.
     */
    public async execute(input: IProjectIdInput): Promise<Result<IDeleteProjectOutput, ValidationError>> {
        const validationError = this.validateProjectId(input.projectId)
        if (validationError !== undefined) {
            return Result.fail<IDeleteProjectOutput, ValidationError>(
                new ValidationError("Project delete validation failed", [validationError]),
            )
        }

        const projectId = UniqueId.create(input.projectId)
        const project = await this.projectRepository.findById(projectId)
        if (project === null) {
            return Result.fail<IDeleteProjectOutput, ValidationError>(
                new ValidationError("Project delete validation failed", [
                    {
                        field: "projectId",
                        message: `Project '${input.projectId}' not found`,
                    },
                ]),
            )
        }

        await this.projectRepository.delete(project.id)

        return Result.ok<IDeleteProjectOutput, ValidationError>({
            projectId: project.id.value,
        })
    }

    /**
     * Validates project identifier.
     *
     * @param projectId Raw identifier.
     * @returns Field error when invalid.
     */
    private validateProjectId(projectId: string): IValidationErrorField | undefined {
        if (typeof projectId !== "string" || projectId.trim().length === 0) {
            return {
                field: "projectId",
                message: "must be a non-empty string",
            }
        }

        return undefined
    }
}
