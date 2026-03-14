import {
    REVIEW_ISSUE_TICKET_STATUS,
    UniqueId,
    type IReviewIssueTicketRepository,
    type IReviewRepository,
} from "@codenautic/core"

import type {IReviewIssueTicketSchema} from "../schemas/review-issue-ticket.schema"
import type {
    IMongoModel,
    IMongoRepositoryFactory,
} from "./mongo-repository.types"

type ReviewIssueTicketEntity = Parameters<IReviewIssueTicketRepository["save"]>[0]
type ReviewIssueTicketIdentifier = Parameters<IReviewIssueTicketRepository["findById"]>[0]

/**
 * Constructor options for Mongo review issue ticket repository.
 */
export interface IMongoReviewIssueTicketRepositoryOptions {
    /**
     * Mongo model/collection abstraction.
     */
    readonly model: IMongoModel<IReviewIssueTicketSchema>

    /**
     * Entity-document conversion factory.
     */
    readonly factory: IMongoRepositoryFactory<
        ReviewIssueTicketEntity,
        IReviewIssueTicketSchema
    >

    /**
     * Review repository used for repository scope lookups.
     */
    readonly reviewRepository: IReviewRepository
}

/**
 * MongoDB implementation of review issue ticket repository port.
 */
export class MongoReviewIssueTicketRepository implements IReviewIssueTicketRepository {
    private readonly model: IMongoModel<IReviewIssueTicketSchema>
    private readonly factory: IMongoRepositoryFactory<
        ReviewIssueTicketEntity,
        IReviewIssueTicketSchema
    >
    private readonly reviewRepository: IReviewRepository

    /**
     * Creates repository instance.
     *
     * @param options Repository dependencies.
     */
    public constructor(options: IMongoReviewIssueTicketRepositoryOptions) {
        this.model = options.model
        this.factory = options.factory
        this.reviewRepository = options.reviewRepository
    }

    /**
     * Finds ticket by identifier.
     *
     * @param id Ticket identifier.
     * @returns Ticket or null.
     */
    public async findById(
        id: ReviewIssueTicketIdentifier,
    ): ReturnType<IReviewIssueTicketRepository["findById"]> {
        const document = await this.model.findOne({
            _id: id.value,
        })
        if (document === null) {
            return null
        }

        return this.factory.toEntity(document)
    }

    /**
     * Saves ticket entity with upsert semantics.
     *
     * @param ticket Ticket entity.
     */
    public async save(
        ticket: ReviewIssueTicketEntity,
    ): ReturnType<IReviewIssueTicketRepository["save"]> {
        const document = this.factory.toDocument(ticket)
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
     * Finds tickets by file path.
     *
     * @param path File path value object.
     * @returns Matched tickets.
     */
    public async findByFilePath(
        path: Parameters<IReviewIssueTicketRepository["findByFilePath"]>[0],
    ): ReturnType<IReviewIssueTicketRepository["findByFilePath"]> {
        const documents = await this.model.find({
            filePath: path.toString(),
        })

        return documents.map((document): ReviewIssueTicketEntity => {
            return this.factory.toEntity(document)
        })
    }

    /**
     * Finds open tickets that belong to repository by resolving source review.
     *
     * @param repositoryId Repository identifier.
     * @returns Matched open tickets.
     */
    public async findOpenByRepository(
        repositoryId: string,
    ): ReturnType<IReviewIssueTicketRepository["findOpenByRepository"]> {
        const documents = await this.model.find({
            status: REVIEW_ISSUE_TICKET_STATUS.IN_PROGRESS,
        })

        const matchedTickets: ReviewIssueTicketEntity[] = []
        const reviewScopeCache = new Map<string, string | null>()

        for (const document of documents) {
            const scopedRepositoryId = await this.resolveTicketRepositoryId(
                document.sourceReviewId,
                reviewScopeCache,
            )
            if (scopedRepositoryId === repositoryId) {
                matchedTickets.push(this.factory.toEntity(document))
            }
        }

        return matchedTickets
    }

    /**
     * Finds ticket by source suggestion identifier.
     *
     * @param suggestionId Source suggestion identifier.
     * @returns Ticket or null.
     */
    public async findBySuggestionId(
        suggestionId: string,
    ): ReturnType<IReviewIssueTicketRepository["findBySuggestionId"]> {
        const document = await this.model.findOne({
            sourceSuggestionIds: suggestionId,
        })
        if (document === null) {
            return null
        }

        return this.factory.toEntity(document)
    }

    /**
     * Resolves repository id for review ticket source review.
     *
     * @param sourceReviewId Source review identifier.
     * @param cache Shared cache map.
     * @returns Repository id or null.
     */
    private async resolveTicketRepositoryId(
        sourceReviewId: string,
        cache: Map<string, string | null>,
    ): Promise<string | null> {
        const cachedRepositoryId = cache.get(sourceReviewId)
        if (cachedRepositoryId !== undefined) {
            return cachedRepositoryId
        }

        let repositoryId: string | null = null
        try {
            const review = await this.reviewRepository.findById(
                UniqueId.create(sourceReviewId),
            )
            if (review !== null) {
                repositoryId = review.repositoryId
            }
        } catch {
            repositoryId = null
        }

        cache.set(sourceReviewId, repositoryId)
        return repositoryId
    }
}
