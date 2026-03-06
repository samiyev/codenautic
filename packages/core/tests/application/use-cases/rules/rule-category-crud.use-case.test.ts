import {describe, expect, test} from "bun:test"

import {CreateRuleCategoryUseCase} from "../../../../src/application/use-cases/rules/create-rule-category.use-case"
import {UpdateRuleCategoryUseCase} from "../../../../src/application/use-cases/rules/update-rule-category.use-case"
import {DeleteRuleCategoryUseCase} from "../../../../src/application/use-cases/rules/delete-rule-category.use-case"
import {ListRuleCategoriesUseCase} from "../../../../src/application/use-cases/rules/list-rule-categories.use-case"
import {RuleCategoryFactory} from "../../../../src/domain/factories/rule-category.factory"
import {ValidationError} from "../../../../src/domain/errors/validation.error"
import type {RuleCategory} from "../../../../src/domain/entities/rule-category.entity"
import type {UniqueId} from "../../../../src/domain/value-objects/unique-id.value-object"
import type {IRuleCategoryRepository} from "../../../../src/application/ports/outbound/rule/rule-category-repository.port"

class InMemoryRuleCategoryRepository implements IRuleCategoryRepository {
    private readonly byId = new Map<string, RuleCategory>()
    private readonly bySlug = new Map<string, RuleCategory>()

    public findById(id: UniqueId): Promise<RuleCategory | null> {
        return Promise.resolve(this.byId.get(id.value) ?? null)
    }

    public save(category: RuleCategory): Promise<void> {
        this.byId.set(category.id.value, category)
        this.bySlug.set(category.slug, category)
        return Promise.resolve()
    }

    public findBySlug(slug: string): Promise<RuleCategory | null> {
        return Promise.resolve(this.bySlug.get(slug) ?? null)
    }

    public findAll(): Promise<readonly RuleCategory[]> {
        return Promise.resolve([...this.byId.values()])
    }

    public findActive(): Promise<readonly RuleCategory[]> {
        return Promise.resolve([...this.byId.values()].filter((category) => category.isActive))
    }

    public findAllWithWeights(): Promise<readonly {slug: string; weight: number}[]> {
        return Promise.resolve(
            [...this.byId.values()].map((category) => {
                return {
                    slug: category.slug,
                    weight: category.weight,
                }
            }),
        )
    }

    public saveMany(categories: readonly RuleCategory[]): Promise<void> {
        for (const category of categories) {
            this.byId.set(category.id.value, category)
            this.bySlug.set(category.slug, category)
        }
        return Promise.resolve()
    }

    public deleteById(id: UniqueId): Promise<void> {
        const existing = this.byId.get(id.value)
        if (existing !== undefined) {
            this.byId.delete(id.value)
            this.bySlug.delete(existing.slug)
        }
        return Promise.resolve()
    }
}

function buildCategory(factory: RuleCategoryFactory, slug: string): RuleCategory {
    return factory.create({
        slug,
        name: slug.replace(/-/g, " ").trim(),
        description: `Category for ${slug}`,
        weight: 1,
        isActive: true,
    })
}

describe("CreateRuleCategoryUseCase", () => {
    test("creates rule category", async () => {
        const repository = new InMemoryRuleCategoryRepository()
        const useCase = new CreateRuleCategoryUseCase({
            ruleCategoryRepository: repository,
            ruleCategoryFactory: new RuleCategoryFactory(),
        })

        const result = await useCase.execute({
            slug: "security-hardening",
            name: "Security",
            description: "Security checks",
            weight: 2,
            isActive: true,
        })

        expect(result.isOk).toBe(true)
        if (result.isFail) {
            throw new Error("Expected create rule category success")
        }

        expect(result.value.category.slug).toBe("security-hardening")
        const stored = await repository.findBySlug("security-hardening")
        expect(stored).not.toBeNull()
    })

    test("rejects duplicate slug", async () => {
        const repository = new InMemoryRuleCategoryRepository()
        const factory = new RuleCategoryFactory()
        await repository.save(buildCategory(factory, "security-hardening"))

        const useCase = new CreateRuleCategoryUseCase({
            ruleCategoryRepository: repository,
            ruleCategoryFactory: factory,
        })

        const result = await useCase.execute({
            slug: "security-hardening",
            name: "Security",
            description: "Duplicate",
        })

        expect(result.isFail).toBe(true)
        expect(result.error.fields).toEqual([
            {
                field: "slug",
                message: "category with the same slug already exists",
            },
        ])
    })

    test("maps factory validation errors to fields", async () => {
        const repository = new InMemoryRuleCategoryRepository()
        const useCase = new CreateRuleCategoryUseCase({
            ruleCategoryRepository: repository,
            ruleCategoryFactory: new RuleCategoryFactory(),
        })

        const result = await useCase.execute({
            slug: "Bad Slug",
            name: "Bad",
            description: "Invalid slug",
        })

        expect(result.isFail).toBe(true)
        expect(result.error.fields[0]?.field).toBe("slug")
    })
})

