import {describe, expect, test} from "bun:test"
import type {IFileBlame} from "@codenautic/core"

import {
    AST_OWNERSHIP_CALCULATOR_ERROR_CODE,
    AstOwnershipCalculatorError,
    AstOwnershipCalculatorService,
    type AstOwnershipCalculatorFetchBlameBatch,
    type IAstOwnershipCalculatorResult,
} from "../../src/ast"

type AstOwnershipCalculatorErrorCode =
    (typeof AST_OWNERSHIP_CALCULATOR_ERROR_CODE)[keyof typeof AST_OWNERSHIP_CALCULATOR_ERROR_CODE]

/**
 * Asserts typed ownership calculator error for async action.
 *
 * @param callback Action expected to throw typed error.
 * @param code Expected error code.
 * @returns Promise resolved when assertion passes.
 */
async function expectAstOwnershipCalculatorError(
    callback: () => Promise<unknown>,
    code: AstOwnershipCalculatorErrorCode,
): Promise<void> {
    try {
        await callback()
    } catch (error) {
        expect(error).toBeInstanceOf(AstOwnershipCalculatorError)

        if (error instanceof AstOwnershipCalculatorError) {
            expect(error.code).toBe(code)
            return
        }
    }

    throw new Error("Expected AstOwnershipCalculatorError to be thrown")
}

/**
 * Creates deterministic blame payload for ownership tests.
 *
 * @returns Blame payload with two files and three contributors.
 */
function createSampleBlamePayload(): readonly IFileBlame[] {
    return [
        {
            filePath: "src/a.ts",
            blame: [
                {
                    lineStart: 1,
                    lineEnd: 6,
                    commitSha: "aaaa1111",
                    authorName: "Alice",
                    authorEmail: "Alice@Example.com",
                    date: "2026-03-10T00:00:00.000Z",
                },
                {
                    lineStart: 7,
                    lineEnd: 10,
                    commitSha: "bbbb2222",
                    authorName: "Bob",
                    authorEmail: "bob@example.com",
                    date: "2026-03-12T00:00:00.000Z",
                },
                {
                    lineStart: 11,
                    lineEnd: 12,
                    commitSha: "cccc3333",
                    authorName: "Alice",
                    authorEmail: "alice@example.com",
                    date: "2026-03-15T00:00:00.000Z",
                },
            ],
        },
        {
            filePath: "src/b.ts",
            blame: [
                {
                    lineStart: 1,
                    lineEnd: 3,
                    commitSha: "bbbb2222",
                    authorName: "Bob",
                    authorEmail: "bob@example.com",
                    date: "2026-03-13T00:00:00.000Z",
                },
                {
                    lineStart: 4,
                    lineEnd: 5,
                    commitSha: "dddd4444",
                    authorName: "Charlie",
                    authorEmail: "charlie@example.com",
                    date: "2026-03-14T00:00:00.000Z",
                },
                {
                    lineStart: 6,
                    lineEnd: 6,
                    commitSha: "eeee5555",
                    authorName: "Bob",
                    authorEmail: "bob@example.com",
                    date: "2026-03-15T00:00:00.000Z",
                },
            ],
        },
    ]
}

