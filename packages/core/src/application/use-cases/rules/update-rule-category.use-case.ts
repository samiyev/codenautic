import {ValidationError, type IValidationErrorField} from "../../../domain/errors/validation.error"
import {RuleCategoryFactory} from "../../../domain/factories/rule-category.factory"
import type {IUseCase} from "../../ports/inbound/use-case.port"
import type {IRuleCategoryRepository} from "../../ports/outbound/rule/rule-category-repository.port"
import {UniqueId} from "../../../domain/value-objects/unique-id.value-object"
import {
    type IUpdateRuleCategoryInput,
    type IUpdateRuleCategoryOutput,
    mapRuleCategoryToDTO,
} from "../../dto/rules/rule-category.dto"
import {Result} from "../../../shared/result"
import type {RuleCategory} from "../../../domain/entities/rule-category.entity"

/**
 * Dependencies for rule category update.
 */
export interface IUpdateRuleCategoryUseCaseDependencies {
    readonly ruleCategoryRepository: IRuleCategoryRepository
    readonly ruleCategoryFactory: RuleCategoryFactory
}

/**
 * Updates rule categories for admin API.
 */
export class UpdateRuleCategoryUseCase
    implements IUseCase<IUpdateRuleCategoryInput, IUpdateRuleCategoryOutput, ValidationError>
{
    private readonly ruleCategoryRepository: IRuleCategoryRepository
    private readonly ruleCategoryFactory: RuleCategoryFactory

    /**
     * Creates use case instance.
     *
     * @param dependencies Use case dependencies.
     */
    public constructor(dependencies: IUpdateRuleCategoryUseCaseDependencies) {
        this.ruleCategoryRepository = dependencies.ruleCategoryRepository
        this.ruleCategoryFactory = dependencies.ruleCategoryFactory
    }

    /**
     * Updates rule category.
     *
     * @param input Request payload.
     * @returns Updated rule category DTO.
     */
    public async execute(
        input: IUpdateRuleCategoryInput,
    ): Promise<Result<IUpdateRuleCategoryOutput, ValidationError>> {
        const fields = this.validateInput(input)
        if (fields.length > 0) {
            return Result.fail<IUpdateRuleCategoryOutput, ValidationError>(
                new ValidationError("Rule category update validation failed", fields),
            )
        }

        const categoryId = UniqueId.create(input.categoryId.trim())
        const existing = await this.ruleCategoryRepository.findById(categoryId)
        if (existing === null) {
            return Result.fail<IUpdateRuleCategoryOutput, ValidationError>(
                new ValidationError("Rule category update validation failed", [
                    {
                        field: "categoryId",
                        message: "category not found",
                    },
                ]),
            )
        }

        const nextState = this.resolveNextState(existing, input)
        if (nextState.isFail) {
            return Result.fail<IUpdateRuleCategoryOutput, ValidationError>(nextState.error)
        }

        const conflict = await this.findSlugConflict(existing, nextState.value.slug)
        if (conflict) {
            return Result.fail<IUpdateRuleCategoryOutput, ValidationError>(
                new ValidationError("Rule category update validation failed", [
                    {
                        field: "slug",
                        message: "category with the same slug already exists",
                    },
                ]),
            )
        }

        try {
            const category = this.ruleCategoryFactory.reconstitute({
                id: existing.id.value,
                slug: nextState.value.slug,
                name: nextState.value.name,
                description: nextState.value.description,
                weight: nextState.value.weight,
                isActive: nextState.value.isActive,
            })

            await this.ruleCategoryRepository.save(category)

            return Result.ok<IUpdateRuleCategoryOutput, ValidationError>({
                category: mapRuleCategoryToDTO(category),
            })
        } catch (error: unknown) {
            if (error instanceof Error) {
                return Result.fail<IUpdateRuleCategoryOutput, ValidationError>(
                    this.mapFactoryError(error, "Rule category update validation failed"),
                )
            }

            throw error
        }
    }

    private validateInput(input: IUpdateRuleCategoryInput): IValidationErrorField[] {
        const fields: IValidationErrorField[] = []
        fields.push(...this.validateRequiredString("categoryId", input.categoryId))

        if (!this.hasUpdateFields(input)) {
            fields.push({
                field: "category",
                message: "at least one field must be provided",
            })
            return fields
        }

        fields.push(...this.validateOptionalString("slug", input.slug))
        fields.push(...this.validateOptionalString("name", input.name))
        fields.push(...this.validateOptionalString("description", input.description))

        const weightValidation = this.validateOptionalWeight(input.weight)
        if (weightValidation !== undefined) {
            fields.push(weightValidation)
        }

        const isActiveValidation = this.validateOptionalBoolean("isActive", input.isActive)
        if (isActiveValidation !== undefined) {
            fields.push(isActiveValidation)
        }

        return fields
    }

    private resolveNextState(
        existing: RuleCategory,
        input: IUpdateRuleCategoryInput,
    ): Result<{
        readonly slug: string
        readonly name: string
        readonly description: string
        readonly weight: number
        readonly isActive: boolean
    }, ValidationError> {
        const slug = this.resolveString(existing.slug, input.slug)
        const name = this.resolveString(existing.name, input.name)
        const description = this.resolveString(existing.description, input.description)
        const weight = this.resolveWeight(existing.weight, input.weight)
        const isActive = this.resolveBoolean(existing.isActive, input.isActive)

        return Result.ok({
            slug,
            name,
            description,
            weight,
            isActive,
        })
    }

    private validateRequiredString(field: string, value: string): IValidationErrorField[] {
        if (typeof value !== "string" || value.trim().length === 0) {
            return [
                {
                    field,
                    message: "must be a non-empty string",
                },
            ]
        }

        return []
    }

    private validateOptionalString(field: string, value: string | undefined): IValidationErrorField[] {
        if (value === undefined) {
            return []
        }

        if (typeof value !== "string" || value.trim().length === 0) {
            return [
                {
                    field,
                    message: "must be a non-empty string",
                },
            ]
        }

        return []
    }

    private validateOptionalWeight(weight: number | undefined): IValidationErrorField | undefined {
        if (weight === undefined) {
            return undefined
        }

        if (typeof weight !== "number" || Number.isFinite(weight) === false || weight < 0) {
            return {
                field: "weight",
                message: "must be a non-negative number",
            }
        }

        return undefined
    }

    private validateOptionalBoolean(
        field: string,
        value: boolean | undefined,
    ): IValidationErrorField | undefined {
        if (value === undefined) {
            return undefined
        }

        if (typeof value !== "boolean") {
            return {
                field,
                message: "must be a boolean",
            }
        }

        return undefined
    }

    private hasUpdateFields(input: IUpdateRuleCategoryInput): boolean {
        return (
            input.slug !== undefined
            || input.name !== undefined
            || input.description !== undefined
            || input.weight !== undefined
            || input.isActive !== undefined
        )
    }

    private resolveString(existing: string, incoming?: string): string {
        return incoming?.trim() ?? existing
    }

    private resolveWeight(existing: number, incoming?: number): number {
        return incoming ?? existing
    }

    private resolveBoolean(existing: boolean, incoming?: boolean): boolean {
        return incoming ?? existing
    }

    private mapFactoryError(error: Error, message: string): ValidationError {
        return new ValidationError(message, [
            {
                field: this.resolveErrorField(error.message),
                message: error.message,
            },
        ])
    }

    private resolveErrorField(message: string): string {
        const normalized = message.toLowerCase()
        if (normalized.includes("slug")) {
            return "slug"
        }
        if (normalized.includes("name")) {
            return "name"
        }
        if (normalized.includes("description")) {
            return "description"
        }
        if (normalized.includes("weight")) {
            return "weight"
        }

        return "category"
    }

    private async findSlugConflict(existing: RuleCategory, slug: string): Promise<boolean> {
        const found = await this.ruleCategoryRepository.findBySlug(slug)
        if (found === null) {
            return false
        }

        return found.id.value !== existing.id.value
    }
}
