import type {IExpertPanelRepository} from "@codenautic/core"

import type {IExpertPanelSchema} from "../schemas/expert-panel.schema"
import type {
    IMongoModel,
    IMongoRepositoryFactory,
} from "./mongo-repository.types"

type ExpertPanelEntity = NonNullable<
    Awaited<ReturnType<IExpertPanelRepository["findByName"]>>
>

/**
 * Constructor options for Mongo expert panel repository.
 */
export interface IMongoExpertPanelRepositoryOptions {
    /**
     * Mongo model/collection abstraction.
     */
    readonly model: IMongoModel<IExpertPanelSchema>

    /**
     * Entity-document conversion factory.
     */
    readonly factory: IMongoRepositoryFactory<ExpertPanelEntity, IExpertPanelSchema>
}

/**
 * MongoDB implementation of expert panel repository port.
 */
export class MongoExpertPanelRepository implements IExpertPanelRepository {
    private readonly model: IMongoModel<IExpertPanelSchema>
    private readonly factory: IMongoRepositoryFactory<
        ExpertPanelEntity,
        IExpertPanelSchema
    >

    /**
     * Creates repository instance.
     *
     * @param options Repository dependencies.
     */
    public constructor(options: IMongoExpertPanelRepositoryOptions) {
        this.model = options.model
        this.factory = options.factory
    }

    /**
     * Finds expert panel by unique name.
     *
     * @param name Panel name.
     * @returns Expert panel or null.
     */
    public async findByName(
        name: string,
    ): ReturnType<IExpertPanelRepository["findByName"]> {
        const document = await this.model.findOne({
            name,
        })
        if (document === null) {
            return null
        }

        return this.factory.toEntity(document)
    }
}
