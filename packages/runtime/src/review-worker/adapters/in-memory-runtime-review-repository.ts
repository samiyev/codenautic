import type {IReviewRepository, Review, UniqueId} from "@codenautic/core"

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
}
