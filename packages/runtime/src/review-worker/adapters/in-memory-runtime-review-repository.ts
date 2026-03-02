import type {IReviewRepository, Review, ReviewStatus, UniqueId} from "@codenautic/core"

/**
 * In-memory review repository used by runtime bootstrap and integration tests.
 */
export class InMemoryRuntimeReviewRepository implements IReviewRepository {
    private readonly store: Map<string, Review>

    /**
     * Creates repository with optional preloaded reviews.
     *
     * @param initialReviews Initial review aggregates.
     */
    public constructor(initialReviews: readonly Review[] = []) {
        this.store = new Map(initialReviews.map((review) => [review.id.value, review]))
    }

    /**
     * Finds review by id.
     *
     * @param id Review id.
     * @returns Review aggregate or null.
     */
    public findById(id: UniqueId): Promise<Review | null> {
        return Promise.resolve(this.store.get(id.value) ?? null)
    }

    /**
     * Saves review aggregate snapshot.
     *
     * @param review Review aggregate.
     * @returns Promise resolved after save.
     */
    public save(review: Review): Promise<void> {
        this.store.set(review.id.value, review)
        return Promise.resolve()
    }

    /**
     * Finds review by merge request id.
     *
     * @param mergeRequestId Merge request identifier.
     * @returns Review aggregate or null.
     */
    public findByMergeRequestId(mergeRequestId: string): Promise<Review | null> {
        for (const review of this.store.values()) {
            if (review.mergeRequestId === mergeRequestId) {
                return Promise.resolve(review)
            }
        }

        return Promise.resolve(null)
    }

    /**
     * Finds reviews by lifecycle status.
     *
     * @param status Review lifecycle status.
     * @returns Matching review list.
     */
    public findByStatus(status: ReviewStatus): Promise<readonly Review[]> {
        return Promise.resolve(
            [...this.store.values()].filter((review) => {
                return review.status === status
            }),
        )
    }

    /**
     * Finds reviews completed within date range (inclusive).
     *
     * @param from Range start.
     * @param to Range end.
     * @returns Matching review list.
     */
    public findByDateRange(from: Date, to: Date): Promise<readonly Review[]> {
        return Promise.resolve(
            [...this.store.values()].filter((review) => {
                const completedAt = review.completedAt
                if (completedAt === null) {
                    return false
                }

                return completedAt >= from && completedAt <= to
            }),
        )
    }

    /**
     * Finds reviews by repository identifier.
     *
     * @param repositoryId Repository identifier.
     * @returns Matching review list.
     */
    public findByRepositoryId(repositoryId: string): Promise<readonly Review[]> {
        return Promise.resolve(
            [...this.store.values()].filter((review) => {
                return review.repositoryId === repositoryId
            }),
        )
    }
}
