import {describe, expect, test} from "bun:test"

import {
    ONBOARDING_SUMMARY_PROMPT_ERROR_CODE,
    OnboardingSummaryPrompt,
    OnboardingSummaryPromptError,
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

describe("OnboardingSummaryPrompt", () => {
    test("builds onboarding summary prompt from scan data", async () => {
        const promptBuilder = new OnboardingSummaryPrompt()

        const prompt = await promptBuilder.build({
            projectName: "CodeNautic",
            techStack: [
                "TypeScript",
                "Bun",
                "React",
            ],
            architectureHighlights: [
                "Clean Architecture + Hexagonal",
                "20-stage review pipeline",
            ],
            metrics: [
                {
                    name: "Repositories connected",
                    value: 124,
                },
                {
                    name: "Average review latency",
                    value: 7.2,
                    unit: "min",
                },
            ],
            additionalContext: "Most active teams are platform and infra.",
        })

        expect(prompt).toContain("Create a concise onboarding summary")
        expect(prompt).toContain("Project: CodeNautic")
        expect(prompt).toContain("TypeScript")
        expect(prompt).toContain("20-stage review pipeline")
        expect(prompt).toContain("Average review latency: 7.2 min")
        expect(prompt).toContain("Most active teams are platform and infra.")
    })

    test("retries additional context loading with backoff", async () => {
        let attempts = 0
        const slept: number[] = []
        const promptBuilder = new OnboardingSummaryPrompt({
            maxAttempts: 2,
            retryBackoffMs: 9,
            sleep(delayMs: number): Promise<void> {
                slept.push(delayMs)
                return Promise.resolve()
            },
        })

        const prompt = await promptBuilder.build({
            techStack: ["TypeScript"],
            architectureHighlights: ["Hexagonal adapters"],
            metrics: [
                {
                    name: "Files scanned",
                    value: 9210,
                },
            ],
            loadAdditionalContext(): Promise<string> {
                attempts += 1
                if (attempts === 1) {
                    return Promise.reject(new Error("context unavailable"))
                }
                return Promise.resolve("Context recovered")
            },
        })

        expect(attempts).toBe(2)
        expect(slept).toEqual([9])
        expect(prompt).toContain("Context recovered")
    })

    test("deduplicates idempotent prompt builds and serves cached value", async () => {
        let attempts = 0
        let resolveContext: ((value: string) => void) | undefined
        const promptBuilder = new OnboardingSummaryPrompt()
        const input = {
            techStack: ["TypeScript"],
            architectureHighlights: ["Monorepo"],
            metrics: [
                {
                    name: "Contributors",
                    value: 12,
                },
            ],
            idempotencyKey: "onboarding-1",
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
        resolveContext("Late context")

        const [firstPrompt, secondPrompt] = await Promise.all([firstBuild, secondBuild])
        expect(firstPrompt).toBe(secondPrompt)
        expect(attempts).toBe(1)

        const cachedPrompt = await promptBuilder.build(input)
        expect(cachedPrompt).toBe(firstPrompt)
        expect(attempts).toBe(1)
    })

    test("returns typed validation error when tech stack is empty", async () => {
        const promptBuilder = new OnboardingSummaryPrompt()
        const error = await captureRejectedError(() =>
            promptBuilder.build({
                techStack: [],
                architectureHighlights: ["Hexagonal"],
                metrics: [
                    {
                        name: "Repos",
                        value: 1,
                    },
                ],
            }),
        )

        expect(error).toBeInstanceOf(OnboardingSummaryPromptError)
        if (error instanceof OnboardingSummaryPromptError) {
            expect(error.code).toBe(ONBOARDING_SUMMARY_PROMPT_ERROR_CODE.INVALID_TECH_STACK)
        }
    })
})
