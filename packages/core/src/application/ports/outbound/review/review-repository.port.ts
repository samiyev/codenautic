import type {Review, ReviewStatus} from "../../../../domain/aggregates/review.aggregate"
import type {IRepository} from "../common/repository.port"

/**
 * Outbound persistence contract for review aggregates.
 */
export interface IReviewRepository extends IRepository<Review> {
    /**
     * Finds review by merge request identifier.
     *
     * @param mergeRequestId Merge request identifier.
     * @returns Review aggregate or null.
     */
    findByMergeRequestId(mergeRequestId: string): Promise<Review | null>

    /**
     * Finds reviews by lifecycle status.
     *
     * @param status Review status.
     * @returns Matching review list.
     */
    findByStatus(status: ReviewStatus): Promise<readonly Review[]>

    /**
     * Finds reviews completed/updated within date range.
     *
     * @param from Range start.
     * @param to Range end.
     * @returns Matching review list.
     */
    findByDateRange(from: Date, to: Date): Promise<readonly Review[]>

    /**
     * Finds reviews by repository identifier.
     *
     * @param repositoryId Repository identifier.
     * @returns Matching review list.
     */
    findByRepositoryId(repositoryId: string): Promise<readonly Review[]>
}
