import type {IUseCase} from "../ports/inbound/use-case.port"
import type {IProjectRepository} from "../ports/outbound/project-repository.port"
import {ProjectFactory} from "../../domain/factories/project.factory"
import {OrganizationId} from "../../domain/value-objects/organization-id.value-object"
import {ValidationError, type IValidationErrorField} from "../../domain/errors/validation.error"
import {ProjectSettings} from "../../domain/value-objects/project-settings.value-object"
import {RepositoryId} from "../../domain/value-objects/repository-id.value-object"
import {
    type ICreateProjectInput,
    type ICreateProjectOutput,
    mapProjectToDTO,
} from "../dto/project/project.dto"
import {Result} from "../../shared/result"

/**
 * Creates and persists project configuration.
 */
export class CreateProjectUseCase implements IUseCase<ICreateProjectInput, ICreateProjectOutput, ValidationError> {
    private readonly projectRepository: IProjectRepository
    private readonly projectFactory: ProjectFactory

    /**
     * Creates project use case.
     *
     * @param dependencies Required use-case dependencies.
     */
    public constructor(dependencies: ICreateProjectUseCaseDependencies) {
        this.projectRepository = dependencies.projectRepository
        this.projectFactory = dependencies.projectFactory
    }

    /**
     * Creates project with validated settings and integrations.
     *
     * @param input Request payload.
     * @returns Created project DTO.
     */
    public async execute(input: ICreateProjectInput): Promise<Result<ICreateProjectOutput, ValidationError>> {
        const fields = this.validateInput(input)
        if (fields.length > 0) {
            return Result.fail<ICreateProjectOutput, ValidationError>(
                new ValidationError("Project creation validation failed", fields),
            )
        }

        const repositoryId = RepositoryId.parse(input.repositoryId)
        const organizationIdValidation = this.validateOrganizationIdFormat(input.organizationId)
        if (organizationIdValidation !== undefined) {
            return Result.fail<ICreateProjectOutput, ValidationError>(
                new ValidationError("Project creation validation failed", [organizationIdValidation]),
            )
        }

        const existingProject = await this.projectRepository.findByRepositoryId(repositoryId)
        if (existingProject !== null) {
            return Result.fail<ICreateProjectOutput, ValidationError>(
                new ValidationError("Project creation validation failed", [
                    {
                        field: "repositoryId",
                        message: `Project for repository '${repositoryId.toString()}' already exists`,
                    },
                ]),
            )
        }

        try {
            const project = this.projectFactory.create({
                repositoryId: repositoryId.toString(),
                organizationId: input.organizationId,
                settings: input.settings,
                integrations: input.integrations ?? [],
            })

            await this.projectRepository.save(project)

            return Result.ok<ICreateProjectOutput, ValidationError>({
                project: mapProjectToDTO(project),
            })
        } catch (error: unknown) {
            if (error instanceof Error) {
                return Result.fail<ICreateProjectOutput, ValidationError>(
                    new ValidationError("Project creation validation failed", [
                        {
                            field: "settings",
                            message: error.message,
                        },
                    ]),
                )
            }

            throw error
        }
    }

    /**
     * Validates request fields.
     *
     * @param input Request payload.
     * @returns Validation errors.
     */
    private validateInput(input: ICreateProjectInput): IValidationErrorField[] {
        const fields: IValidationErrorField[] = []

        fields.push(...this.validateRepositoryIdShape(input.repositoryId))
        fields.push(...this.validateOrganizationIdShape(input.organizationId))

        if (input.settings !== undefined) {
            const settingsValidation = this.validateSettings(input.settings)
            if (settingsValidation !== undefined) {
                fields.push(settingsValidation)
            }
        }

        if (input.integrations !== undefined) {
            const integrationValidation = this.validateIntegrations(input.integrations)
            if (integrationValidation !== undefined) {
                fields.push(...integrationValidation)
            }
        }

        return fields
    }

    /**
     * Validates repository id input shape.
     *
     * @param repositoryId Raw repository id.
     * @returns Validation errors.
     */
    private validateRepositoryIdShape(repositoryId: string): IValidationErrorField[] {
        if (typeof repositoryId !== "string" || repositoryId.trim().length === 0) {
            return [
                {
                    field: "repositoryId",
                    message: "must be a non-empty string",
                },
            ]
        }

        const validation = this.validateRepositoryIdFormat(repositoryId)
        if (validation !== undefined) {
            return [validation]
        }

        return []
    }

    /**
     * Validates repository id format via domain parser.
     *
     * @param repositoryId Raw repository id.
     * @returns Validation error when format invalid.
     */
    private validateRepositoryIdFormat(repositoryId: string): IValidationErrorField | undefined {
        try {
            RepositoryId.parse(repositoryId)
            return undefined
        } catch (error: unknown) {
            if (error instanceof Error) {
                return {
                    field: "repositoryId",
                    message: error.message,
                }
            }

            return {
                field: "repositoryId",
                message: "contains invalid value",
            }
        }
    }

    /**
     * Validates organization id input shape.
     *
     * @param organizationId Raw organization id.
     * @returns Validation errors.
     */
    private validateOrganizationIdShape(organizationId: string | null | undefined): IValidationErrorField[] {
        if (organizationId === undefined || organizationId === null) {
            return []
        }

        if (typeof organizationId !== "string" || organizationId.trim().length === 0) {
            return [
                {
                    field: "organizationId",
                    message: "must be null or a non-empty string",
                },
            ]
        }

        return []
    }

    /**
     * Validates organization id format.
     *
     * @param organizationId Raw organization id.
     * @returns Validation error when format invalid.
     */
    private validateOrganizationIdFormat(organizationId: string | null | undefined): IValidationErrorField | undefined {
        try {
            OrganizationId.create(organizationId)
            return undefined
        } catch (error: unknown) {
            if (error instanceof Error) {
                return {
                    field: "organizationId",
                    message: error.message,
                }
            }

            return {
                field: "organizationId",
                message: "contains invalid value",
            }
        }
    }

    /**
     * Validates settings values by attempting domain normalization.
     *
     * @param settings Project settings input.
     * @returns Field error when settings are invalid.
     */
    private validateSettings(settings: ICreateProjectInput["settings"]): IValidationErrorField | undefined {
        if (typeof settings !== "object" || settings === null) {
            return {
                field: "settings",
                message: "must be a configuration object",
            }
        }

        try {
            ProjectSettings.create(settings)
            return undefined
        } catch (error: unknown) {
            if (error instanceof Error) {
                return {
                    field: "settings",
                    message: error.message,
                }
            }

            return {
                field: "settings",
                message: "contains invalid values",
            }
        }
    }

    /**
     * Validates integration list shape and values.
     *
     * @param integrations Integration names.
     * @returns Field-level errors.
     */
    private validateIntegrations(integrations: readonly string[]): IValidationErrorField[] | undefined {
        const errors: IValidationErrorField[] = []

        if (!Array.isArray(integrations)) {
            errors.push({
                field: "integrations",
                message: "must be an array of strings",
            })

            return errors
        }

        for (const integration of integrations) {
            if (typeof integration !== "string" || integration.trim().length === 0) {
                errors.push({
                    field: "integrations",
                    message: "must contain non-empty strings",
                })

                break
            }
        }

        if (errors.length === 0) {
            return undefined
        }

        return errors
    }
}

/**
 * Dependencies for project creation.
 */
export interface ICreateProjectUseCaseDependencies {
    readonly projectRepository: IProjectRepository
    readonly projectFactory: ProjectFactory
}
