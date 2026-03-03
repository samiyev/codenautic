import type {IUseCase} from "../ports/inbound/use-case.port"
import type {IProjectFilters, IProjectRepository} from "../ports/outbound/project-repository.port"
import {OrganizationId} from "../../domain/value-objects/organization-id.value-object"
import {RepositoryId} from "../../domain/value-objects/repository-id.value-object"
import {ValidationError, type IValidationErrorField} from "../../domain/errors/validation.error"
import {
    mapProjectToDTO,
    type IListProjectsInput,
    type IListProjectsOutput,
} from "../dto/project/project.dto"
import {Result} from "../../shared/result"

/**
 * Returns list of projects by optional filters.
 */
export class ListProjectsUseCase implements IUseCase<IListProjectsInput, IListProjectsOutput, ValidationError> {
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
     * Reads projects with optional organization/repository filters.
     *
     * @param input Filter payload.
     * @returns Project list and total count.
     */
    public async execute(input: IListProjectsInput): Promise<Result<IListProjectsOutput, ValidationError>> {
        const validation = this.validateFilters(input)
        if (validation.length > 0) {
            return Result.fail<IListProjectsOutput, ValidationError>(
                new ValidationError("Project list validation failed", validation),
            )
        }

        const filtersResult = this.normalizeFilters(input)
        const {filters, filterErrors} = filtersResult
        if (filterErrors.length > 0) {
            return Result.fail<IListProjectsOutput, ValidationError>(
                new ValidationError("Project list validation failed", filterErrors),
            )
        }

        const projects = await this.projectRepository.findAll(filters)
        const totalCount = await this.projectRepository.count(filters)

        return Result.ok<IListProjectsOutput, ValidationError>({
            projects: projects.map((project) => {
                return mapProjectToDTO(project)
            }),
            totalCount,
        })
    }

    /**
     * Normalizes and validates filters in a single place.
     *
     * @param input Filter input.
     * @returns Normalized filter values + parser errors.
     */
    private normalizeFilters(input: IListProjectsInput): {
        readonly filters: IProjectFilters | undefined
        readonly filterErrors: IValidationErrorField[]
    } {
        const filterErrors: IValidationErrorField[] = []

        let organizationId: OrganizationId | undefined
        if (input.organizationId !== undefined) {
            try {
                organizationId = OrganizationId.create(input.organizationId)
            } catch (error: unknown) {
                if (error instanceof Error) {
                    filterErrors.push({
                        field: "organizationId",
                        message: error.message,
                    })
                } else {
                    filterErrors.push({
                        field: "organizationId",
                        message: "contains invalid value",
                    })
                }
            }
        }

        let repositoryId: RepositoryId | undefined
        if (input.repositoryId !== undefined) {
            try {
                repositoryId = RepositoryId.parse(input.repositoryId)
            } catch (error: unknown) {
                if (error instanceof Error) {
                    filterErrors.push({
                        field: "repositoryId",
                        message: error.message,
                    })
                } else {
                    filterErrors.push({
                        field: "repositoryId",
                        message: "contains invalid value",
                    })
                }
            }
        }

        return {
            filters: {
                organizationId,
                repositoryId,
            },
            filterErrors,
        }
    }

    /**
     * Validates list query fields.
     *
     * @param input Filter input.
     * @returns Collected field-level errors.
     */
    private validateFilters(input: IListProjectsInput): IValidationErrorField[] {
        const fields: IValidationErrorField[] = []

        if (
            input.organizationId !== undefined &&
            input.organizationId !== null &&
            typeof input.organizationId !== "string"
        ) {
            fields.push({
                field: "organizationId",
                message: "must be null or a string",
            })
        }

        if (input.organizationId === null) {
            return fields
        }

        if (typeof input.organizationId === "string" && input.organizationId.trim().length === 0) {
            fields.push({
                field: "organizationId",
                message: "must be a non-empty string when provided",
            })
        }

        if (input.repositoryId !== undefined) {
            if (typeof input.repositoryId !== "string" || input.repositoryId.trim().length === 0) {
                fields.push({
                    field: "repositoryId",
                    message: "must be a non-empty string",
                })
            }
        }

        return fields
    }
}
