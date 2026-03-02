import {describe, expect, test} from "bun:test"

import {ReviewPipelineState} from "../../../../src/application/types/review/review-pipeline-state"
import {UpdateMetricsStageUseCase} from "../../../../src/application/use-cases/review/update-metrics-stage.use-case"

/**
 * Creates state for update-metrics stage tests.
 *
 * @param metrics Metrics payload.
 * @param externalContext External context payload.
 * @param config Config payload.
 * @returns Pipeline state.
 */
function createState(
    metrics: Readonly<Record<string, unknown>> | null,
    externalContext: Readonly<Record<string, unknown>> | null,
    config: Readonly<Record<string, unknown>>,
): ReviewPipelineState {
    return ReviewPipelineState.create({
        runId: "run-update-metrics",
        definitionVersion: "v1",
        mergeRequest: {
            id: "mr-64",
        },
        config,
        metrics,
        externalContext,
    })
}

describe("UpdateMetricsStageUseCase", () => {
    test("uses default now provider when dependency is omitted", async () => {
        const useCase = new UpdateMetricsStageUseCase()
        const state = createState(
            {
                tokenUsage: {
                    input: 0,
                    output: 0,
                    total: 0,
                },
            },
            null,
            {},
        )

        const result = await useCase.execute({
            state,
        })

        expect(result.isOk).toBe(true)
        const metrics = result.value.state.metrics as Readonly<Record<string, unknown>>
        expect(typeof metrics["metricsUpdatedAt"]).toBe("string")
    })

    test("updates metrics and appends MetricsCalculated event envelope", async () => {
        const useCase = new UpdateMetricsStageUseCase({
            now: () => new Date("2026-03-03T13:30:00.000Z"),
        })
        const state = createState(
            {
                issueCount: 2,
                riskScore: 78,
                tokenUsage: {
                    input: 1000,
                    output: 500,
                    total: 1500,
                },
            },
            {
                pipelineStartedAt: "2026-03-03T13:00:00.000Z",
            },
            {
                tokenCostPerThousand: 0.2,
            },
        )

        const result = await useCase.execute({
            state,
        })

        expect(result.isOk).toBe(true)
        expect(result.value.metadata?.checkpointHint).toBe("metrics:updated")
        const metrics = result.value.state.metrics as Readonly<Record<string, unknown>>
        expect(metrics["duration"]).toBe(1800000)
        expect(metrics["costEstimate"]).toBeCloseTo(0.3)
        expect(metrics["metricsUpdatedAt"]).toBe("2026-03-03T13:30:00.000Z")
        const pendingEvents = result.value.state.externalContext?.["pendingDomainEvents"] as
            | readonly Readonly<Record<string, unknown>>[]
            | undefined
        expect(pendingEvents).toHaveLength(1)
        expect(pendingEvents?.[0]?.["eventName"]).toBe("MetricsCalculated")
    })

    test("keeps existing pending events and handles missing duration source", async () => {
        const useCase = new UpdateMetricsStageUseCase({
            now: () => new Date("2026-03-03T14:00:00.000Z"),
        })
        const state = createState(
            {
                issueCount: 1,
                riskScore: 20,
                tokenUsage: {
                    input: 10,
                    output: 5,
                    total: 15,
                },
            },
            {
                pendingDomainEvents: [
                    {
                        eventName: "MetricsCalculated",
                        aggregateId: "run-old",
                        occurredAt: "2026-03-03T12:00:00.000Z",
                        payload: {
                            reviewId: "run-old",
                            tokenUsage: {
                                inputTokens: 1,
                                outputTokens: 1,
                                totalTokens: 2,
                            },
                            costEstimate: 0,
                            duration: 100,
                        },
                    },
                ],
            },
            {},
        )

        const result = await useCase.execute({
            state,
        })

        expect(result.isOk).toBe(true)
        const metrics = result.value.state.metrics as Readonly<Record<string, unknown>>
        expect(metrics["duration"]).toBe(0)
        const pendingEvents = result.value.state.externalContext?.["pendingDomainEvents"] as
            | readonly Readonly<Record<string, unknown>>[]
            | undefined
        expect(pendingEvents).toHaveLength(2)
    })

    test("returns recoverable stage error when metrics update throws unexpectedly", async () => {
        const useCase = new UpdateMetricsStageUseCase({
            now: () => {
                throw new Error("clock unavailable")
            },
        })
        const state = createState(null, null, {})

        const result = await useCase.execute({
            state,
        })

        expect(result.isFail).toBe(true)
        expect(result.error.recoverable).toBe(true)
        expect(result.error.message).toContain("update metrics stage payload")
    })
})
