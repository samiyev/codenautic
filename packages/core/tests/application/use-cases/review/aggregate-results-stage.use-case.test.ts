import {describe, expect, test} from "bun:test"

import {ReviewPipelineState} from "../../../../src/application/types/review/review-pipeline-state"
import {AggregateResultsStageUseCase} from "../../../../src/application/use-cases/review/aggregate-results-stage.use-case"

/**
 * Creates state for aggregate-results stage tests.
 *
 * @param suggestions Suggestions payload.
 * @param files Files payload.
 * @param externalContext External context payload.
 * @param metrics Metrics payload.
 * @returns Pipeline state.
 */
function createState(
    suggestions: readonly Readonly<Record<string, unknown>>[],
    files: readonly Readonly<Record<string, unknown>>[],
    externalContext: Readonly<Record<string, unknown>> | null,
    metrics: Readonly<Record<string, unknown>> | null,
): ReviewPipelineState {
    return ReviewPipelineState.create({
        runId: "run-aggregate-results",
        definitionVersion: "v1",
        mergeRequest: {
            id: "mr-60",
        },
        config: {},
        suggestions,
        files,
        externalContext,
        metrics,
    })
}

describe("AggregateResultsStageUseCase", () => {
    test("uses default now provider when dependency is omitted", async () => {
        const useCase = new AggregateResultsStageUseCase()
        const state = createState([], [], null, null)

        const result = await useCase.execute({
            state,
        })

        expect(result.isOk).toBe(true)
        const metrics = result.value.state.metrics as Readonly<Record<string, unknown>>
        expect(typeof metrics["aggregatedAt"]).toBe("string")
    })

    test("aggregates issue metrics, severity distribution, token usage and risk score", async () => {
        const useCase = new AggregateResultsStageUseCase({
            now: () => new Date("2026-03-03T10:00:00.000Z"),
        })
        const state = createState(
            [
                {
                    id: "s1",
                    filePath: "src/a.ts",
                    lineStart: 3,
                    lineEnd: 3,
                    severity: "CRITICAL",
                    category: "security",
                    message: "Critical issue",
                    committable: true,
                    rankScore: 95,
                },
                {
                    id: "s2",
                    filePath: "src/b.ts",
                    lineStart: 7,
                    lineEnd: 7,
                    severity: "HIGH",
                    category: "bug",
                    message: "High issue",
                    committable: true,
                    rankScore: 80,
                },
                {
                    id: "s3",
                    filePath: "src/b.ts",
                    lineStart: 12,
                    lineEnd: 12,
                    severity: "LOW",
                    category: "style",
                    message: "Low issue",
                    committable: true,
                    rankScore: 30,
                },
            ],
            [{path: "src/a.ts"}, {path: "src/b.ts"}],
            {
                ccrTokenUsage: {
                    input: 10,
                    output: 5,
                    total: 15,
                },
                fileTokenUsage: {
                    input: 4,
                    output: 3,
                    total: 7,
                },
                fileReviewStats: {
                    timedOutFiles: 1,
                    failedFiles: 1,
                },
            },
            null,
        )

        const result = await useCase.execute({
            state,
        })

        expect(result.isOk).toBe(true)
        expect(result.value.metadata?.checkpointHint).toBe("results:aggregated")
        const metrics = result.value.state.metrics as Readonly<Record<string, unknown>>
        expect(metrics["issueCount"]).toBe(3)
        expect(metrics["fileCount"]).toBe(2)
        expect(metrics["aggregatedAt"]).toBe("2026-03-03T10:00:00.000Z")
        const severityDistribution = metrics["severityDistribution"] as Readonly<Record<string, unknown>>
        expect(severityDistribution["CRITICAL"]).toBe(1)
        expect(severityDistribution["HIGH"]).toBe(1)
        expect(severityDistribution["LOW"]).toBe(1)
        const tokenUsage = metrics["tokenUsage"] as Readonly<Record<string, unknown>>
        expect(tokenUsage["input"]).toBe(14)
        expect(tokenUsage["output"]).toBe(8)
        expect(tokenUsage["total"]).toBe(22)
        const riskScore = metrics["riskScore"]
        expect(typeof riskScore).toBe("number")
        expect((riskScore as number) > 0).toBe(true)
        const aggregatedResults = result.value.state.externalContext?.["aggregatedResults"] as
            | Readonly<Record<string, unknown>>
            | undefined
        expect(aggregatedResults?.["issueCount"]).toBe(3)
    })

    test("keeps existing metrics and ignores malformed suggestions", async () => {
        const useCase = new AggregateResultsStageUseCase({
            now: () => new Date("2026-03-03T11:00:00.000Z"),
        })
        const state = createState(
            [
                {
                    id: "valid",
                    filePath: "src/a.ts",
                    lineStart: 1,
                    lineEnd: 1,
                    severity: "MEDIUM",
                    category: "quality",
                    message: "Valid suggestion",
                    committable: true,
                    rankScore: 50,
                },
                {
                    id: "broken",
                    filePath: "src/b.ts",
                },
            ],
            [{path: "src/a.ts"}],
            null,
            {
                retainedMetric: "yes",
            },
        )

        const result = await useCase.execute({
            state,
        })

        expect(result.isOk).toBe(true)
        const metrics = result.value.state.metrics as Readonly<Record<string, unknown>>
        expect(metrics["retainedMetric"]).toBe("yes")
        expect(metrics["issueCount"]).toBe(1)
        const tokenUsage = metrics["tokenUsage"] as Readonly<Record<string, unknown>>
        expect(tokenUsage["input"]).toBe(0)
        expect(tokenUsage["output"]).toBe(0)
        expect(tokenUsage["total"]).toBe(0)
    })

    test("returns recoverable stage error when aggregation throws unexpectedly", async () => {
        const useCase = new AggregateResultsStageUseCase({
            now: () => {
                throw new Error("clock unavailable")
            },
        })
        const state = createState([], [], null, null)

        const result = await useCase.execute({
            state,
        })

        expect(result.isFail).toBe(true)
        expect(result.error.recoverable).toBe(true)
        expect(result.error.message).toContain("aggregate review results")
    })
})
