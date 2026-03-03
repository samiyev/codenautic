import type {IUseCase} from "../ports/inbound/use-case.port"
import type {IProjectRepository} from "../ports/outbound/project-repository.port"
import {UniqueId} from "../../domain/value-objects/unique-id.value-object"
import {ValidationError, type IValidationErrorField} from "../../domain/errors/validation.error"
import {
    type IProjectIdInput,
    mapProjectToDTO,
    type IProjectDTO,
} from "../dto/project/project.dto"
import {Result} from "../../shared/result"

/**
 * Input/output payloads for project read.
 */
export type IGetProjectByIdOutput = {
    readonly project: IProjectDTO
}

/**
 * Fetches project by identifier.
 */
export class GetProjectByIdUseCase implements IUseCase<IProjectIdInput, IGetProjectByIdOutput, ValidationError> {
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
     * Returns project by identifier when exists.
     *
     * @param input Request payload.
     * @returns Project DTO.
     */
    public async execute(input: IProjectIdInput): Promise<Result<IGetProjectByIdOutput, ValidationError>> {
        const validation = this.validateProjectId(input.projectId)
        if (validation !== undefined) {
            return Result.fail<IGetProjectByIdOutput, ValidationError>(
                new ValidationError("Project query validation failed", [validation]),
            )
        }

        const projectId = UniqueId.create(input.projectId)
        const project = await this.projectRepository.findById(projectId)
        if (project === null) {
            return Result.fail<IGetProjectByIdOutput, ValidationError>(
                new ValidationError("Project query validation failed", [
                    {
                        field: "projectId",
                        message: `Project '${input.projectId}' not found`,
                    },
                ]),
            )
        }

        return Result.ok<IGetProjectByIdOutput, ValidationError>({
            project: mapProjectToDTO(project),
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