describe("UpdateRuleCategoryUseCase", () => {
    test("updates rule category fields", async () => {
        const repository = new InMemoryRuleCategoryRepository()
        const factory = new RuleCategoryFactory()
        const category = buildCategory(factory, "performance-efficiency")
        await repository.save(category)

        const useCase = new UpdateRuleCategoryUseCase({
            ruleCategoryRepository: repository,
            ruleCategoryFactory: factory,
        })

        const result = await useCase.execute({
            categoryId: category.id.value,
            name: "Performance",
            weight: 3.5,
            isActive: false,
        })

        expect(result.isOk).toBe(true)
        if (result.isFail) {
            throw new Error("Expected update rule category success")
        }

        expect(result.value.category.name).toBe("Performance")
        expect(result.value.category.weight).toBe(3.5)
        expect(result.value.category.isActive).toBe(false)
    })

    test("rejects slug conflicts", async () => {
        const repository = new InMemoryRuleCategoryRepository()
        const factory = new RuleCategoryFactory()
        const first = buildCategory(factory, "security-hardening")
        const second = buildCategory(factory, "maintenance")
        await repository.save(first)
        await repository.save(second)

        const useCase = new UpdateRuleCategoryUseCase({
            ruleCategoryRepository: repository,
            ruleCategoryFactory: factory,
        })

        const result = await useCase.execute({
            categoryId: second.id.value,
            slug: "security-hardening",
        })

        expect(result.isFail).toBe(true)
        expect(result.error.fields).toEqual([
            {
                field: "slug",
                message: "category with the same slug already exists",
            },
        ])
    })

    test("maps factory validation errors", async () => {
        const repository = new InMemoryRuleCategoryRepository()
        const factory = new RuleCategoryFactory()
        const category = buildCategory(factory, "security-hardening")
        await repository.save(category)

        const useCase = new UpdateRuleCategoryUseCase({
            ruleCategoryRepository: repository,
            ruleCategoryFactory: factory,
        })

        const result = await useCase.execute({
            categoryId: category.id.value,
            slug: "Bad Slug",
        })

        expect(result.isFail).toBe(true)
        expect(result.error.fields[0]?.field).toBe("slug")
    })

    test("returns validation error when no fields provided", async () => {
        const repository = new InMemoryRuleCategoryRepository()
        const factory = new RuleCategoryFactory()
        const category = buildCategory(factory, "maintainability")
        await repository.save(category)

        const useCase = new UpdateRuleCategoryUseCase({
            ruleCategoryRepository: repository,
            ruleCategoryFactory: factory,
        })

        const result = await useCase.execute({
            categoryId: category.id.value,
        })

        expect(result.isFail).toBe(true)
        expect(result.error).toBeInstanceOf(ValidationError)
        expect(result.error.fields).toEqual([
            {
                field: "category",
                message: "at least one field must be provided",
            },
        ])
    })

    test("returns not found when category missing", async () => {
        const useCase = new UpdateRuleCategoryUseCase({
            ruleCategoryRepository: new InMemoryRuleCategoryRepository(),
            ruleCategoryFactory: new RuleCategoryFactory(),
        })

        const result = await useCase.execute({
            categoryId: "missing-id",
            name: "Whatever",
        })

        expect(result.isFail).toBe(true)
        expect(result.error.fields).toEqual([
            {
                field: "categoryId",
                message: "category not found",
            },
        ])
    })
})

describe("ListRuleCategoriesUseCase", () => {
    test("lists rule categories", async () => {
        const repository = new InMemoryRuleCategoryRepository()
        const factory = new RuleCategoryFactory()
        await repository.save(buildCategory(factory, "security-hardening"))
        await repository.save(buildCategory(factory, "performance-efficiency"))

        const useCase = new ListRuleCategoriesUseCase({
            ruleCategoryRepository: repository,
        })

        const result = await useCase.execute({})

        expect(result.isOk).toBe(true)
        if (result.isFail) {
            throw new Error("Expected list rule categories success")
        }

        expect(result.value.total).toBe(2)
        expect(result.value.categories).toHaveLength(2)
    })
})

describe("DeleteRuleCategoryUseCase", () => {
    test("deletes category", async () => {
        const repository = new InMemoryRuleCategoryRepository()
        const factory = new RuleCategoryFactory()
        const category = buildCategory(factory, "obsolete")
        await repository.save(category)

        const useCase = new DeleteRuleCategoryUseCase({
            ruleCategoryRepository: repository,
        })

        const result = await useCase.execute({
            categoryId: category.id.value,
        })

        expect(result.isOk).toBe(true)
        expect(result.value.categoryId).toBe(category.id.value)
        expect(await repository.findById(category.id)).toBeNull()
    })

    test("returns not found when deleting missing category", async () => {
        const useCase = new DeleteRuleCategoryUseCase({
            ruleCategoryRepository: new InMemoryRuleCategoryRepository(),
        })

        const result = await useCase.execute({
            categoryId: "missing-id",
        })

        expect(result.isFail).toBe(true)
        expect(result.error.fields).toEqual([
            {
                field: "categoryId",
                message: "category not found",
            },
        ])
    })
})
