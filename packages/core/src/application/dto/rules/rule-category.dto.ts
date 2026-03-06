import type {RuleCategory} from "../../../domain/entities/rule-category.entity"

/**
 * Rule category DTO for admin API boundaries.
 */
export interface IRuleCategoryDTO {
    readonly id: string
    readonly slug: string
    readonly name: string
    readonly description: string
    readonly weight: number
    readonly isActive: boolean
}

/**
 * Input payload for rule category creation.
 */
export interface ICreateRuleCategoryInput {
    readonly slug: string
    readonly name: string
    readonly description: string
    readonly weight?: number
    readonly isActive?: boolean
}

/**
 * Output payload for rule category creation.
 */
export interface ICreateRuleCategoryOutput {
    readonly category: IRuleCategoryDTO
}

/**
 * Input payload for rule category updates.
 */
export interface IUpdateRuleCategoryInput {
    readonly categoryId: string
    readonly slug?: string
    readonly name?: string
    readonly description?: string
    readonly weight?: number
    readonly isActive?: boolean
}

/**
 * Output payload for rule category updates.
 */
export interface IUpdateRuleCategoryOutput {
    readonly category: IRuleCategoryDTO
}

/**
 * Input payload for rule category lookup/delete.
 */
export interface IRuleCategoryIdInput {
    readonly categoryId: string
}

/**
 * Output payload for rule category delete.
 */
export interface IDeleteRuleCategoryOutput {
    readonly categoryId: string
}

/**
 * Input payload for rule category list.
 */
export interface IListRuleCategoriesInput {
}

/**
 * Output payload for rule category list.
 */
export interface IListRuleCategoriesOutput {
    readonly categories: readonly IRuleCategoryDTO[]
    readonly total: number
}

/**
 * Maps rule category entity to DTO.
 *
 * @param category Domain entity.
 * @returns DTO payload.
 */
export function mapRuleCategoryToDTO(category: RuleCategory): IRuleCategoryDTO {
    return {
        id: category.id.value,
        slug: category.slug,
        name: category.name,
        description: category.description,
        weight: category.weight,
        isActive: category.isActive,
    }
}
