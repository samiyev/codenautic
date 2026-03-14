import type {IRuleRepository} from "@codenautic/core"

import type {IRuleSchema} from "../schemas/rule.schema"
import type {
    IMongoModel,
    IMongoRepositoryFactory,
} from "./mongo-repository.types"

type RuleEntity = Parameters<IRuleRepository["save"]>[0]
type RuleIdentifier = Parameters<IRuleRepository["findById"]>[0]
type RuleStatus = Parameters<IRuleRepository["findByStatus"]>[0]

/**
 * Constructor options for Mongo rule repository.
 */
export interface IMongoRuleRepositoryOptions {
    /**
     * Mongo model/collection abstraction.
     */
    readonly model: IMongoModel<IRuleSchema>

    /**
     * Entity-document conversion factory.
     */
    readonly factory: IMongoRepositoryFactory<RuleEntity, IRuleSchema>
}

/**
 * MongoDB implementation of rule repository port.
 */
export class MongoRuleRepository implements IRuleRepository {
    private readonly model: IMongoModel<IRuleSchema>
    private readonly factory: IMongoRepositoryFactory<RuleEntity, IRuleSchema>

    /**
     * Creates repository instance.
     *
     * @param options Repository dependencies.
     */
    public constructor(options: IMongoRuleRepositoryOptions) {
        this.model = options.model
        this.factory = options.factory
    }

    /**
     * Finds rule by identifier.
     *
     * @param id Rule identifier.
     * @returns Rule or null.
     */
    public async findById(
        id: RuleIdentifier,
    ): ReturnType<IRuleRepository["findById"]> {
        const document = await this.model.findOne({
            _id: id.value,
        })
        if (document === null) {
            return null
        }

        return this.factory.toEntity(document)
    }

    /**
     * Saves rule aggregate with upsert semantics.
     *
     * @param rule Rule entity.
     */
    public async save(rule: RuleEntity): ReturnType<IRuleRepository["save"]> {
        const document = this.factory.toDocument(rule)
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
     * Finds rules by lifecycle status.
     *
     * @param status Rule status.
     * @returns Matched rules.
     */
    public async findByStatus(
        status: RuleStatus,
    ): ReturnType<IRuleRepository["findByStatus"]> {
        const documents = await this.model.find({
            status,
        })

        return documents.map((document): RuleEntity => {
            return this.factory.toEntity(document)
        })
    }
}
