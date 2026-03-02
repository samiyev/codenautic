import {type DomainError, type ICompleteReviewOutput, Result} from "@codenautic/core"

import {type IReviewCompletionMessage, ReviewWorker} from "./review-worker"
import {
    REVIEW_WORKER_TOKENS,
    type IReviewWorkerContainerOverrides,
    createReviewWorkerContainer,
} from "./review-worker.container"

/**
 * Starts review-worker process.
 *
 * @returns Promise resolved when worker is initialized.
 */
export async function startReviewWorker(): Promise<void> {
    const container = createReviewWorkerContainer()
    const logger = container.resolve(REVIEW_WORKER_TOKENS.Logger)

    await logger.info("review-worker started")
}

/**
 * Runs review-worker once with provided payload.
 *
 * @param message Review completion message.
 * @param overrides Optional container dependency overrides.
 * @returns Use-case result for a single message.
 */
export async function runReviewWorkerOnce(
    message: IReviewCompletionMessage,
    overrides: IReviewWorkerContainerOverrides = {},
): Promise<Result<ICompleteReviewOutput, DomainError>> {
    const container = createReviewWorkerContainer(overrides)
    const worker: ReviewWorker = container.resolve(REVIEW_WORKER_TOKENS.ReviewWorker)

    return worker.process(message)
}

if (import.meta.main) {
    await startReviewWorker()
}
