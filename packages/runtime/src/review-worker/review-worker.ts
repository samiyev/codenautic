import {
    type DomainError,
    type ICompleteReviewInput,
    type ICompleteReviewOutput,
    type IUseCase,
    Result,
} from "@codenautic/core"

import type {IRuntimeLogger} from "./ports/runtime-logger.port"

/**
 * Runtime payload for complete-review worker job.
 */
export interface IReviewCompletionMessage {
    reviewId: string
    consumedSeverity: number
    completedAt: string | Date
}

/**
 * Runtime worker that executes complete-review use case.
 */
export class ReviewWorker {
    private readonly completeReviewUseCase: IUseCase<
        ICompleteReviewInput,
        ICompleteReviewOutput,
        DomainError
    >
    private readonly logger: IRuntimeLogger

    /**
     * Creates worker instance.
     *
     * @param completeReviewUseCase Core use case dependency.
     * @param logger Structured logger dependency.
     */
    public constructor(
        completeReviewUseCase: IUseCase<ICompleteReviewInput, ICompleteReviewOutput, DomainError>,
        logger: IRuntimeLogger,
    ) {
        this.completeReviewUseCase = completeReviewUseCase
        this.logger = logger
    }

    /**
     * Processes single review completion message.
     *
     * @param message Runtime message payload.
     * @returns Use-case result.
     */
    public async process(
        message: IReviewCompletionMessage,
    ): Promise<Result<ICompleteReviewOutput, DomainError>> {
        const input = this.mapMessageToInput(message)

        await this.logger.info("Processing review completion message", {
            reviewId: input.reviewId,
        })

        const result = await this.completeReviewUseCase.execute(input)

        if (result.isSuccess === true) {
            await this.logger.info("Review completed", {
                reviewId: input.reviewId,
                status: result.value?.status ?? "unknown",
            })
        } else {
            await this.logger.warn("Review completion failed", {
                reviewId: input.reviewId,
                errorCode: result.error?.code,
            })
        }

        return result
    }

    /**
     * Maps runtime payload to use-case input.
     *
     * @param message Runtime message payload.
     * @returns Use-case input.
     * @throws Error When completedAt value cannot be parsed.
     */
    private mapMessageToInput(message: IReviewCompletionMessage): ICompleteReviewInput {
        const completedAt =
            message.completedAt instanceof Date
                ? new Date(message.completedAt)
                : new Date(message.completedAt)

        if (Number.isNaN(completedAt.getTime())) {
            throw new Error("completedAt must be valid ISO timestamp")
        }

        return {
            reviewId: message.reviewId,
            consumedSeverity: message.consumedSeverity,
            completedAt,
        }
    }
}
