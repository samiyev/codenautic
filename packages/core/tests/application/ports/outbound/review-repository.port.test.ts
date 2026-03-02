import {describe, expect, test} from "bun:test"

import type {IReviewRepository} from "../../../../src/application/ports/outbound/review/review-repository.port"
import {REVIEW_STATUS, type Review, type ReviewStatus} from "../../../../src/domain/aggregates/review.aggregate"
import {ReviewFactory} from "../../../../src/domain/factories/review.factory"
import {UniqueId} from "../../../../src/domain/value-objects/unique-id.value-object"

class InMemoryReviewRepository implements IReviewRepository {
    private readonly storage: Map<string, Review>

    public constructor() {
        this.storage = new Map<string, Review>()
    }

    public findById(id: UniqueId): Promise<Review | null> {
        return Promise.resolve(this.storage.get(id.value) ?? null)
    }

    public save(review: Review): Promise<void> {
        this.storage.set(review.id.value, review)
        return Promise.resolve()
    }

    public findByMergeRequestId(mergeRequestId: string): Promise<Review | null> {
        for (const review of this.storage.values()) {
            if (review.mergeRequestId === mergeRequestId) {
                return Promise.resolve(review)
            }
        }

        return Promise.resolve(null)
    }

    public findByStatus(status: ReviewStatus): Promise<readonly Review[]> {
        return Promise.resolve(
            [...this.storage.values()].filter((review) => {
                return review.status === status
            }),
        )
    }

    public findByDateRange(from: Date, to: Date): Promise<readonly Review[]> {
        return Promise.resolve(
            [...this.storage.values()].filter((review) => {
                const completedAt = review.completedAt
                if (completedAt === null) {
                    return false
                }

                return completedAt >= from && completedAt <= to
            }),
        )
    }

    public findByRepositoryId(repositoryId: string): Promise<readonly Review[]> {
        return Promise.resolve(
            [...this.storage.values()].filter((review) => {
                return review.repositoryId === repositoryId
            }),
        )
    }
}

describe("IReviewRepository contract", () => {
    test("saves and finds review by identifier", async () => {
        const reviewFactory = new ReviewFactory()
        const repository = new InMemoryReviewRepository()
        const review = reviewFactory.create({
            repositoryId: "repo-1",
            mergeRequestId: "mr-1",
            severityBudget: 5,
        })

        await repository.save(review)
        const found = await repository.findById(review.id)

        expect(found).not.toBeNull()
        if (found === null) {
            throw new Error("Saved review must be retrievable by id")
        }
        expect(found.id.equals(review.id)).toBe(true)
    })

    test("finds review by merge request id", async () => {
        const reviewFactory = new ReviewFactory()
        const repository = new InMemoryReviewRepository()
        const review = reviewFactory.create({
            repositoryId: "repo-2",
            mergeRequestId: "mr-2",
            severityBudget: 5,
        })

        await repository.save(review)
        const found = await repository.findByMergeRequestId("mr-2")

        expect(found?.id.equals(review.id)).toBe(true)
    })

    test("returns reviews by status, date range, and repository id", async () => {
        const reviewFactory = new ReviewFactory()
        const repository = new InMemoryReviewRepository()
        const completedReview = reviewFactory.reconstitute({
            id: "review-completed",
            repositoryId: "repo-3",
            mergeRequestId: "mr-3",
            status: REVIEW_STATUS.COMPLETED,
            issues: [],
            severityBudget: 10,
            consumedSeverity: 4,
            startedAt: "2026-03-03T08:00:00.000Z",
            completedAt: "2026-03-03T08:05:00.000Z",
            failedAt: null,
            failureReason: null,
        })
        const pendingReview = reviewFactory.reconstitute({
            id: "review-pending",
            repositoryId: "repo-4",
            mergeRequestId: "mr-4",
            status: REVIEW_STATUS.PENDING,
            issues: [],
            severityBudget: 10,
            consumedSeverity: 0,
            startedAt: null,
            completedAt: null,
            failedAt: null,
            failureReason: null,
        })

        await repository.save(completedReview)
        await repository.save(pendingReview)

        const completed = await repository.findByStatus(REVIEW_STATUS.COMPLETED)
        const byDate = await repository.findByDateRange(
            new Date("2026-03-03T08:00:00.000Z"),
            new Date("2026-03-03T08:10:00.000Z"),
        )
        const byRepository = await repository.findByRepositoryId("repo-3")

        expect(completed).toHaveLength(1)
        expect(completed[0]?.id.value).toBe("review-completed")
        expect(byDate).toHaveLength(1)
        expect(byDate[0]?.id.value).toBe("review-completed")
        expect(byRepository).toHaveLength(1)
        expect(byRepository[0]?.id.value).toBe("review-completed")
    })
})
