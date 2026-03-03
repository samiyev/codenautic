import type {IUseCase} from "../ports/inbound/use-case.port"
import {ValidationError, type IValidationErrorField} from "../../domain/errors/validation.error"
import {OrganizationId} from "../../domain/value-objects/organization-id.value-object"
import {PromptEngineService} from "../../domain/services/prompt-engine.service"
import type {PromptTemplate} from "../../domain/entities/prompt-template.entity"
import type {IPromptTemplateRepository} from "../ports/outbound/prompt-template-repository.port"
import type {IPromptConfigurationRepository} from "../ports/outbound/prompt-configuration-repository.port"
import {Result} from "../../shared/result"

/** Input payload for prompt generation. */
export interface IGeneratePromptInput {
    /**
     * Prompt template name.
     */
    readonly name: string

    /**
     * Optional organization for scoped configuration/template lookup.
     */
    readonly organizationId?: string | null

    /**
     * Runtime variable values.
     */
    readonly runtimeVariables?: Record<string, unknown>
}

/** Dependencies for prompt generation. */
export interface IGeneratePromptUseCaseDependencies {
    /**
     * Prompt template storage.
     */
    readonly promptTemplateRepository: IPromptTemplateRepository

    /**
     * Prompt configuration storage.
     */
    readonly promptConfigurationRepository: IPromptConfigurationRepository

    /**
     * Prompt render/validation service.
     */
    readonly promptEngineService: PromptEngineService
}

interface INormalizedGeneratePromptInput {
    readonly name: string
    readonly runtimeVariables: Record<string, unknown>
    readonly organizationId: OrganizationId | undefined
}

/**
 * Generates prompt text from template and configurations.
 */
