import type {IPromptConfigurationRepository} from "@codenautic/core"

import type {IPromptConfigurationSchema} from "../schemas/prompt-configuration.schema"
import type {
    IMongoModel,
    IMongoRepositoryFactory,
} from "./mongo-repository.types"

type PromptConfigurationEntity = Parameters<IPromptConfigurationRepository["save"]>[0]
type PromptConfigurationOrganizationId = Parameters<
    IPromptConfigurationRepository["findByName"]
>[1]

/**
 * Constructor options for Mongo prompt configuration repository.
 */
export interface IMongoPromptConfigurationRepositoryOptions {
    /**
     * Mongo model/collection abstraction.
     */
    readonly model: IMongoModel<IPromptConfigurationSchema>

    /**
     * Entity-document conversion factory.
     */
    readonly factory: IMongoRepositoryFactory<
        PromptConfigurationEntity,
        IPromptConfigurationSchema
    >
}

/**
 * MongoDB implementation of prompt configuration repository port.
 */
export class MongoPromptConfigurationRepository implements IPromptConfigurationRepository {
    private readonly model: IMongoModel<IPromptConfigurationSchema>
    private readonly factory: IMongoRepositoryFactory<
        PromptConfigurationEntity,
        IPromptConfigurationSchema
    >

    /**
     * Creates repository instance.
     *
     * @param options Repository dependencies.
     */
    public constructor(options: IMongoPromptConfigurationRepositoryOptions) {
        this.model = options.model
        this.factory = options.factory
    }

    /**
     * Finds configuration by template identifier.
     *
     * @param templateId Template identifier.
     * @returns Configuration or null.
     */
    public async findByTemplateId(
        templateId: string,
    ): ReturnType<IPromptConfigurationRepository["findByTemplateId"]> {
        const document = await this.model.findOne({
            templateId,
        })
        if (document === null) {
            return null
        }

        return this.factory.toEntity(document)
    }

    /**
     * Finds configuration by name with optional org-first fallback.
     *
     * @param name Configuration name.
     * @param organizationId Optional organization scope.
     * @returns Configuration or null.
     */
    public async findByName(
        name: string,
        organizationId?: PromptConfigurationOrganizationId,
    ): ReturnType<IPromptConfigurationRepository["findByName"]> {
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
     * Saves configuration with upsert semantics.
     *
     * @param configuration Configuration entity.
     */
    public async save(
        configuration: PromptConfigurationEntity,
    ): ReturnType<IPromptConfigurationRepository["save"]> {
        const document = this.factory.toDocument(configuration)
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
     * Deletes configuration by identifier.
     *
     * @param id Configuration identifier.
     */
    public async delete(
        id: string,
    ): ReturnType<IPromptConfigurationRepository["delete"]> {
        await this.model.deleteOne({
            _id: id,
        })
    }
}
