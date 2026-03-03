import {describe, expect, test} from "bun:test"

import {BaseDomainEvent, type DomainEventPayload} from "../../../src/domain/events/base-domain-event"
import {FEEDBACK_TYPE} from "../../../src/domain/events/feedback-received"
import type {IDomainEventBus} from "../../../src/application/ports/outbound/common/domain-event-bus.port"
import type {IFeedbackRecord, IFeedbackRepository} from "../../../src/application/ports/outbound/feedback-repository.port"
import {UniqueId} from "../../../src/domain/value-objects/unique-id.value-object"
import {IssueFeedback} from "../../../src/domain/value-objects/issue-feedback.value-object"
import {
    CollectFeedbackUseCase,
    type ICollectFeedbackInput,
} from "../../../src/application/use-cases/collect-feedback.use-case"

class InMemoryFeedbackRepository implements IFeedbackRepository {
    private records: IFeedbackRecord[]
    public constructor(records: readonly IFeedbackRecord[]) {
        this.records = [...records]
    }

    public save(_feedback: IFeedbackRecord): Promise<void> {
        return Promise.resolve()
    }

    public saveMany(feedbacks: readonly IFeedbackRecord[]): Promise<void> {
        this.records = [...this.records, ...feedbacks]
        return Promise.resolve()
    }

    public findByReviewId(criteria: {readonly reviewId: string}): Promise<readonly IFeedbackRecord[]> {
        return Promise.resolve(this.records.filter((record) => record.reviewId === criteria.reviewId))
    }

    public findByIssueId(criteria: {readonly issueId: string}): Promise<readonly IFeedbackRecord[]> {
        return Promise.resolve(this.records.filter((record) => record.issueId === criteria.issueId))
    }

    public aggregateByType(criteria: {readonly reviewId: string}): Promise<Record<string, number>> {
        const result: Record<string, number> = {}
        for (const record of this.records) {
            if (record.reviewId !== criteria.reviewId || record.ruleId === undefined) {
                continue
            }
            const current = result[record.type] ?? 0
            result[record.type] = current + 1
        }

        return Promise.resolve(result)
    }

    public findByFilter(_criteria?: {
        readonly ruleIds?: readonly string[]
        readonly teamIds?: readonly string[]
        readonly severities?: readonly string[]
    }): Promise<readonly IFeedbackRecord[]> {
        return Promise.resolve(this.records)
    }

    public countByRuleId(ruleId: string): Promise<number> {
        return Promise.resolve(this.records.filter((record): boolean => record.ruleId === ruleId).length)
    }

    public countFalsePositiveByRuleId(ruleId: string): Promise<number> {
        return Promise.resolve(
            this.records.filter(
                (record): boolean => record.ruleId === ruleId && record.type === FEEDBACK_TYPE.FALSE_POSITIVE,
            ).length,
        )
    }
}

class InMemoryDomainEventBus implements IDomainEventBus {
    private published: readonly BaseDomainEvent<DomainEventPayload>[] = []

    public publish(events: readonly BaseDomainEvent<DomainEventPayload>[]): Promise<void> {
        this.published = [...this.published, ...events]
        return Promise.resolve()
    }

    public get events(): readonly string[] {
        return this.published
            .map((event) => event.payload.issueId)
            .filter((value: unknown): value is string => typeof value === "string")
    }
}

const userIdA = UniqueId.create("user-a")
const userIdB = UniqueId.create("user-b")

const reviewId = "review-1"
const existing: IFeedbackRecord[] = [
    {
        issueId: "issue-1",
        reviewId,
        type: FEEDBACK_TYPE.FALSE_POSITIVE,
        userId: userIdA,
        createdAt: new Date("2025-01-01T00:00:00.000Z"),
    },
]