export class GeneratePromptUseCase
    implements IUseCase<IGeneratePromptInput, string, ValidationError>
{
    private readonly promptTemplateRepository: IPromptTemplateRepository
    private readonly promptConfigurationRepository: IPromptConfigurationRepository
    private readonly promptEngineService: PromptEngineService

    /**
     * Creates use case.
     *
     * @param dependencies Required dependencies.
     */
    public constructor(dependencies: IGeneratePromptUseCaseDependencies) {
        this.promptTemplateRepository = dependencies.promptTemplateRepository
        this.promptConfigurationRepository = dependencies.promptConfigurationRepository
        this.promptEngineService = dependencies.promptEngineService
    }

    /**
     * Generates final prompt by rendering template with merged variables.
     *
     * @param input Request payload.
     * @returns Rendered prompt text.
     */
    public async execute(input: IGeneratePromptInput): Promise<Result<string, ValidationError>> {
        const normalized = this.normalizeInput(input)
        if (normalized.result.isFail) {
            return Result.fail<string, ValidationError>(normalized.result.error)
        }
        if (normalized.value === undefined) {
            return Result.fail<string, ValidationError>(
                new ValidationError("Generate prompt internal failure", [{
                    field: "internal",
                    message: "Normalization result is incomplete",
                }]),
            )
        }

        const {name, runtimeVariables, organizationId} = normalized.value

        const template = await this.promptTemplateRepository.findByName(name, organizationId)
        if (template === null) {
            return Result.fail<string, ValidationError>(
                new ValidationError("Generate prompt failed", [{
                    field: "name",
                    message: "Template not found",
                }]),
            )
        }

        const configuration = await this.promptConfigurationRepository.findByName(name, organizationId)
        const merged = this.mergeVariables(
            configuration?.defaults ?? {},
            configuration?.overrides ?? {},
            runtimeVariables,
        )

        return this.renderTemplate(template, merged)
    }

    /**
     * Renders template with final variables and converts validation issues to result.
     *
     * @param template Template entity.
     * @param variables Render variables.
     * @returns Rendered prompt or validation fail.
     */
    private renderTemplate(
        template: PromptTemplate,
        variables: Record<string, unknown>,
    ): Result<string, ValidationError> {
        const validation = this.promptEngineService.validate(template.content)
        if (validation.isFail) {
            return Result.fail<string, ValidationError>(validation.error)
        }

        try {
            const rendered = this.promptEngineService.render(template.content, variables)
            return Result.ok<string, ValidationError>(rendered)
        } catch (error) {
            if (error instanceof ValidationError) {
                return Result.fail<string, ValidationError>(error)
            }

            return Result.fail<string, ValidationError>(
                new ValidationError("Generate prompt failed", [{
                    field: "runtimeVariables",
                    message: "Failed to render template",
                }]),
            )
        }
    }

    /**
     * Merges defaults, overrides and runtime variables (runtime wins).
     *
     * @param defaults Base values.
     * @param overrides Override values.
     * @param runtime Runtime values.
     * @returns Merged values.
     */
    private mergeVariables(
        defaults: Record<string, unknown>,
        overrides: Record<string, unknown>,
        runtime: Record<string, unknown>,
    ): Record<string, unknown> {
        const merged: Record<string, unknown> = {}
        this.deepMerge(merged, defaults)
        this.deepMerge(merged, overrides)
        this.deepMerge(merged, runtime)
        return merged
    }

    /**
     * Validates and normalizes request payload.
     *
     * @param input Raw input.
     * @returns Validation result and normalized payload.
     */
    private normalizeInput(
        input: IGeneratePromptInput,
    ): {
        readonly result: Result<INormalizedGeneratePromptInput, ValidationError>
        readonly value?: INormalizedGeneratePromptInput
    } {
        const fields: IValidationErrorField[] = []
        if (this.validateInputContainer(input, fields) === false) {
            return {
                result: Result.fail(
                    new ValidationError("Generate prompt validation failed", fields),
                ),
            }
        }

        const normalizedName = this.normalizeName(input.name, fields)
        const organizationId = this.normalizeOrganizationId(input.organizationId, fields)
        const runtimeVariables = this.normalizeRuntimeVariables(input.runtimeVariables, fields)

        if (fields.length > 0) {
            return {
                result: Result.fail(
                    new ValidationError("Generate prompt validation failed", fields),
                ),
            }
        }

        return {
            result: Result.ok({
                name: normalizedName,
                runtimeVariables,
                organizationId,
            }),
            value: {
                name: normalizedName,
                runtimeVariables,
                organizationId,
            },
        }
    }

    /**
     * Validates input container as plain object.
     *
     * @param input Payload.
     * @param fields Validation fields accumulator.
     * @returns Whether payload is valid container.
     */
    private validateInputContainer(
        input: unknown,
        fields: IValidationErrorField[],
    ): input is IGeneratePromptInput {
        if (typeof input !== "object" || input === null || Array.isArray(input)) {
            fields.push({
                field: "input",
                message: "must be a non-null object",
            })
            return false
        }

        return true
    }

    /**
     * Normalizes template name.
     *
     * @param value Raw name.
     * @param fields Validation fields accumulator.
     * @returns Normalized name.
     */
    private normalizeName(
        value: IGeneratePromptInput["name"],
        fields: IValidationErrorField[],
    ): string {
        if (typeof value !== "string" || value.trim().length === 0) {
            fields.push({
                field: "name",
                message: "must be a non-empty string",
            })
            return ""
        }

        return value.trim()
    }

    /**
     * Normalizes organizationId for optional global/non-global scope.
     *
     * @param value Raw organization id value.
     * @param fields Validation fields accumulator.
     * @returns Parsed organization value object.
     */
    private normalizeOrganizationId(
        value: IGeneratePromptInput["organizationId"],
        fields: IValidationErrorField[],
    ): OrganizationId | undefined {
        if (value === undefined || value === null) {
            return undefined
        }

        if (typeof value !== "string" || value.trim().length === 0) {
            fields.push({
                field: "organizationId",
                message: "must be a non-empty string",
            })
            return undefined
        }

        try {
            return OrganizationId.create(value.trim())
        } catch (error) {
            fields.push({
                field: "organizationId",
                message: error instanceof Error ? error.message : "invalid organizationId",
            })

            return undefined
        }
    }

    /**
     * Normalizes runtime variable map.
     *
     * @param value Raw runtime values.
     * @param fields Validation fields accumulator.
     * @returns Runtime variables map.
     */
    private normalizeRuntimeVariables(
        value: IGeneratePromptInput["runtimeVariables"],
        fields: IValidationErrorField[],
    ): Record<string, unknown> {
        if (value === undefined) {
            return {}
        }

        if (value === null || typeof value !== "object" || Array.isArray(value)) {
            fields.push({
                field: "runtimeVariables",
                message: "must be a record",
            })
            return {}
        }

        return value
    }

    /**
     * Performs recursive deep merge.
     *
     * @param target Target object.
     * @param source Source object.
     */
    private deepMerge(
        target: Record<string, unknown>,
        source: Record<string, unknown>,
    ): void {
        for (const key in source) {
            if (Object.prototype.hasOwnProperty.call(source, key) === false) {
                continue
            }

            const sourceValue = source[key]
            if (sourceValue === null || sourceValue === undefined) {
                target[key] = sourceValue
                continue
            }

            if (Array.isArray(sourceValue) === true) {
                target[key] = this.cloneArray(sourceValue)
                continue
            }

            if (this.isPlainObject(sourceValue) === false) {
                target[key] = sourceValue
                continue
            }

            const targetValue = target[key]
            if (this.isPlainObject(targetValue)) {
                const nestedTarget = targetValue
                this.deepMerge(nestedTarget, sourceValue)
                target[key] = nestedTarget
                continue
            }

            target[key] = this.cloneObject(sourceValue)
        }
    }

    /**
     * Clones map-like object shallowly.
     *
     * @param source Source object.
     * @returns Cloned object.
     */
    private cloneObject(source: Record<string, unknown>): Record<string, unknown> {
        const result: Record<string, unknown> = {}

        for (const key in source) {
            if (Object.prototype.hasOwnProperty.call(source, key) === false) {
                continue
            }

            const value = source[key]
            if (value === null || value === undefined) {
                result[key] = value
                continue
            }

            if (Array.isArray(value) === true) {
                result[key] = this.cloneArray(value)
                continue
            }

            if (this.isPlainObject(value)) {
                result[key] = this.cloneObject(value)
                continue
            }

            result[key] = value
        }

        return result
    }

    /**
     * Detects plain JSON-like object.
     *
     * @param value Value to check.
     * @returns True when value is a plain object.
     */
    private isPlainObject(value: unknown): value is Record<string, unknown> {
        return (
            typeof value === "object"
            && value !== null
            && value.constructor === Object
        )
    }

    /**
     * Clones object recursively and performs type-safe recursion guards.
     *
     * @param source Source value.
     * @returns Cloned value.
     */
    private cloneValue(source: unknown): unknown {
        if (this.isPlainObject(source)) {
            return this.cloneObject(source)
        }

        if (Array.isArray(source)) {
            return this.cloneArray(source)
        }

        return source
    }

    /**
     * Clones array with nested value cloning.
     *
     * @param source Source array.
     * @returns Cloned array.
     */
    private cloneArray(source: unknown[]): unknown[] {
        return source.map((item): unknown => {
            if (this.isPlainObject(item) || Array.isArray(item)) {
                return this.cloneValue(item)
            }

            return item
        })
    }
}
