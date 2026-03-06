import {ValidationError, type IValidationErrorField} from "../../../domain/errors/validation.error"
import type {IUseCase} from "../../ports/inbound/use-case.port"
import type {IRuleCategoryRepository} from "../../ports/outbound/rule/rule-category-repository.port"
import {UniqueId} from "../../../domain/value-objects/unique-id.value-object"
import {
    type IDeleteRuleCategoryOutput,
    type IRuleCategoryIdInput,
} from "../../dto/rules/rule-category.dto"
import {Result} from "../../../shared/result"

/**
 * Dependencies for rule category deletion.
 */
export interface IDeleteRuleCategoryUseCaseDependencies {
    readonly ruleCategoryRepository: IRuleCategoryRepository
}

/**
 * Deletes rule categories by id.
 */
export class DeleteRuleCategoryUseCase
    implements IUseCase<IRuleCategoryIdInput, IDeleteRuleCategoryOutput, ValidationError>
{
    private readonly ruleCategoryRepository: IRuleCategoryRepository

    /**
     * Creates use case instance.
     *
     * @param dependencies Use case dependencies.
     */
    public constructor(dependencies: IDeleteRuleCategoryUseCaseDependencies) {
        this.ruleCategoryRepository = dependencies.ruleCategoryRepository
    }

    /**
     * Deletes rule category.
     *
     * @param input Request payload.
     * @returns Deleted id payload.
     */
    public async execute(
        input: IRuleCategoryIdInput,
    ): Promise<Result<IDeleteRuleCategoryOutput, ValidationError>> {
        const fields = this.validateInput(input)
        if (fields.length > 0) {
            return Result.fail<IDeleteRuleCategoryOutput, ValidationError>(
                new ValidationError("Rule category delete validation failed", fields),
            )
        }

        const categoryId = UniqueId.create(input.categoryId.trim())
        const existing = await this.ruleCategoryRepository.findById(categoryId)
        if (existing === null) {
            return Result.fail<IDeleteRuleCategoryOutput, ValidationError>(
                new ValidationError("Rule category delete validation failed", [
                    {
                        field: "categoryId",
                        message: "category not found",
                    },
                ]),
            )
        }

        await this.ruleCategoryRepository.deleteById(categoryId)

        return Result.ok<IDeleteRuleCategoryOutput, ValidationError>({
            categoryId: categoryId.value,
        })
    }

    private validateInput(input: IRuleCategoryIdInput): IValidationErrorField[] {
        if (typeof input.categoryId !== "string" || input.categoryId.trim().length === 0) {
            return [
                {
                    field: "categoryId",
                    message: "must be a non-empty string",
                },
            ]
        }

        return []
    }
}
