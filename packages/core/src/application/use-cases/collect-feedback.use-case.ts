import {FeedbackReceived} from "../../domain/events/feedback-received"
import {IssueFeedback} from "../../domain/value-objects/issue-feedback.value-object"
import {ValidationError, type IValidationErrorField} from "../../domain/errors/validation.error"
import type {IDomainEventBus} from "../ports/outbound/common/domain-event-bus.port"
import type {IFeedbackRecord, IFeedbackRepository} from "../ports/outbound/feedback-repository.port"
import type {IUseCase} from "../ports/inbound/use-case.port"
import {Result} from "../../shared/result"

/**
 * Input for feedback collection.
 */
export interface ICollectFeedbackInput {
    /**
     * Reviewed review identifier.
     */
    readonly reviewId: string

    /**
     * Incoming feedback rows.
     */
    readonly feedbacks: readonly IssueFeedback[]
}

/**
 * Dependencies for feedback collect use case.
 */
export interface ICollectFeedbackUseCaseDependencies {
    /**
     * Feedback persistence port.
     */
    readonly feedbackRepository: IFeedbackRepository

    /**
     * Domain event bus for emitted feedback events.
     */
    readonly domainEventBus: IDomainEventBus
}

/**
 * Use case for collecting feedback and publishing feedback events.
 */
export class CollectFeedbackUseCase implements IUseCase<ICollectFeedbackInput, void, ValidationError> {
    private readonly feedbackRepository: IFeedbackRepository
    private readonly domainEventBus: IDomainEventBus

    /**
     * Creates use case.
     *
     * @param dependencies Dependency set.
     */
    public constructor(dependencies: ICollectFeedbackUseCaseDependencies) {
        this.feedbackRepository = dependencies.feedbackRepository
        this.domainEventBus = dependencies.domainEventBus
    }

    /**
     * Validates and stores feedback with dedupe.
     *
     * @param input Use case payload.
     * @returns Empty success result.
     */
    public async execute(input: ICollectFeedbackInput): Promise<Result<void, ValidationError>> {
        const normalized = this.validateInput(input)
        if (normalized.result.isFail) {
            return Result.fail<void, ValidationError>(normalized.result.error)
        }

        if (normalized.value === undefined) {
            return Result.fail<void, ValidationError>(
                new ValidationError("Collect feedback internal failure", [{
                    field: "internal",
                    message: "Validation result is incomplete",
                }]),
            )
        }

        const {reviewId, feedbacks} = normalized.value

        const dedupedByIssueAndUser = this.deduplicateInput(feedbacks)
        const alreadyPersistedKeys = await this.loadExistingFeedbackKeys([...dedupedByIssueAndUser.values()], reviewId)

        const records: IFeedbackRecord[] = []
        const events: FeedbackReceived[] = []

        for (const feedback of dedupedByIssueAndUser.values()) {
            const key = this.getDedupeKey(feedback)
            if (alreadyPersistedKeys.has(key)) {
                continue
            }

            const record: IFeedbackRecord = {
                issueId: feedback.issueId.value,
                reviewId: feedback.reviewId.value,
                type: feedback.type,
                userId: feedback.userId,
                createdAt: feedback.createdAt,
                comment: feedback.comment,
            }
            records.push(record)
            events.push(
                new FeedbackReceived(reviewId, {
                    issueId: feedback.issueId.value,
                    reviewId,
                    feedbackType: feedback.type,
                    userId: feedback.userId.value,
                }),
            )
        }

        if (records.length > 0) {
            await this.feedbackRepository.saveMany(records)
            await this.domainEventBus.publish(events)
        }

        return Result.ok<void, ValidationError>(void 0)
    }

    /**
     * Validates use-case payload.
     *
     * @param input Input payload.
     * @returns Validation result and normalized data.
     */
    private validateInput(
        input: ICollectFeedbackInput,
    ): {readonly result: Result<{readonly reviewId: string; readonly feedbacks: readonly IssueFeedback[]}, ValidationError>; readonly value?: {readonly reviewId: string; readonly feedbacks: readonly IssueFeedback[]}} {
        const fields: IValidationErrorField[] = []

        if (typeof input !== "object" || input === null) {
            return {
                result: Result.fail(new ValidationError("Collect feedback validation failed", [{
                    field: "input",
                    message: "must be an object",
                }])),
            }
        }

        if (typeof input.reviewId !== "string" || input.reviewId.trim().length === 0) {
            fields.push({
                field: "reviewId",
                message: "reviewId must be a non-empty string",
            })
        }

        if (Array.isArray(input.feedbacks) === false) {
            fields.push({
                field: "feedbacks",
                message: "feedbacks must be an array",
            })
        }

        if (fields.length > 0) {
            return {
                result: Result.fail(new ValidationError("Collect feedback validation failed", fields)),
            }
        }

        const normalizedReviewId = input.reviewId.trim()
        const feedbacks = input.feedbacks.filter((feedback): feedback is IssueFeedback => {
            if (!(feedback instanceof IssueFeedback)) {
                return false
            }

            if (feedback.reviewId.value !== normalizedReviewId) {
                fields.push({
                    field: "feedbacks",
                    message: `All feedback items must belong to reviewId ${normalizedReviewId}`,
                })
                return false
            }

            return true
        })

        if (fields.length > 0) {
            return {
                result: Result.fail(new ValidationError("Collect feedback validation failed", fields)),
            }
        }

        return {
            result: Result.ok({reviewId: normalizedReviewId, feedbacks}),
            value: {
                reviewId: normalizedReviewId,
                feedbacks,
            },
        }
    }

    /**
     * De-duplicates feedback by issueId + userId keeping latest createdAt.
     *
     * @param feedbacks Input list.
     * @returns De-duplicated feedback map.
     */
    private deduplicateInput(feedbacks: readonly IssueFeedback[]): Map<string, IssueFeedback> {
        const grouped = new Map<string, IssueFeedback>()

        for (const feedback of feedbacks) {
            const key = this.getDedupeKey(feedback)
            const existing = grouped.get(key)
            if (existing === undefined || feedback.createdAt.getTime() > existing.createdAt.getTime()) {
                grouped.set(key, feedback)
            }
        }

        return grouped
    }

    /**
     * Loads existing records and builds dedupe keys for provided feedback.
     *
     * @param feedbacks Deduplicated input.
     * @param reviewId Review id filter.
     * @returns Existing keys set.
     */
    private async loadExistingFeedbackKeys(
        feedbacks: readonly IssueFeedback[],
        reviewId: string,
    ): Promise<Set<string>> {
        const keys = new Set<string>()

        const issueIds = [...new Set(feedbacks.map((feedback) => feedback.issueId.value))]
        for (const issueId of issueIds) {
            const existing = await this.feedbackRepository.findByIssueId({issueId})

            for (const row of existing) {
                if (row.reviewId !== reviewId) {
                    continue
                }

                keys.add(this.toDedupeKey(row.issueId, row.userId.value))
            }
        }

        return keys
    }

    /**
     * Builds dedupe key from feedback.
     *
     * @param feedback Feedback object.
     * @returns Key.
     */
    private getDedupeKey(feedback: IssueFeedback): string {
        return this.toDedupeKey(feedback.issueId.value, feedback.userId.value)
    }

    /**
     * Creates deterministic dedupe key.
     *
     * @param issueId Issue id.
     * @param userId User id.
     * @returns Key.
     */
    private toDedupeKey(issueId: string, userId: string): string {
        return `${issueId}::${userId}`
    }
}
