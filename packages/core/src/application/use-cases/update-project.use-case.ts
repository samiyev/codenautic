import type {IUseCase} from "../ports/inbound/use-case.port"
import type {IProjectRepository} from "../ports/outbound/project-repository.port"
import {ValidationError, type IValidationErrorField} from "../../domain/errors/validation.error"
import {ProjectSettings} from "../../domain/value-objects/project-settings.value-object"
import {UniqueId} from "../../domain/value-objects/unique-id.value-object"
import {Project} from "../../domain/entities/project.entity"
import {
    mapProjectToDTO,
    type IUpdateProjectInput,
    type IUpdateProjectOutput,
} from "../dto/project/project.dto"
import {Result} from "../../shared/result"

/**
 * Input for updating a project.
 */
export type IUpdateProjectUseCaseInput = IUpdateProjectInput

/**
 * Updates project settings and adds integrations.
 */
export class UpdateProjectUseCase
    implements IUseCase<IUpdateProjectUseCaseInput, IUpdateProjectOutput, ValidationError>
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
     * Applies partial updates to project.
     *
     * @param input Update payload.
     * @returns Updated project DTO.
     */
    public async execute(input: IUpdateProjectUseCaseInput): Promise<Result<IUpdateProjectOutput, ValidationError>> {
        const validation = this.validateInput(input)
        if (validation.length > 0) {
            return Result.fail<IUpdateProjectOutput, ValidationError>(
                new ValidationError("Project update validation failed", validation),
            )
        }

        const projectId = UniqueId.create(input.projectId)
        const project = await this.projectRepository.findById(projectId)
        if (project === null) {
            return Result.fail<IUpdateProjectOutput, ValidationError>(
                new ValidationError("Project update validation failed", [
                    {
                        field: "projectId",
                        message: "projectId not found",
                    },
                ]),
            )
        }

        const settingsError = this.applySettings(project, input.settings)
        if (settingsError !== undefined) {
            return Result.fail<IUpdateProjectOutput, ValidationError>(settingsError)
        }

        const integrationsError = this.applyIntegrations(project, input.integrationsToAdd)
        if (integrationsError !== undefined) {
            return Result.fail<IUpdateProjectOutput, ValidationError>(integrationsError)
        }

        await this.projectRepository.save(project)

        return Result.ok<IUpdateProjectOutput, ValidationError>({
            project: mapProjectToDTO(project),
        })
    }

    /**
     * Applies settings update with validation translation.
     *
     * @param project Target project entity.
     * @param settings Settings payload.
     * @returns Validation error when update fails.
     */
    private applySettings(project: Project, settings: IUpdateProjectInput["settings"]): ValidationError | undefined {
        if (settings === undefined) {
            return undefined
        }

        try {
            project.updateSettings(settings)
            return undefined
        } catch (error: unknown) {
            if (error instanceof Error) {
                return new ValidationError("Project update validation failed", [
                    {
                        field: "settings",
                        message: error.message,
                    },
                ])
            }

            throw error
        }
    }

    /**
     * Applies integration updates with validation translation.
     *
     * @param project Target project entity.
     * @param integrations Integration names to add.
     * @returns Validation error when add fails.
     */
    private applyIntegrations(project: {addIntegration: (integration: string) => void}, integrations:
        | readonly string[]
        | undefined): ValidationError | undefined {
        if (integrations === undefined) {
            return undefined
        }

        for (const integration of integrations) {
            try {
                project.addIntegration(integration)
            } catch (error: unknown) {
                if (error instanceof Error) {
                    return new ValidationError("Project update validation failed", [
                        {
                            field: "integrationsToAdd",
                            message: error.message,
                        },
                    ])
                }

                throw error
            }
        }

        return undefined
    }

    /**
     * Validates update payload.
     *
     * @param input Raw payload.
     * @returns Field-level errors.
     */
    private validateInput(input: IUpdateProjectUseCaseInput): IValidationErrorField[] {
        const fields: IValidationErrorField[] = []

        if (typeof input.projectId !== "string" || input.projectId.trim().length === 0) {
            fields.push({
                field: "projectId",
                message: "must be a non-empty string",
            })
        }

        if (input.settings === undefined && input.integrationsToAdd === undefined) {
            fields.push({
                field: "settings",
                message: "at least one field must be provided",
            })
            return fields
        }

        if (input.settings !== undefined) {
            const settingsValidation = this.validateSettings(input.settings)
            if (settingsValidation !== undefined) {
                fields.push(settingsValidation)
            }
        }

        if (input.integrationsToAdd !== undefined) {
            const integrationValidation = this.validateIntegrations(input.integrationsToAdd)
            if (integrationValidation !== undefined) {
                fields.push(...integrationValidation)
            }
        }

        return fields
    }

    /**
     * Validates project update settings.
     *
     * @param settings Settings input.
     * @returns Field error when invalid.
     */
    private validateSettings(settings: IUpdateProjectInput["settings"]): IValidationErrorField | undefined {
        if (settings === undefined) {
            return undefined
        }

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
     * Validates integrations list.
     *
     * @param integrations Integration names to add.
     * @returns Field-level errors.
     */
    private validateIntegrations(integrations: readonly string[]): IValidationErrorField[] {
        if (!Array.isArray(integrations)) {
            return [
                {
                    field: "integrationsToAdd",
                    message: "must be an array of strings",
                },
            ]
        }

        const errors: IValidationErrorField[] = []

        for (const integration of integrations) {
            if (typeof integration !== "string" || integration.trim().length === 0) {
                errors.push({
                    field: "integrationsToAdd",
                    message: "must contain non-empty strings",
                })
                break
            }
        }

        return errors
    }
}
