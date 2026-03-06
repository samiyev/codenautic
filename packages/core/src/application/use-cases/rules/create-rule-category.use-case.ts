import {ValidationError, type IValidationErrorField} from "../../../domain/errors/validation.error"
import {RuleCategoryFactory} from "../../../domain/factories/rule-category.factory"
import type {IUseCase} from "../../ports/inbound/use-case.port"
import type {IRuleCategoryRepository} from "../../ports/outbound/rule/rule-category-repository.port"
import {
    type ICreateRuleCategoryInput,
    type ICreateRuleCategoryOutput,
    mapRuleCategoryToDTO,
} from "../../dto/rules/rule-category.dto"
import {Result} from "../../../shared/result"

/**
 * Dependencies for rule category creation.
 */
export interface ICreateRuleCategoryUseCaseDependencies {
    readonly ruleCategoryRepository: IRuleCategoryRepository
    readonly ruleCategoryFactory: RuleCategoryFactory
}

/**
 * Creates rule categories for admin API.
 */
export class CreateRuleCategoryUseCase
    implements IUseCase<ICreateRuleCategoryInput, ICreateRuleCategoryOutput, ValidationError>
{
    private readonly ruleCategoryRepository: IRuleCategoryRepository
    private readonly ruleCategoryFactory: RuleCategoryFactory

    /**
     * Creates use case instance.
     *
     * @param dependencies Use case dependencies.
     */
    public constructor(dependencies: ICreateRuleCategoryUseCaseDependencies) {
        this.ruleCategoryRepository = dependencies.ruleCategoryRepository
        this.ruleCategoryFactory = dependencies.ruleCategoryFactory
    }

    /**
     * Creates rule category.
     *
     * @param input Request payload.
     * @returns Created rule category DTO.
     */
    public async execute(
        input: ICreateRuleCategoryInput,
    ): Promise<Result<ICreateRuleCategoryOutput, ValidationError>> {
        const fields = this.validateInput(input)
        if (fields.length > 0) {
            return Result.fail<ICreateRuleCategoryOutput, ValidationError>(
                new ValidationError("Rule category creation validation failed", fields),
            )
        }

        const payload = this.normalizeInput(input)
        const conflict = await this.ruleCategoryRepository.findBySlug(payload.slug)
        if (conflict !== null) {
            return Result.fail<ICreateRuleCategoryOutput, ValidationError>(
                new ValidationError("Rule category creation validation failed", [
                    {
                        field: "slug",
                        message: "category with the same slug already exists",
                    },
                ]),
            )
        }

        try {
            const category = this.ruleCategoryFactory.create({
                slug: payload.slug,
                name: payload.name,
                description: payload.description,
                weight: payload.weight,
                isActive: payload.isActive,
            })

            await this.ruleCategoryRepository.save(category)

            return Result.ok<ICreateRuleCategoryOutput, ValidationError>({
                category: mapRuleCategoryToDTO(category),
            })
        } catch (error: unknown) {
            if (error instanceof Error) {
                return Result.fail<ICreateRuleCategoryOutput, ValidationError>(
                    this.mapFactoryError(error, "Rule category creation validation failed"),
                )
            }

            throw error
        }
    }

    private validateInput(input: ICreateRuleCategoryInput): IValidationErrorField[] {
        const fields: IValidationErrorField[] = []
        fields.push(...this.validateRequiredString("slug", input.slug))
        fields.push(...this.validateRequiredString("name", input.name))
        fields.push(...this.validateRequiredString("description", input.description))

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

    private normalizeInput(input: ICreateRuleCategoryInput): {
        readonly slug: string
        readonly name: string
        readonly description: string
        readonly weight?: number
        readonly isActive?: boolean
    } {
        return {
            slug: input.slug.trim(),
            name: input.name.trim(),
            description: input.description.trim(),
            weight: input.weight,
            isActive: input.isActive,
        }
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
}
