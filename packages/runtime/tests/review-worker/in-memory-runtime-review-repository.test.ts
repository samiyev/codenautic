import {describe, expect, test} from "bun:test"

import {REVIEW_STATUS, ReviewFactory, UniqueId} from "@codenautic/core"

import {InMemoryRuntimeReviewRepository} from "../../src/review-worker/adapters/in-memory-runtime-review-repository"

describe("InMemoryRuntimeReviewRepository", () => {
    test("stores and loads review by id", async () => {
        const reviewFactory = new ReviewFactory()
        const repository = new InMemoryRuntimeReviewRepository()
        const review = reviewFactory.create({
            repositoryId: "repo-runtime-1",
            mergeRequestId: "mr-runtime-1",
            severityBudget: 5,
        })

        await repository.save(review)
        const found = await repository.findById(UniqueId.create(review.id.value))

        expect(found).not.toBeNull()
        expect(found?.id.equals(review.id)).toBe(true)
    })

    test("finds review by merge request id and returns null when absent", async () => {
        const reviewFactory = new ReviewFactory()
        const review = reviewFactory.create({
            repositoryId: "repo-runtime-2",
            mergeRequestId: "mr-runtime-2",
            severityBudget: 5,
        })
        const repository = new InMemoryRuntimeReviewRepository([review])

        const found = await repository.findByMergeRequestId("mr-runtime-2")
        const missing = await repository.findByMergeRequestId("mr-runtime-missing")

        expect(found?.id.value).toBe(review.id.value)
        expect(missing).toBeNull()
    })

    test("filters reviews by status", async () => {
        const reviewFactory = new ReviewFactory()
        const completedReview = reviewFactory.reconstitute({
            id: "runtime-review-completed",
            repositoryId: "repo-runtime-3",
            mergeRequestId: "mr-runtime-3",
            status: REVIEW_STATUS.COMPLETED,
            issues: [],
            severityBudget: 10,
            consumedSeverity: 2,
            startedAt: "2026-03-03T10:00:00.000Z",
            completedAt: "2026-03-03T10:05:00.000Z",
            failedAt: null,
            failureReason: null,
        })
        const failedReview = reviewFactory.reconstitute({
            id: "runtime-review-failed",
            repositoryId: "repo-runtime-3",
            mergeRequestId: "mr-runtime-4",
            status: REVIEW_STATUS.FAILED,
            issues: [],
            severityBudget: 10,
            consumedSeverity: 0,
            startedAt: "2026-03-03T10:10:00.000Z",
            completedAt: null,
            failedAt: "2026-03-03T10:11:00.000Z",
            failureReason: "Worker timeout",
        })
        const repository = new InMemoryRuntimeReviewRepository([completedReview, failedReview])

        const completed = await repository.findByStatus(REVIEW_STATUS.COMPLETED)

        expect(completed).toHaveLength(1)
        expect(completed[0]?.id.value).toBe("runtime-review-completed")
    })

    test("filters reviews by completedAt date range", async () => {
        const reviewFactory = new ReviewFactory()
        const inRangeReview = reviewFactory.reconstitute({
            id: "runtime-review-in-range",
            repositoryId: "repo-runtime-4",
            mergeRequestId: "mr-runtime-5",
            status: REVIEW_STATUS.COMPLETED,
            issues: [],
            severityBudget: 10,
            consumedSeverity: 3,
            startedAt: "2026-03-03T11:00:00.000Z",
            completedAt: "2026-03-03T11:05:00.000Z",
            failedAt: null,
            failureReason: null,
        })
        const outOfRangeReview = reviewFactory.reconstitute({
            id: "runtime-review-out-of-range",
            repositoryId: "repo-runtime-4",
            mergeRequestId: "mr-runtime-6",
            status: REVIEW_STATUS.COMPLETED,
            issues: [],
            severityBudget: 10,
            consumedSeverity: 1,
            startedAt: "2026-03-03T11:10:00.000Z",
            completedAt: "2026-03-03T11:15:00.000Z",
            failedAt: null,
            failureReason: null,
        })
        const withoutCompletionReview = reviewFactory.reconstitute({
            id: "runtime-review-without-completion",
            repositoryId: "repo-runtime-4",
            mergeRequestId: "mr-runtime-7",
            status: REVIEW_STATUS.IN_PROGRESS,
            issues: [],
            severityBudget: 10,
            consumedSeverity: 0,
            startedAt: "2026-03-03T11:20:00.000Z",
            completedAt: null,
            failedAt: null,
            failureReason: null,
        })
        const repository = new InMemoryRuntimeReviewRepository([
            inRangeReview,
            outOfRangeReview,
            withoutCompletionReview,
        ])

        const byDate = await repository.findByDateRange(
            new Date("2026-03-03T11:00:00.000Z"),
            new Date("2026-03-03T11:10:00.000Z"),
        )

        expect(byDate).toHaveLength(1)
        expect(byDate[0]?.id.value).toBe("runtime-review-in-range")
    })

    test("filters reviews by repository id", async () => {
        const reviewFactory = new ReviewFactory()
        const matchingReview = reviewFactory.create({
            repositoryId: "repo-runtime-5",
            mergeRequestId: "mr-runtime-8",
            severityBudget: 4,
        })
        const otherReview = reviewFactory.create({
            repositoryId: "repo-runtime-6",
            mergeRequestId: "mr-runtime-9",
            severityBudget: 4,
        })
        const repository = new InMemoryRuntimeReviewRepository([matchingReview, otherReview])

        const byRepository = await repository.findByRepositoryId("repo-runtime-5")

        expect(byRepository).toHaveLength(1)
        expect(byRepository[0]?.id.value).toBe(matchingReview.id.value)
    })
})
