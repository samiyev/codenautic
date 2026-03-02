import {describe, expect, test} from "bun:test"

import {ReviewFactory, UniqueId} from "@codenautic/core"

import {InMemoryRuntimeDomainEventBus} from "../../src/review-worker/adapters/in-memory-runtime-domain-event-bus"
import {InMemoryRuntimeLogger} from "../../src/review-worker/adapters/in-memory-runtime-logger"
import {InMemoryRuntimeReviewRepository} from "../../src/review-worker/adapters/in-memory-runtime-review-repository"
import {
    REVIEW_WORKER_TOKENS,
    createReviewWorkerContainer,
} from "../../src/review-worker/review-worker.container"

describe("review-worker composition root", () => {
    test("wires CompleteReviewUseCase in container", () => {
        const container = createReviewWorkerContainer()

        expect(container.has(REVIEW_WORKER_TOKENS.CompleteReviewUseCase)).toBe(true)
        const useCase = container.resolve(REVIEW_WORKER_TOKENS.CompleteReviewUseCase)
        expect(useCase).toBeDefined()
    })

    test("processes happy-path payload via worker", async () => {
        const factory = new ReviewFactory()
        const review = factory.create({
            repositoryId: "repo-runtime-1",
            severityBudget: 5,
        })
        review.start(new Date("2026-03-02T10:00:00.000Z"))
        review.pullDomainEvents()

        const reviewRepository = new InMemoryRuntimeReviewRepository([review])
        const eventBus = new InMemoryRuntimeDomainEventBus()
        const logger = new InMemoryRuntimeLogger()

        const container = createReviewWorkerContainer({
            reviewRepository,
            domainEventBus: eventBus,
            logger,
        })
        const worker = container.resolve(REVIEW_WORKER_TOKENS.ReviewWorker)

        const result = await worker.process({
            reviewId: review.id.value,
            consumedSeverity: 3,
            completedAt: "2026-03-02T10:05:00.000Z",
        })

        expect(result.isSuccess).toBe(true)
        expect(result.value?.status).toBe("completed")

        const storedReview = await reviewRepository.findById(UniqueId.create(review.id.value))
        if (storedReview === null) {
            throw new Error("Expected review to be stored")
        }

        expect(storedReview.status).toBe("completed")
        expect(storedReview.consumedSeverity).toBe(3)
        expect(eventBus.publishedEvents).toHaveLength(1)
        expect(eventBus.publishedEvents[0]?.eventName).toBe("ReviewCompleted")
        expect(logger.entries).toHaveLength(2)
    })
})
