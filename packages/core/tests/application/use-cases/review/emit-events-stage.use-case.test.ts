import {describe, expect, test} from "bun:test"

import type {BaseDomainEvent, DomainEventPayload, IDomainEventBus} from "../../../../src"
import {ReviewPipelineState} from "../../../../src/application/types/review/review-pipeline-state"
import {EmitEventsStageUseCase} from "../../../../src/application/use-cases/review/emit-events-stage.use-case"

class InMemoryDomainEventBus implements IDomainEventBus {
    public shouldThrow = false
    public publishedEvents: readonly BaseDomainEvent<DomainEventPayload>[] = []

    public publish(events: readonly BaseDomainEvent<DomainEventPayload>[]): Promise<void> {
        if (this.shouldThrow) {
            return Promise.reject(new Error("event bus unavailable"))
        }

        this.publishedEvents = events
        return Promise.resolve()
    }
}

/**
 * Creates state for emit-events stage tests.
 *
 * @param externalContext External context payload.
 * @returns Pipeline state.
 */
function createState(externalContext: Readonly<Record<string, unknown>> | null): ReviewPipelineState {
    return ReviewPipelineState.create({
        runId: "run-emit-events",
        definitionVersion: "v1",
        mergeRequest: {
            id: "mr-65",
        },
        config: {},
        externalContext,
    })
}

function createMetricsEnvelope(
    reviewId: string,
    aggregateId: string,
    occurredAt: string,
): Readonly<Record<string, unknown>> {
    return {
        eventName: "MetricsCalculated",
        aggregateId,
        occurredAt,
        payload: {
            reviewId,
            tokenUsage: {
                inputTokens: 10,
                outputTokens: 5,
                totalTokens: 15,
            },
            costEstimate: 0.2,
            duration: 1200,
        },
    }
}

describe("EmitEventsStageUseCase", () => {
    test("publishes mapped domain events and clears pending queue", async () => {
        const domainEventBus = new InMemoryDomainEventBus()
        const useCase = new EmitEventsStageUseCase({
            domainEventBus,
        })
        const state = createState({
            pendingDomainEvents: [
                createMetricsEnvelope("run-emit-events", "run-emit-events", "2026-03-03T14:00:00.000Z"),
            ],
        })

        const result = await useCase.execute({
            state,
        })

        expect(result.isOk).toBe(true)
        expect(result.value.metadata?.checkpointHint).toBe("events:published")
        expect(domainEventBus.publishedEvents).toHaveLength(1)
        const externalContext = result.value.state.externalContext as Readonly<Record<string, unknown>>
        const pendingDomainEvents = externalContext["pendingDomainEvents"] as readonly unknown[]
        expect(pendingDomainEvents).toHaveLength(0)
        const publishedDomainEvents = externalContext["publishedDomainEvents"] as
            | Readonly<Record<string, unknown>>
            | undefined
        expect(publishedDomainEvents?.["count"]).toBe(1)
    })

    test("skips unknown envelopes and returns success without publication", async () => {
        const domainEventBus = new InMemoryDomainEventBus()
        const useCase = new EmitEventsStageUseCase({
            domainEventBus,
        })
        const state = createState({
            pendingDomainEvents: [
                {
                    eventName: "UnknownEvent",
                    aggregateId: "run-emit-events",
                    occurredAt: "2026-03-03T14:00:00.000Z",
                    payload: {
                        value: 1,
                    },
                },
            ],
        })

        const result = await useCase.execute({
            state,
        })

        expect(result.isOk).toBe(true)
        expect(result.value.metadata?.checkpointHint).toBe("events:skipped-unknown")
        expect(domainEventBus.publishedEvents).toHaveLength(0)
    })

    test("returns recoverable stage error when event bus publish fails", async () => {
        const domainEventBus = new InMemoryDomainEventBus()
        domainEventBus.shouldThrow = true
        const useCase = new EmitEventsStageUseCase({
            domainEventBus,
        })
        const state = createState({
            pendingDomainEvents: [
                createMetricsEnvelope("run-emit-events", "run-emit-events", "2026-03-03T14:00:00.000Z"),
            ],
        })

        const result = await useCase.execute({
            state,
        })

        expect(result.isFail).toBe(true)
        expect(result.error.recoverable).toBe(true)
        expect(result.error.message).toContain("publish queued domain events")
    })
})
