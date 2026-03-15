import {describe, expect, test} from "bun:test"

import {
    REFACTORING_ADVICE_PROMPT_ERROR_CODE,
    RefactoringAdvicePrompt,
    RefactoringAdvicePromptError,
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

describe("RefactoringAdvicePrompt", () => {
    test("builds deterministic refactoring strategy prompt from metrics and coupling data", async () => {
        const promptBuilder = new RefactoringAdvicePrompt()

        const prompt = await promptBuilder.build({
            scopeName: "packages/runtime/src/analytics",
            codeMetrics: [
                {
                    name: "Cyclomatic complexity",
                    value: 27,
                },
                {
                    name: "Average function length",
                    value: 41.3,
                    unit: "lines",
                },
            ],
            couplingData: [
                {
                    sourcePath: "runtime/src/analytics/ownership.worker.ts",
                    targetPath: "runtime/src/analytics/metrics.service.ts",
                    strength: 0.73,
                    sharedCommitCount: 11,
                    lastSeenAt: "2026-02-28T10:00:00.000Z",
                },
                {
                    sourcePath: "runtime/src/analytics/metrics.service.ts",
                    targetPath: "runtime/src/analytics/hotspot.service.ts",
                    strength: 0.91,
                    sharedCommitCount: 19,
                    lastSeenAt: "2026-03-02T09:30:00.000Z",
                },
            ],
            architectureConstraints: [
                "Keep infrastructure adapters outside application use cases",
                "Preserve async worker throughput baseline",
            ],
            additionalContext:
                "Current incidents show retry storms during analytics backfills.",
        })

        expect(prompt).toContain("Suggest a pragmatic refactoring strategy")
        expect(prompt).toContain("Scope: packages/runtime/src/analytics")
        expect(prompt).toContain("Cyclomatic complexity: 27")
        expect(prompt).toContain("Temporal coupling edges:")
        expect(prompt).toContain(
            "runtime/src/analytics/metrics.service.ts -> runtime/src/analytics/hotspot.service.ts",
        )
        expect(prompt).toContain("Keep infrastructure adapters outside application use cases")
        expect(prompt).toContain("retry storms during analytics backfills")
    })

    test("retries additional context loading with configured backoff", async () => {
        let attempts = 0
        const slept: number[] = []
        const promptBuilder = new RefactoringAdvicePrompt({
            maxAttempts: 2,
            retryBackoffMs: 7,
            sleep(delayMs: number): Promise<void> {
                slept.push(delayMs)
                return Promise.resolve()
            },
        })

        const prompt = await promptBuilder.build({
            codeMetrics: [
                {
                    name: "Hotspot density",
                    value: 0.64,
                },
            ],
            couplingData: [
                {
                    sourcePath: "src/core/use-cases/review.ts",
                    targetPath: "src/core/domain/review.aggregate.ts",
                    strength: 0.82,
                    sharedCommitCount: 8,
                    lastSeenAt: "2026-03-01T10:00:00Z",
                },
            ],
            loadAdditionalContext(): Promise<string> {
                attempts += 1
                if (attempts === 1) {
                    return Promise.reject(new Error("temporary data outage"))
                }

                return Promise.resolve("Refactoring debt appears after release branches merge.")
            },
        })

        expect(attempts).toBe(2)
        expect(slept).toEqual([7])
        expect(prompt).toContain("Refactoring debt appears after release branches merge.")
    })

    test("deduplicates idempotent prompt builds and serves cached value", async () => {
        let attempts = 0
        let resolveContext: ((value: string) => void) | undefined
        const promptBuilder = new RefactoringAdvicePrompt()
        const input = {
            codeMetrics: [
                {
                    name: "Class instability",
                    value: 0.58,
                },
            ],
            couplingData: [
                {
                    sourcePath: "src/a.ts",
                    targetPath: "src/b.ts",
                    strength: 0.67,
                    sharedCommitCount: 5,
                    lastSeenAt: "2026-03-01T10:00:00.000Z",
                },
            ],
            idempotencyKey: "refactoring-021",
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
        resolveContext("Context returned once")

        const [firstPrompt, secondPrompt] = await Promise.all([firstBuild, secondBuild])
        expect(firstPrompt).toBe(secondPrompt)
        expect(attempts).toBe(1)

        const cachedPrompt = await promptBuilder.build(input)
        expect(cachedPrompt).toBe(firstPrompt)
        expect(attempts).toBe(1)
    })

    test("returns typed validation error when coupling data is empty", async () => {
        const promptBuilder = new RefactoringAdvicePrompt()

        const error = await captureRejectedError(() =>
            promptBuilder.build({
                codeMetrics: [
                    {
                        name: "Complexity",
                        value: 14,
                    },
                ],
                couplingData: [],
            }),
        )

        expect(error).toBeInstanceOf(RefactoringAdvicePromptError)
        if (error instanceof RefactoringAdvicePromptError) {
            expect(error.code).toBe(REFACTORING_ADVICE_PROMPT_ERROR_CODE.INVALID_COUPLING_DATA)
        }
    })
})
