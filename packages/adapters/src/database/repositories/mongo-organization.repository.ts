import type {IOrganizationRepository} from "@codenautic/core"

import type {IOrganizationSchema} from "../schemas/organization.schema"
import type {
    IMongoModel,
    IMongoRepositoryFactory,
} from "./mongo-repository.types"

type OrganizationEntity = Parameters<IOrganizationRepository["save"]>[0]
type OrganizationIdentifier = Parameters<IOrganizationRepository["findById"]>[0]
type OrganizationOwnerId = Parameters<IOrganizationRepository["findByOwnerId"]>[0]

/**
 * Constructor options for Mongo organization repository.
 */
export interface IMongoOrganizationRepositoryOptions {
    /**
     * Mongo model/collection abstraction.
     */
    readonly model: IMongoModel<IOrganizationSchema>

    /**
     * Entity-document conversion factory.
     */
    readonly factory: IMongoRepositoryFactory<OrganizationEntity, IOrganizationSchema>
}

/**
 * MongoDB implementation of organization repository port.
 */
export class MongoOrganizationRepository implements IOrganizationRepository {
    private readonly model: IMongoModel<IOrganizationSchema>
    private readonly factory: IMongoRepositoryFactory<OrganizationEntity, IOrganizationSchema>

    /**
     * Creates repository instance.
     *
     * @param options Repository dependencies.
     */
    public constructor(options: IMongoOrganizationRepositoryOptions) {
        this.model = options.model
        this.factory = options.factory
    }

    /**
     * Finds organization by identifier.
     *
     * @param id Organization identifier.
     * @returns Organization or null.
     */
    public async findById(
        id: OrganizationIdentifier,
    ): ReturnType<IOrganizationRepository["findById"]> {
        const document = await this.model.findOne({
            _id: id.value,
        })
        if (document === null) {
            return null
        }

        return this.factory.toEntity(document)
    }

    /**
     * Saves organization with upsert semantics.
     *
     * @param organization Organization aggregate.
     */
    public async save(
        organization: OrganizationEntity,
    ): ReturnType<IOrganizationRepository["save"]> {
        const document = this.factory.toDocument(organization)
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
     * Finds organizations by owner identifier.
     *
     * @param ownerId Owner identifier.
     * @returns Matched organizations.
     */
    public async findByOwnerId(
        ownerId: OrganizationOwnerId,
    ): ReturnType<IOrganizationRepository["findByOwnerId"]> {
        const documents = await this.model.find({
            ownerId: ownerId.value,
        })
        return documents.map((document): OrganizationEntity => {
            return this.factory.toEntity(document)
        })
    }
}
