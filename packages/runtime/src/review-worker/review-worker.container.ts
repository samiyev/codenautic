import {
    CompleteReviewUseCase,
    Container,
    type DomainError,
    type ICompleteReviewInput,
    type ICompleteReviewOutput,
    type IDomainEventBus,
    type IReviewRepository,
    type IUseCase,
    createToken,
} from "@codenautic/core"

import {InMemoryRuntimeDomainEventBus} from "./adapters/in-memory-runtime-domain-event-bus"
import {InMemoryRuntimeLogger} from "./adapters/in-memory-runtime-logger"
import {InMemoryRuntimeReviewRepository} from "./adapters/in-memory-runtime-review-repository"
import type {IRuntimeLogger} from "./ports/runtime-logger.port"
import {ReviewWorker} from "./review-worker"

/**
 * Runtime review-worker tokens.
 */
export const REVIEW_WORKER_TOKENS = {
    Logger: createToken<IRuntimeLogger>("runtime.review-worker.logger"),
    DomainEventBus: createToken<IDomainEventBus>("runtime.review-worker.domain-event-bus"),
    ReviewRepository: createToken<IReviewRepository>("runtime.review-worker.review-repository"),
    CompleteReviewUseCase: createToken<IUseCase<ICompleteReviewInput, ICompleteReviewOutput, DomainError>>(
        "runtime.review-worker.complete-review-use-case",
    ),
    ReviewWorker: createToken<ReviewWorker>("runtime.review-worker.worker"),
} as const

/**
 * Optional dependency overrides for review-worker composition root.
 */
export interface IReviewWorkerContainerOverrides {
    reviewRepository?: IReviewRepository
    domainEventBus?: IDomainEventBus
    logger?: IRuntimeLogger
}

/**
 * Creates review-worker composition root with CompleteReviewUseCase wiring.
 *
 * @param overrides Optional dependency overrides.
 * @returns Configured IoC container.
 */
export function createReviewWorkerContainer(
    overrides: IReviewWorkerContainerOverrides = {},
): Container {
    const container = new Container()

    container.bindSingleton(REVIEW_WORKER_TOKENS.Logger, () => {
        return overrides.logger ?? new InMemoryRuntimeLogger({process: "review-worker"})
    })

    container.bindSingleton(REVIEW_WORKER_TOKENS.DomainEventBus, () => {
        return overrides.domainEventBus ?? new InMemoryRuntimeDomainEventBus()
    })

    container.bindSingleton(REVIEW_WORKER_TOKENS.ReviewRepository, () => {
        return overrides.reviewRepository ?? new InMemoryRuntimeReviewRepository()
    })

    container.bindSingleton(REVIEW_WORKER_TOKENS.CompleteReviewUseCase, () => {
        const reviewRepository = container.resolve(REVIEW_WORKER_TOKENS.ReviewRepository)
        const domainEventBus = container.resolve(REVIEW_WORKER_TOKENS.DomainEventBus)

        return new CompleteReviewUseCase(reviewRepository, domainEventBus)
    })

    container.bindSingleton(REVIEW_WORKER_TOKENS.ReviewWorker, () => {
        const useCase = container.resolve(REVIEW_WORKER_TOKENS.CompleteReviewUseCase)
        const logger = container.resolve(REVIEW_WORKER_TOKENS.Logger)

        return new ReviewWorker(useCase, logger)
    })

    return container
}
