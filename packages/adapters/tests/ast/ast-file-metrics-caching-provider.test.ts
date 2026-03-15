import {describe, expect, test} from "bun:test"

import type {IFileMetricsDTO, IFileMetricsProvider} from "@codenautic/core"

import {
    AST_FILE_METRICS_CACHING_ERROR_CODE,
    AstFileMetricsCachingError,
    AstFileMetricsCachingProvider,
    type AstFileMetricsCachingResolveCommitSha,
} from "../../src/ast"

type AstFileMetricsCachingErrorCode =
    (typeof AST_FILE_METRICS_CACHING_ERROR_CODE)[keyof typeof AST_FILE_METRICS_CACHING_ERROR_CODE]

/**
 * Asserts typed AST file metrics caching error for async action.
 *
 * @param callback Action expected to fail.
 * @param code Expected typed error code.
 * @returns Promise resolved when assertion passes.
 */
async function expectAstFileMetricsCachingError(
    callback: () => Promise<unknown>,
    code: AstFileMetricsCachingErrorCode,
): Promise<void> {
    try {
        await callback()
    } catch (error) {
        expect(error).toBeInstanceOf(AstFileMetricsCachingError)

        if (error instanceof AstFileMetricsCachingError) {
            expect(error.code).toBe(code)
            return
        }
    }

    throw new Error("Expected AstFileMetricsCachingError to be thrown")
}

describe("AstFileMetricsCachingProvider", () => {
    test("returns cached metrics until TTL expires", async () => {
        let nowUnixMs = 10_000
        let sourceCalls = 0

        const sourceProvider: IFileMetricsProvider = {
            getMetrics(_repositoryId, filePaths): Promise<readonly IFileMetricsDTO[]> {
                sourceCalls += 1
                return Promise.resolve(
                    filePaths.map((filePath): IFileMetricsDTO => ({
                        filePath,
                        loc: sourceCalls,
                        complexity: 3,
                        churn: 2,
                        issueCount: 0,
                    })),
                )
            },
        }

        const provider = new AstFileMetricsCachingProvider({
            sourceProvider,
            resolveRepositoryPath: (): string => "/tmp/repo",
            resolveCommitSha: (): string => "abc1234",
            defaultCacheTtlMs: 100,
            now: (): number => nowUnixMs,
        })

        const first = await provider.getMetrics("repo-1", ["src/a.ts"])
        const second = await provider.getMetrics("repo-1", ["src/a.ts"])

        nowUnixMs += 101
        const third = await provider.getMetrics("repo-1", ["src/a.ts"])

        expect(first[0]?.loc).toBe(1)
        expect(second[0]?.loc).toBe(1)
        expect(third[0]?.loc).toBe(2)
        expect(sourceCalls).toBe(2)
    })

    test("invalidates previous repository entries when commit changes", async () => {
        let commitSha = "aaa1111"
        let sourceCalls = 0

        const resolveCommitSha: AstFileMetricsCachingResolveCommitSha = (): string => {
            return commitSha
        }
        const sourceProvider: IFileMetricsProvider = {
            getMetrics(_repositoryId, filePaths): Promise<readonly IFileMetricsDTO[]> {
                sourceCalls += 1
                return Promise.resolve(
                    filePaths.map((filePath): IFileMetricsDTO => ({
                        filePath,
                        loc: 10,
                        complexity: 5,
                        churn: 7,
                        issueCount: 0,
                    })),
                )
            },
        }

        const provider = new AstFileMetricsCachingProvider({
            sourceProvider,
            resolveRepositoryPath: (): string => "/tmp/repo",
            resolveCommitSha,
        })

        await provider.getMetrics("repo-1", ["src/a.ts"])
        commitSha = "bbb2222"
        await provider.getMetrics("repo-1", ["src/a.ts"])

        const removed = provider.invalidateRepository("repo-1")

        expect(sourceCalls).toBe(2)
        expect(removed).toBe(1)
    })

    test("deduplicates in-flight requests for same cache key", async () => {
        let sourceCalls = 0

        const sourceProvider: IFileMetricsProvider = {
            getMetrics(_repositoryId, filePaths): Promise<readonly IFileMetricsDTO[]> {
                sourceCalls += 1

                return new Promise<readonly IFileMetricsDTO[]>((resolvePromise) => {
                    setTimeout((): void => {
                        resolvePromise(
                            filePaths.map((filePath): IFileMetricsDTO => ({
                                filePath,
                                loc: 5,
                                complexity: 2,
                                churn: 1,
                                issueCount: 0,
                            })),
                        )
                    }, 5)
                })
            },
        }

        const provider = new AstFileMetricsCachingProvider({
            sourceProvider,
            resolveRepositoryPath: (): string => "/tmp/repo",
            resolveCommitSha: (): string => "abc1234",
        })

        const firstPromise = provider.getMetrics("repo-1", ["src/a.ts"])
        const secondPromise = provider.getMetrics("repo-1", ["src/a.ts"])

        const [first, second] = await Promise.all([firstPromise, secondPromise])

        expect(sourceCalls).toBe(1)
        expect(first).toEqual(second)
    })

    test("wraps source provider failures into typed error", async () => {
        const sourceProvider: IFileMetricsProvider = {
            getMetrics(): Promise<readonly IFileMetricsDTO[]> {
                return Promise.reject(new Error("provider unavailable"))
            },
        }
        const provider = new AstFileMetricsCachingProvider({
            sourceProvider,
            resolveRepositoryPath: (): string => "/tmp/repo",
            resolveCommitSha: (): string => "abc1234",
        })

        await expectAstFileMetricsCachingError(
            () => provider.getMetrics("repo-1", ["src/a.ts"]),
            AST_FILE_METRICS_CACHING_ERROR_CODE.SOURCE_PROVIDER_FAILED,
        )
    })

    test("throws typed errors for invalid input and commit sha", async () => {
        const provider = new AstFileMetricsCachingProvider({
            resolveRepositoryPath: (): string => "/tmp/repo",
            resolveCommitSha: (): string => "not-a-sha",
        })

        await expectAstFileMetricsCachingError(
            () => provider.getMetrics(" ", ["src/a.ts"]),
            AST_FILE_METRICS_CACHING_ERROR_CODE.INVALID_REPOSITORY_ID,
        )

        await expectAstFileMetricsCachingError(
            () => provider.getMetrics("repo-1", [" "]),
            AST_FILE_METRICS_CACHING_ERROR_CODE.INVALID_FILE_PATH,
        )

        await expectAstFileMetricsCachingError(
            () => provider.getMetrics("repo-1", ["src/a.ts"]),
            AST_FILE_METRICS_CACHING_ERROR_CODE.INVALID_COMMIT_SHA,
        )
    })
})
