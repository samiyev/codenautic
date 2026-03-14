import type {IRuleCategoryRepository} from "@codenautic/core"

import type {IRuleCategorySchema} from "../schemas/rule-category.schema"
import type {
    IMongoModel,
    IMongoRepositoryFactory,
} from "./mongo-repository.types"

type RuleCategoryEntity = Parameters<IRuleCategoryRepository["save"]>[0]
type RuleCategoryIdentifier = Parameters<IRuleCategoryRepository["findById"]>[0]

/**
 * Constructor options for Mongo rule category repository.
 */
export interface IMongoRuleCategoryRepositoryOptions {
    /**
     * Mongo model/collection abstraction.
     */
    readonly model: IMongoModel<IRuleCategorySchema>

    /**
     * Entity-document conversion factory.
     */
    readonly factory: IMongoRepositoryFactory<RuleCategoryEntity, IRuleCategorySchema>
}

/**
 * MongoDB implementation of rule category repository port.
 */
export class MongoRuleCategoryRepository implements IRuleCategoryRepository {
    private readonly model: IMongoModel<IRuleCategorySchema>
    private readonly factory: IMongoRepositoryFactory<RuleCategoryEntity, IRuleCategorySchema>

    /**
     * Creates repository instance.
     *
     * @param options Repository dependencies.
     */
    public constructor(options: IMongoRuleCategoryRepositoryOptions) {
        this.model = options.model
        this.factory = options.factory
    }

    /**
     * Finds category by identifier.
     *
     * @param id Category identifier.
     * @returns Category or null.
     */
    public async findById(
        id: RuleCategoryIdentifier,
    ): ReturnType<IRuleCategoryRepository["findById"]> {
        const document = await this.model.findOne({
            _id: id.value,
        })
        if (document === null) {
            return null
        }

        return this.factory.toEntity(document)
    }

    /**
     * Saves category entity with upsert semantics.
     *
     * @param category Category entity.
     */
    public async save(
        category: RuleCategoryEntity,
    ): ReturnType<IRuleCategoryRepository["save"]> {
        const document = this.factory.toDocument(category)
        await this.model.replaceOne(
            {
                _id: document._id,
            },
            document,
            {
                upsert: true,
            },
        )
    }

    /**
     * Finds category by stable slug.
     *
     * @param slug Category slug.
     * @returns Category or null.
     */
    public async findBySlug(
        slug: string,
    ): ReturnType<IRuleCategoryRepository["findBySlug"]> {
        const document = await this.model.findOne({
            slug,
        })
        if (document === null) {
            return null
        }

        return this.factory.toEntity(document)
    }

    /**
     * Loads all categories.
     *
     * @returns All categories.
     */
    public async findAll(): ReturnType<IRuleCategoryRepository["findAll"]> {
        const documents = await this.model.find({})
        return documents.map((document): RuleCategoryEntity => {
            return this.factory.toEntity(document)
        })
    }

    /**
     * Loads active categories only.
     *
     * @returns Active categories.
     */
    public async findActive(): ReturnType<IRuleCategoryRepository["findActive"]> {
        const documents = await this.model.find({
            isActive: true,
        })
        return documents.map((document): RuleCategoryEntity => {
            return this.factory.toEntity(document)
        })
    }

    /**
     * Loads slug-weight pairs for scoring.
     *
     * @returns Category weights list.
     */
    public async findAllWithWeights(): ReturnType<IRuleCategoryRepository["findAllWithWeights"]> {
        const documents = await this.model.find({})
        return documents.map((document): {slug: string; weight: number} => {
            return {
                slug: document.slug,
                weight: document.weight,
            }
        })
    }

    /**
     * Saves multiple categories as upserts.
     *
     * @param categories Categories to persist.
     */
    public async saveMany(
        categories: readonly RuleCategoryEntity[],
    ): ReturnType<IRuleCategoryRepository["saveMany"]> {
        for (const category of categories) {
            await this.save(category)
        }
    }

    /**
     * Deletes category by identifier.
     *
     * @param id Category identifier.
     */
    public async deleteById(
        id: RuleCategoryIdentifier,
    ): ReturnType<IRuleCategoryRepository["deleteById"]> {
        await this.model.deleteOne({
            _id: id.value,
        })
    }
}
