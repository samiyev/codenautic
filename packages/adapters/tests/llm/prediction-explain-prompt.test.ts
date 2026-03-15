import {describe, expect, test} from "bun:test"

import {
    PREDICTION_EXPLAIN_PROMPT_ERROR_CODE,
    PredictionExplainPrompt,
    PredictionExplainPromptError,
} from "../../src/llm"

/**
 * Captures rejected error for assertion-friendly checks.
 *
 * @param execute Async action expected to fail.
 * @returns Rejected error instance.
 */
async function captureRejectedError(execute: () => Promise<unknown>): Promise<Error> {
    try {
        await execute()
    } catch (error) {
        if (error instanceof Error) {
            return error
        }

        throw new Error("Expected error object to be thrown")
    }

    throw new Error("Expected promise to reject")
}

describe("PredictionExplainPrompt", () => {
    test("builds deterministic narrative prompt from metrics and trends", async () => {
        const promptBuilder = new PredictionExplainPrompt()

        const prompt = await promptBuilder.build({
            metrics: [
                {
                    name: "Defect escape rate",
                    value: 12.4,
                    unit: "%",
                },
                {
                    name: "Review throughput",
                    value: 83,
                    unit: "reviews/week",
                },
            ],
            trends: [
                {
                    metricName: "Review throughput",
                    direction: "up",
                    changePercent: 14.1,
                    window: "last 2 weeks",
                },
                {
                    metricName: "Defect escape rate",
                    direction: "down",
                    changePercent: -6.8,
                    window: "last 2 weeks",
                },
            ],
            confidenceScore: 0.81,
            additionalContext:
                "Repository migrated to monorepo and introduced staged codeowners policy.",
        })

        expect(prompt).toContain("Explain the prediction in clear natural language")
        expect(prompt).toContain("Defect escape rate: 12.4 %")
        expect(prompt).toContain("Review throughput: 83 reviews/week")
        expect(prompt).toContain("Confidence score: 0.81")
        expect(prompt).toContain("Repository migrated to monorepo")
    })

    test("retries additional context loading with configured backoff", async () => {
        let loadAttempts = 0
        const slept: number[] = []
        const promptBuilder = new PredictionExplainPrompt({
            maxAttempts: 2,
            retryBackoffMs: 13,
            sleep(delayMs: number): Promise<void> {
                slept.push(delayMs)
                return Promise.resolve()
            },
        })

        const prompt = await promptBuilder.build({
            metrics: [
                {
                    name: "Cycle time",
                    value: 5.1,
                    unit: "days",
                },
            ],
            trends: [
                {
                    metricName: "Cycle time",
                    direction: "up",
                    changePercent: 9.3,
                    window: "last sprint",
                },
            ],
            loadAdditionalContext(): Promise<string> {
                loadAttempts += 1
                if (loadAttempts === 1) {
                    return Promise.reject(new Error("temporary context error"))
                }

                return Promise.resolve("Context loaded from analytics history.")
            },
        })

        expect(loadAttempts).toBe(2)
        expect(slept).toEqual([13])
        expect(prompt).toContain("Context loaded from analytics history.")
    })

    test("deduplicates idempotent prompt builds and serves cached value", async () => {
        let resolveContext: ((value: string) => void) | undefined
        let loadAttempts = 0
        const promptBuilder = new PredictionExplainPrompt()
        const input = {
            metrics: [
                {
                    name: "Risk score",
                    value: 0.62,
                },
            ],
            trends: [
                {
                    metricName: "Risk score",
                    direction: "up",
                    changePercent: 5,
                    window: "last week",
                },
            ],
            idempotencyKey: "prediction-run-1",
            loadAdditionalContext(): Promise<string> {
                loadAttempts += 1
                return new Promise((resolve) => {
                    resolveContext = resolve
                })
            },
        } as const

        const firstBuildPromise = promptBuilder.build(input)
        const secondBuildPromise = promptBuilder.build(input)

        if (resolveContext === undefined) {
            throw new Error("Expected context loader promise to be created")
        }
        resolveContext("Asynchronous context payload")

        const [firstPrompt, secondPrompt] = await Promise.all([
            firstBuildPromise,
            secondBuildPromise,
        ])

        expect(firstPrompt).toBe(secondPrompt)
        expect(loadAttempts).toBe(1)

        const cachedPrompt = await promptBuilder.build(input)
        expect(cachedPrompt).toBe(firstPrompt)
        expect(loadAttempts).toBe(1)
    })

    test("returns typed validation error for invalid input", async () => {
        const promptBuilder = new PredictionExplainPrompt()

        const error = await captureRejectedError(() =>
            promptBuilder.build({
                metrics: [],
                trends: [],
            }),
        )

        expect(error).toBeInstanceOf(PredictionExplainPromptError)
        if (error instanceof PredictionExplainPromptError) {
            expect(error.code).toBe(PREDICTION_EXPLAIN_PROMPT_ERROR_CODE.INVALID_METRICS)
        }
    })
})
