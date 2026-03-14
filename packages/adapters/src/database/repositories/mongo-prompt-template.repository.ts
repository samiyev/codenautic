import type {IPromptTemplateRepository} from "@codenautic/core"

import type {IPromptTemplateSchema} from "../schemas/prompt-template.schema"
import type {
    IMongoModel,
    IMongoRepositoryFactory,
} from "./mongo-repository.types"

type PromptTemplateEntity = Parameters<IPromptTemplateRepository["save"]>[0]
type PromptTemplateIdentifier = Parameters<IPromptTemplateRepository["findById"]>[0]
type PromptTemplateCategory = Parameters<IPromptTemplateRepository["findByCategory"]>[0]
type PromptTemplateOrganizationId = Parameters<IPromptTemplateRepository["findByName"]>[1]

/**
 * Constructor options for Mongo prompt template repository.
 */
export interface IMongoPromptTemplateRepositoryOptions {
    /**
     * Mongo model/collection abstraction.
     */
    readonly model: IMongoModel<IPromptTemplateSchema>

    /**
     * Entity-document conversion factory.
     */
    readonly factory: IMongoRepositoryFactory<PromptTemplateEntity, IPromptTemplateSchema>
}

/**
 * MongoDB implementation of prompt template repository port.
 */
export class MongoPromptTemplateRepository implements IPromptTemplateRepository {
    private readonly model: IMongoModel<IPromptTemplateSchema>
    private readonly factory: IMongoRepositoryFactory<PromptTemplateEntity, IPromptTemplateSchema>

    /**
     * Creates repository instance.
     *
     * @param options Repository dependencies.
     */
    public constructor(options: IMongoPromptTemplateRepositoryOptions) {
        this.model = options.model
        this.factory = options.factory
    }

    /**
     * Finds prompt template by identifier.
     *
     * @param id Template identifier.
     * @returns Template or null.
     */
    public async findById(
        id: PromptTemplateIdentifier,
    ): ReturnType<IPromptTemplateRepository["findById"]> {
        const document = await this.model.findOne({
            _id: id.value,
        })
        if (document === null) {
            return null
        }

        return this.factory.toEntity(document)
    }

    /**
     * Finds prompt template by name with optional org-first fallback strategy.
     *
     * @param name Template name.
     * @param organizationId Optional organization scope.
     * @returns Template or null.
     */
    public async findByName(
        name: string,
        organizationId?: PromptTemplateOrganizationId,
    ): ReturnType<IPromptTemplateRepository["findByName"]> {
        if (organizationId !== undefined) {
            const scopedDocument = await this.model.findOne({
                name,
                organizationId: organizationId.value,
            })
            if (scopedDocument !== null) {
                return this.factory.toEntity(scopedDocument)
            }
        }

        const globalDocument = await this.model.findOne({
            name,
            isGlobal: true,
        })
        if (globalDocument === null) {
            return null
        }

        return this.factory.toEntity(globalDocument)
    }

    /**
     * Finds templates by category.
     *
     * @param category Template category.
     * @returns Matching templates.
     */
    public async findByCategory(
        category: PromptTemplateCategory,
    ): ReturnType<IPromptTemplateRepository["findByCategory"]> {
        const documents = await this.model.find({
            category,
        })
        return documents.map((document): PromptTemplateEntity => {
            return this.factory.toEntity(document)
        })
    }

    /**
     * Finds global templates.
     *
     * @returns Matching templates.
     */
    public async findGlobal(): ReturnType<IPromptTemplateRepository["findGlobal"]> {
        const documents = await this.model.find({
            isGlobal: true,
        })
        return documents.map((document): PromptTemplateEntity => {
            return this.factory.toEntity(document)
        })
    }

    /**
     * Finds all templates.
     *
     * @returns Matching templates.
     */
    public async findAll(): ReturnType<IPromptTemplateRepository["findAll"]> {
        const documents = await this.model.find({})
        return documents.map((document): PromptTemplateEntity => {
            return this.factory.toEntity(document)
        })
    }

    /**
     * Saves prompt template with upsert semantics.
     *
     * @param template Template entity.
     */
    public async save(
        template: PromptTemplateEntity,
    ): ReturnType<IPromptTemplateRepository["save"]> {
        const document = this.factory.toDocument(template)
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
     * Deletes template by identifier.
     *
     * @param id Template identifier.
     */
    public async deleteById(
        id: PromptTemplateIdentifier,
    ): ReturnType<IPromptTemplateRepository["deleteById"]> {
        await this.model.deleteOne({
            _id: id.value,
        })
    }
}