describe("AstOwnershipCalculatorService", () => {
    test("calculates primary and secondary ownership with configurable thresholds", async () => {
        const service = new AstOwnershipCalculatorService({
            fetchBlameBatch: () => Promise.resolve(createSampleBlamePayload()),
            primaryOwnershipThreshold: 0.6,
            secondaryOwnershipThreshold: 0.3,
            now: () => Date.parse("2026-03-15T12:00:00.000Z"),
        })

        const result = await service.calculate({
            ref: " main ",
            filePaths: [" src/b.ts ", "src/a.ts"],
        })

        expect(result.items).toEqual([
            {
                filePath: "src/a.ts",
                totalLines: 12,
                ownerCount: 2,
                primaryOwner: {
                    contributorKey: "email:alice@example.com",
                    authorName: "Alice",
                    authorEmail: "alice@example.com",
                    lineCount: 8,
                    ownershipRatio: 0.666667,
                    lastSeenAt: "2026-03-15T00:00:00.000Z",
                },
                hasDominantPrimaryOwner: true,
                secondaryOwners: [
                    {
                        contributorKey: "email:bob@example.com",
                        authorName: "Bob",
                        authorEmail: "bob@example.com",
                        lineCount: 4,
                        ownershipRatio: 0.333333,
                        lastSeenAt: "2026-03-12T00:00:00.000Z",
                    },
                ],
                owners: [
                    {
                        contributorKey: "email:alice@example.com",
                        authorName: "Alice",
                        authorEmail: "alice@example.com",
                        lineCount: 8,
                        ownershipRatio: 0.666667,
                        lastSeenAt: "2026-03-15T00:00:00.000Z",
                    },
                    {
                        contributorKey: "email:bob@example.com",
                        authorName: "Bob",
                        authorEmail: "bob@example.com",
                        lineCount: 4,
                        ownershipRatio: 0.333333,
                        lastSeenAt: "2026-03-12T00:00:00.000Z",
                    },
                ],
            },
            {
                filePath: "src/b.ts",
                totalLines: 6,
                ownerCount: 2,
                primaryOwner: {
                    contributorKey: "email:bob@example.com",
                    authorName: "Bob",
                    authorEmail: "bob@example.com",
                    lineCount: 4,
                    ownershipRatio: 0.666667,
                    lastSeenAt: "2026-03-15T00:00:00.000Z",
                },
                hasDominantPrimaryOwner: true,
                secondaryOwners: [
                    {
                        contributorKey: "email:charlie@example.com",
                        authorName: "Charlie",
                        authorEmail: "charlie@example.com",
                        lineCount: 2,
                        ownershipRatio: 0.333333,
                        lastSeenAt: "2026-03-14T00:00:00.000Z",
                    },
                ],
                owners: [
                    {
                        contributorKey: "email:bob@example.com",
                        authorName: "Bob",
                        authorEmail: "bob@example.com",
                        lineCount: 4,
                        ownershipRatio: 0.666667,
                        lastSeenAt: "2026-03-15T00:00:00.000Z",
                    },
                    {
                        contributorKey: "email:charlie@example.com",
                        authorName: "Charlie",
                        authorEmail: "charlie@example.com",
                        lineCount: 2,
                        ownershipRatio: 0.333333,
                        lastSeenAt: "2026-03-14T00:00:00.000Z",
                    },
                ],
            },
        ])
        expect(result.summary).toEqual({
            fileCount: 2,
            totalLines: 18,
            uniqueOwnerCount: 3,
            dominantPrimaryOwnerFileCount: 2,
            filesWithSecondaryOwners: 2,
            averagePrimaryOwnershipRatio: 0.666667,
            primaryOwnershipThreshold: 0.6,
            secondaryOwnershipThreshold: 0.3,
            generatedAt: "2026-03-15T12:00:00.000Z",
        })
    })

    test("deduplicates in-flight requests and serves cached idempotent result", async () => {
        let fetchCalls = 0
        const gate = createDeferred()

        const fetchBlameBatch: AstOwnershipCalculatorFetchBlameBatch = () => {
            fetchCalls += 1
            return gate.promise.then(() => {
                return [
                    {
                        filePath: "src/a.ts",
                        blame: [
                            {
                                lineStart: 1,
                                lineEnd: 2,
                                commitSha: "aaaa1111",
                                authorName: "Alice",
                                authorEmail: "alice@example.com",
                                date: "2026-03-15T00:00:00.000Z",
                            },
                        ],
                    },
                ]
            })
        }
        const service = new AstOwnershipCalculatorService({
            fetchBlameBatch,
            cacheTtlMs: 5000,
            now: () => Date.parse("2026-03-15T12:00:00.000Z"),
        })

        const pendingFirst = service.calculate({
            ref: "main",
            filePaths: ["src/a.ts"],
        })
        const pendingSecond = service.calculate({
            ref: "main",
            filePaths: ["src/a.ts"],
        })

        gate.resolve()

        const [firstResult, secondResult] = await Promise.all([pendingFirst, pendingSecond])
        const thirdResult = await service.calculate({
            ref: "main",
            filePaths: ["src/a.ts"],
        })

        expect(fetchCalls).toBe(1)
        expect(secondResult).toEqual(firstResult)
        expect(thirdResult).toEqual(firstResult)
    })

    test("retries transient fetch failures with configured backoff", async () => {
        const sleepCalls: number[] = []
        let fetchCalls = 0
        const service = new AstOwnershipCalculatorService({
            fetchBlameBatch: (): Promise<ReturnType<typeof createSampleBlamePayload>> => {
                fetchCalls += 1
                if (fetchCalls === 1) {
                    throw new Error("temporary gateway timeout")
                }

                return Promise.resolve([
                    {
                        filePath: "src/a.ts",
                        blame: [
                            {
                                lineStart: 1,
                                lineEnd: 1,
                                commitSha: "aaaa1111",
                                authorName: "Alice",
                                authorEmail: "alice@example.com",
                                date: "2026-03-15T00:00:00.000Z",
                            },
                        ],
                    },
                ])
            },
            maxFetchAttempts: 2,
            retryBackoffMs: 17,
            sleep: (milliseconds) => {
                sleepCalls.push(milliseconds)
                return Promise.resolve()
            },
        })

        const result = await service.calculate({
            ref: "main",
            filePaths: ["src/a.ts"],
        })

        expect(fetchCalls).toBe(2)
        expect(sleepCalls).toEqual([17])
        expect(result.summary.fileCount).toBe(1)
        expect(result.items[0]?.primaryOwner?.authorEmail).toBe("alice@example.com")
    })

    test("throws retry exhausted error when all fetch attempts fail", async () => {
        const service = new AstOwnershipCalculatorService({
            fetchBlameBatch: () => Promise.reject(new Error("upstream unavailable")),
            maxFetchAttempts: 3,
            retryBackoffMs: 0,
        })

        await expectAstOwnershipCalculatorError(
            () =>
                service.calculate({
                    ref: "main",
                    filePaths: ["src/a.ts"],
                }),
            AST_OWNERSHIP_CALCULATOR_ERROR_CODE.RETRY_EXHAUSTED,
        )
    })

    test("throws typed errors for invalid constructor and input payloads", async () => {
        expect(() => {
            return new AstOwnershipCalculatorService({
                fetchBlameBatch: () => Promise.resolve([]),
                primaryOwnershipThreshold: 0.4,
                secondaryOwnershipThreshold: 0.5,
            })
        }).toThrow(AstOwnershipCalculatorError)

        const service = new AstOwnershipCalculatorService({
            fetchBlameBatch: () => Promise.resolve([]),
        })

        await expectAstOwnershipCalculatorError(
            () =>
                service.calculate({
                    ref: " ",
                    filePaths: ["src/a.ts"],
                }),
            AST_OWNERSHIP_CALCULATOR_ERROR_CODE.INVALID_REF,
        )

        await expectAstOwnershipCalculatorError(
            () =>
                service.calculate({
                    ref: "main",
                    filePaths: [],
                }),
            AST_OWNERSHIP_CALCULATOR_ERROR_CODE.EMPTY_FILE_PATHS,
        )

        await expectAstOwnershipCalculatorError(
            () =>
                service.calculate({
                    ref: "main",
                    filePaths: ["src/a.ts", "src/a.ts"],
                }),
            AST_OWNERSHIP_CALCULATOR_ERROR_CODE.DUPLICATE_FILE_PATH,
        )
    })

    test("throws typed error for invalid blame range payload", async () => {
        const service = new AstOwnershipCalculatorService({
            fetchBlameBatch: () =>
                Promise.resolve([
                    {
                        filePath: "src/a.ts",
                        blame: [
                            {
                                lineStart: 3,
                                lineEnd: 2,
                                commitSha: "aaaa1111",
                                authorName: "Alice",
                                authorEmail: "alice@example.com",
                                date: "2026-03-15T00:00:00.000Z",
                            },
                        ],
                    },
                ]),
        })

        await expectAstOwnershipCalculatorError(
            () =>
                service.calculate({
                    ref: "main",
                    filePaths: ["src/a.ts"],
                }),
            AST_OWNERSHIP_CALCULATOR_ERROR_CODE.INVALID_BLAME_ENTRY,
        )
    })

    test("returns cloned results so caller mutations do not poison cache", async () => {
        const service = new AstOwnershipCalculatorService({
            fetchBlameBatch: () => Promise.resolve(createSampleBlamePayload()),
            cacheTtlMs: 10000,
            now: () => Date.parse("2026-03-15T12:00:00.000Z"),
        })

        const firstResult = await service.calculate({
            ref: "main",
            filePaths: ["src/a.ts", "src/b.ts"],
        })
        mutateOwnershipResult(firstResult)
        const secondResult = await service.calculate({
            ref: "main",
            filePaths: ["src/a.ts", "src/b.ts"],
        })

        expect(secondResult.items[0]?.filePath).toBe("src/a.ts")
        expect(secondResult.items[0]?.owners[0]?.lineCount).toBe(8)
    })
})

/**
 * Mutates ownership result payload to verify defensive cloning.
 *
 * @param result Ownership result.
 */
function mutateOwnershipResult(result: IAstOwnershipCalculatorResult): void {
    const firstItem = result.items[0]
    if (firstItem !== undefined) {
        ;(firstItem as {filePath: string}).filePath = "mutated.ts"
    }

    const firstOwner = result.items[0]?.owners[0]
    if (firstOwner !== undefined) {
        ;(firstOwner as {lineCount: number}).lineCount = 0
    }
}

/**
 * Creates minimal deferred primitive for async test orchestration.
 *
 * @returns Deferred promise and resolve callback.
 */
function createDeferred(): {
    readonly promise: Promise<void>
    readonly resolve: () => void
} {
    let resolver: (() => void) | undefined = undefined
    const promise = new Promise<void>((resolve) => {
        resolver = resolve
    })

    return {
        promise,
        resolve: () => {
            if (resolver !== undefined) {
                resolver()
            }
        },
    }
}