describe("CollectFeedbackUseCase", () => {
    test("saves deduplicated feedback and publishes events", async () => {
        const repository = new InMemoryFeedbackRepository(existing)
        const bus = new InMemoryDomainEventBus()
        const useCase = new CollectFeedbackUseCase({
            feedbackRepository: repository,
            domainEventBus: bus,
        })

        const result = await useCase.execute({
            reviewId,
            feedbacks: [
                IssueFeedback.create({
                    issueId: "issue-2",
                    reviewId,
                    type: FEEDBACK_TYPE.HELPFUL,
                    userId: userIdA,
                    comment: "Looks correct",
                    createdAt: new Date("2025-02-01T00:00:00.000Z"),
                }),
                IssueFeedback.create({
                    issueId: "issue-2",
                    reviewId,
                    type: FEEDBACK_TYPE.HELPFUL,
                    userId: userIdA,
                    createdAt: new Date("2025-02-01T00:00:00.000Z"),
                }),
                IssueFeedback.create({
                    issueId: "issue-3",
                    reviewId,
                    type: FEEDBACK_TYPE.FALSE_POSITIVE,
                    userId: userIdB,
                    createdAt: new Date("2025-02-01T00:00:00.000Z"),
                }),
            ],
        })

        if (result.isFail) {
            throw new Error("Expected success")
        }

        expect(bus.events).toEqual(["issue-2", "issue-3"])
    })

    test("skips already persisted feedback for same issue and user", async () => {
        const repository = new InMemoryFeedbackRepository(existing)
        const bus = new InMemoryDomainEventBus()
        const useCase = new CollectFeedbackUseCase({
            feedbackRepository: repository,
            domainEventBus: bus,
        })

        const result = await useCase.execute({
            reviewId,
            feedbacks: [
                IssueFeedback.create({
                    issueId: "issue-1",
                    reviewId,
                    type: FEEDBACK_TYPE.IMPLEMENTED,
                    userId: userIdA,
                    createdAt: new Date("2025-02-01T00:00:00.000Z"),
                }),
            ],
        })

        if (result.isFail) {
            throw new Error("Expected success")
        }

        expect(bus.events).toEqual([])
    })

    test("keeps latest feedback per issue and user from input", async () => {
        const repository = new InMemoryFeedbackRepository([])
        const bus = new InMemoryDomainEventBus()
        const useCase = new CollectFeedbackUseCase({
            feedbackRepository: repository,
            domainEventBus: bus,
        })

        const result = await useCase.execute({
            reviewId,
            feedbacks: [
                IssueFeedback.create({
                    issueId: "issue-4",
                    reviewId,
                    type: FEEDBACK_TYPE.HELPFUL,
                    userId: userIdA,
                    createdAt: new Date("2025-01-01T00:00:00.000Z"),
                }),
                IssueFeedback.create({
                    issueId: "issue-4",
                    reviewId,
                    type: FEEDBACK_TYPE.HELPFUL,
                    userId: userIdA,
                    createdAt: new Date("2025-02-01T00:00:00.000Z"),
                }),
            ],
        })

        if (result.isFail) {
            throw new Error("Expected success")
        }

        expect(bus.events).toEqual(["issue-4"])
    })

    test("returns validation error for invalid payload", async () => {
        const repository = new InMemoryFeedbackRepository([])
        const bus = new InMemoryDomainEventBus()
        const useCase = new CollectFeedbackUseCase({
            feedbackRepository: repository,
            domainEventBus: bus,
        })

        const result = await useCase.execute({
            reviewId: "",
            feedbacks: [] as unknown as never,
        } as ICollectFeedbackInput)

        if (result.isOk) {
            throw new Error("Expected failure")
        }

        expect(result.error.fields[0]).toEqual({
            field: "reviewId",
            message: "reviewId must be a non-empty string",
        })
    })

    test("returns validation error when feedback review id mismatches", async () => {
        const repository = new InMemoryFeedbackRepository([])
        const bus = new InMemoryDomainEventBus()
        const useCase = new CollectFeedbackUseCase({
            feedbackRepository: repository,
            domainEventBus: bus,
        })

        const result = await useCase.execute({
            reviewId: "review-main",
            feedbacks: [
                IssueFeedback.create({
                    issueId: "issue-4",
                    reviewId: UniqueId.create("review-other"),
                    type: FEEDBACK_TYPE.HELPFUL,
                    userId: userIdA,
                }),
            ],
        })

        if (result.isOk) {
            throw new Error("Expected failure")
        }

        expect(result.error.fields[0]).toEqual({
            field: "feedbacks",
            message: "All feedback items must belong to reviewId review-main",
        })
    })
})
