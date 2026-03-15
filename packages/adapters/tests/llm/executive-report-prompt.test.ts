import {describe, expect, test} from "bun:test"

import {
    EXECUTIVE_REPORT_PROMPT_ERROR_CODE,
    ExecutiveReportPrompt,
    ExecutiveReportPromptError,
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

describe("ExecutiveReportPrompt", () => {
    test("builds executive narrative prompt from repository state and trends", async () => {
        const promptBuilder = new ExecutiveReportPrompt()

        const prompt = await promptBuilder.build({
            reportPeriod: "Q1 2026",
            repoState: [
                {
                    name: "Open pull requests",
                    value: 47,
                },
                {
                    name: "Median review cycle time",
                    value: 2.8,
                    unit: "days",
                },
            ],
            trends: [
                {
                    name: "Review throughput",
                    direction: "up",
                    changePercent: 12.4,
                    window: "last 30 days",
                },
                {
                    name: "Regression incidents",
                    direction: "down",
                    changePercent: -18.1,
                    window: "last 30 days",
                },
            ],
            highlights: [
                "Rollout of repository health dashboards completed.",
                "Critical review SLA met for 93% of merge requests.",
            ],
            risks: [
                "Knowledge concentration remains high in AST pipeline code.",
            ],
            additionalContext:
                "Leadership requested decision-ready narrative for next investment review.",
        })

        expect(prompt).toContain("Generate an executive narrative report")
        expect(prompt).toContain("Reporting period: Q1 2026")
        expect(prompt).toContain("Median review cycle time: 2.8 days")
        expect(prompt).toContain("Review throughput: up (last 30 days, change: 12.4%)")
        expect(prompt).toContain("Highlights:")
        expect(prompt).toContain("Knowledge concentration remains high in AST pipeline code.")
    })

    test("retries additional context loading with configured backoff", async () => {
        let attempts = 0
        const slept: number[] = []
        const promptBuilder = new ExecutiveReportPrompt({
            maxAttempts: 2,
            retryBackoffMs: 11,
            sleep(delayMs: number): Promise<void> {
                slept.push(delayMs)
                return Promise.resolve()
            },
        })

        const prompt = await promptBuilder.build({
            repoState: [
                {
                    name: "Deployment frequency",
                    value: 16,
                    unit: "per week",
                },
            ],
            trends: [
                {
                    name: "Deployment frequency",
                    direction: "up",
                    changePercent: 9.5,
                    window: "last 4 weeks",
                },
            ],
            highlights: ["Stabilized release cut process in runtime workers."],
            loadAdditionalContext(): Promise<string> {
                attempts += 1
                if (attempts === 1) {
                    return Promise.reject(new Error("analytics sync lag"))
                }
                return Promise.resolve("Finance requested explicit impact framing for board update.")
            },
        })

        expect(attempts).toBe(2)
        expect(slept).toEqual([11])
        expect(prompt).toContain("Finance requested explicit impact framing for board update.")
    })

    test("deduplicates idempotent prompt builds and serves cached value", async () => {
        let attempts = 0
        let resolveContext: ((value: string) => void) | undefined
        const promptBuilder = new ExecutiveReportPrompt()
        const input = {
            repoState: [
                {
                    name: "Code churn",
                    value: 324,
                    unit: "files/month",
                },
            ],
            trends: [
                {
                    name: "Code churn",
                    direction: "stable",
                    changePercent: 0.8,
                    window: "last month",
                },
            ],
            highlights: ["Monorepo migration reached phase 2 completion."],
            idempotencyKey: "executive-report-022",
            loadAdditionalContext(): Promise<string> {
                attempts += 1
                return new Promise((resolve) => {
                    resolveContext = resolve
                })
            },
        } as const

        const firstBuild = promptBuilder.build(input)
        const secondBuild = promptBuilder.build(input)

        if (resolveContext === undefined) {
            throw new Error("Expected context loader promise to be created")
        }
        resolveContext("Context generated once.")

        const [firstPrompt, secondPrompt] = await Promise.all([firstBuild, secondBuild])
        expect(firstPrompt).toBe(secondPrompt)
        expect(attempts).toBe(1)

        const cachedPrompt = await promptBuilder.build(input)
        expect(cachedPrompt).toBe(firstPrompt)
        expect(attempts).toBe(1)
    })

    test("returns typed validation error when highlights are empty", async () => {
        const promptBuilder = new ExecutiveReportPrompt()

        const error = await captureRejectedError(() =>
            promptBuilder.build({
                repoState: [
                    {
                        name: "Open incidents",
                        value: 3,
                    },
                ],
                trends: [
                    {
                        name: "Open incidents",
                        direction: "down",
                        changePercent: -25,
                        window: "last 2 weeks",
                    },
                ],
                highlights: [],
            }),
        )

        expect(error).toBeInstanceOf(ExecutiveReportPromptError)
        if (error instanceof ExecutiveReportPromptError) {
            expect(error.code).toBe(EXECUTIVE_REPORT_PROMPT_ERROR_CODE.INVALID_HIGHLIGHTS)
        }
    })
})
