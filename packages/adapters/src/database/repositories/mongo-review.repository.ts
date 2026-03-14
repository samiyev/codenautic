import type {IReviewRepository} from "@codenautic/core"

import type {IReviewSchema} from "../schemas/review.schema"
import type {
    IMongoModel,
    IMongoRepositoryFactory,
} from "./mongo-repository.types"

type ReviewEntity = Parameters<IReviewRepository["save"]>[0]
type ReviewIdentifier = Parameters<IReviewRepository["findById"]>[0]
type ReviewStatus = Parameters<IReviewRepository["findByStatus"]>[0]

/**
 * Constructor options for Mongo review repository.
 */
export interface IMongoReviewRepositoryOptions {
    /**
     * Mongo model/collection abstraction.
     */
    readonly model: IMongoModel<IReviewSchema>

    /**
     * Entity-document conversion factory.
     */
    readonly factory: IMongoRepositoryFactory<ReviewEntity, IReviewSchema>
}

/**
 * MongoDB implementation of review repository port.
 */
export class MongoReviewRepository implements IReviewRepository {
    private readonly model: IMongoModel<IReviewSchema>
    private readonly factory: IMongoRepositoryFactory<ReviewEntity, IReviewSchema>

    /**
     * Creates repository instance.
     *
     * @param options Repository dependencies.
     */
    public constructor(options: IMongoReviewRepositoryOptions) {
        this.model = options.model
        this.factory = options.factory
    }

    /**
     * Finds review by unique identifier.
     *
     * @param id Review identifier.
     * @returns Review entity or null.
     */
    public async findById(
        id: ReviewIdentifier,
    ): ReturnType<IReviewRepository["findById"]> {
        const document = await this.model.findOne({
            _id: id.value,
        })
        if (document === null) {
            return null
        }

        return this.factory.toEntity(document)
    }

    /**
     * Saves review aggregate state with upsert semantics.
     *
     * @param review Review entity.
     */
    public async save(review: ReviewEntity): ReturnType<IReviewRepository["save"]> {
        const document = this.factory.toDocument(review)
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
     * Finds review by merge request id.
     *
     * @param mergeRequestId Merge request id.
     * @returns Review entity or null.
     */
    public async findByMergeRequestId(
        mergeRequestId: string,
    ): ReturnType<IReviewRepository["findByMergeRequestId"]> {
        const document = await this.model.findOne({
            mergeRequestId,
        })
        if (document === null) {
            return null
        }

        return this.factory.toEntity(document)
    }

    /**
     * Finds reviews by lifecycle status.
     *
     * @param status Review lifecycle status.
     * @returns Matched reviews.
     */
    public async findByStatus(
        status: ReviewStatus,
    ): ReturnType<IReviewRepository["findByStatus"]> {
        const documents = await this.model.find({
            status,
        })

        return documents.map((document): ReviewEntity => {
            return this.factory.toEntity(document)
        })
    }

    /**
     * Finds reviews by completion date range.
     *
     * @param from Range start.
     * @param to Range end.
     * @returns Matched reviews.
     */
    public async findByDateRange(
        from: Date,
        to: Date,
    ): ReturnType<IReviewRepository["findByDateRange"]> {
        const documents = await this.model.find({
            completedAt: {
                $gte: from,
                $lte: to,
            },
        })

        return documents.map((document): ReviewEntity => {
            return this.factory.toEntity(document)
        })
    }

    /**
     * Finds reviews by repository identifier.
     *
     * @param repositoryId Repository identifier.
     * @returns Matched reviews.
     */
    public async findByRepositoryId(
        repositoryId: string,
    ): ReturnType<IReviewRepository["findByRepositoryId"]> {
        const documents = await this.model.find({
            repositoryId,
        })

        return documents.map((document): ReviewEntity => {
            return this.factory.toEntity(document)
        })
    }
}
