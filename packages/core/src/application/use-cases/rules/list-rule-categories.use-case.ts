import {ValidationError} from "../../../domain/errors/validation.error"
import type {IUseCase} from "../../ports/inbound/use-case.port"
import type {IRuleCategoryRepository} from "../../ports/outbound/rule/rule-category-repository.port"
import {
    type IListRuleCategoriesInput,
    type IListRuleCategoriesOutput,
    mapRuleCategoryToDTO,
} from "../../dto/rules/rule-category.dto"
import {Result} from "../../../shared/result"

/**
 * Dependencies for rule category listing.
 */
export interface IListRuleCategoriesUseCaseDependencies {
    readonly ruleCategoryRepository: IRuleCategoryRepository
}

/**
 * Lists rule categories for admin API.
 */
export class ListRuleCategoriesUseCase
    implements IUseCase<IListRuleCategoriesInput, IListRuleCategoriesOutput, ValidationError>
{
    private readonly ruleCategoryRepository: IRuleCategoryRepository

    /**
     * Creates use case instance.
     *
     * @param dependencies Use case dependencies.
     */
    public constructor(dependencies: IListRuleCategoriesUseCaseDependencies) {
        this.ruleCategoryRepository = dependencies.ruleCategoryRepository
    }

    /**
     * Lists all rule categories.
     *
     * @param _input Request payload.
     * @returns List payload.
     */
    public async execute(
        _input: IListRuleCategoriesInput,
    ): Promise<Result<IListRuleCategoriesOutput, ValidationError>> {
        const categories = await this.ruleCategoryRepository.findAll()
        const mapped = categories.map((category) => mapRuleCategoryToDTO(category))

        return Result.ok<IListRuleCategoriesOutput, ValidationError>({
            categories: mapped,
            total: mapped.length,
        })
    }
}
