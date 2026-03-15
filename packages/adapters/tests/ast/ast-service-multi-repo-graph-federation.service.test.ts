import {describe, expect, test} from "bun:test"

import {
    AST_SERVICE_MULTI_REPO_GRAPH_FEDERATION_ERROR_CODE,
    AstServiceMultiRepoGraphFederationError,
    AstServiceMultiRepoGraphFederationService,
    type IAstGetCodeGraphResult,
    type IAstGetFileMetricsResult,
    type IAstRepositoryScanStatusResult,
    type IAstServiceCachedCodeGraphInput,
    type IAstServiceCachedFetchResult,
    type IAstServiceCachedFileMetricsInput,
    type IAstServiceCachedScanStatusInput,
    type IAstServiceResultCachingService,
} from "../../src/ast"

type AstServiceMultiRepoGraphFederationErrorCode =
    (typeof AST_SERVICE_MULTI_REPO_GRAPH_FEDERATION_ERROR_CODE)[keyof typeof AST_SERVICE_MULTI_REPO_GRAPH_FEDERATION_ERROR_CODE]

interface IDeferredPromise<TValue> {
    readonly promise: Promise<TValue>
    resolve(value: TValue): void
    reject(error: unknown): void
}

interface IAstServiceResultCachingDoubleState {
    codeGraphCalls: number
    codeGraphInputs: IAstServiceCachedCodeGraphInput[]
}

interface IAstServiceResultCachingDoubleOverrides {
    readonly getCodeGraph?: (
        input: IAstServiceCachedCodeGraphInput,
    ) => Promise<IAstServiceCachedFetchResult<IAstGetCodeGraphResult>>
}

/**
 * Asserts typed AST multi-repo graph federation error for async action.
 *
 * @param callback Action expected to fail.
 * @param code Expected typed error code.
 * @returns Promise resolved when assertion passes.
 */
async function expectAstServiceMultiRepoGraphFederationError(
    callback: () => Promise<unknown>,
    code: AstServiceMultiRepoGraphFederationErrorCode,
): Promise<void> {
    try {
        await callback()
    } catch (error) {
        expect(error).toBeInstanceOf(AstServiceMultiRepoGraphFederationError)

        if (error instanceof AstServiceMultiRepoGraphFederationError) {
            expect(error.code).toBe(code)
            return
        }
    }

    throw new Error("Expected AstServiceMultiRepoGraphFederationError to be thrown")
}

/**
 * Creates deferred promise helper.
 *
 * @returns Deferred promise object.
 */
function createDeferredPromise<TValue>(): IDeferredPromise<TValue> {
    let resolvePromise: ((value: TValue) => void) | undefined
    let rejectPromise: ((error: unknown) => void) | undefined

    const promise = new Promise<TValue>((resolve, reject) => {
        resolvePromise = resolve
        rejectPromise = reject
    })

    return {
        promise,
        resolve: (value: TValue): void => {
            if (resolvePromise !== undefined) {
                resolvePromise(value)
            }
        },
        reject: (error: unknown): void => {
            if (rejectPromise !== undefined) {
                rejectPromise(error)
            }
        },
    }
}

/**
 * Creates cached code graph fetch result payload.
 *
 * @param value Graph value payload.
 * @param fromCache Indicates whether payload originates from cache.
 * @param attempts Attempts used to fetch payload.
 * @returns Cached fetch result payload.
 */
function createCachedCodeGraphFetchResult(
    value: IAstGetCodeGraphResult,
    fromCache: boolean,
    attempts: number,
): IAstServiceCachedFetchResult<IAstGetCodeGraphResult> {
    return {
        value,
        fromCache,
        cacheKey: "cache-key",
        cachedAtUnixMs: 1000,
        expiresAtUnixMs: 2000,
        attempts,
    }
}

/**
 * Creates AST result caching service double.
 *
 * @param overrides Optional method overrides.
 * @returns Service double and mutable state.
 */
function createAstServiceResultCachingDouble(
    overrides: IAstServiceResultCachingDoubleOverrides = {},
): {
    readonly service: IAstServiceResultCachingService
    readonly state: IAstServiceResultCachingDoubleState
} {
    const state: IAstServiceResultCachingDoubleState = {
        codeGraphCalls: 0,
        codeGraphInputs: [],
    }

    const defaultGraph: IAstGetCodeGraphResult = {
        nodes: [],
        edges: [],
    }

    const service: IAstServiceResultCachingService = {
        getCodeGraph: async (
            input: IAstServiceCachedCodeGraphInput,
        ): Promise<IAstServiceCachedFetchResult<IAstGetCodeGraphResult>> => {
            state.codeGraphCalls += 1
            state.codeGraphInputs.push(input)

            if (overrides.getCodeGraph !== undefined) {
                return overrides.getCodeGraph(input)
            }

            return createCachedCodeGraphFetchResult(defaultGraph, false, 1)
        },
        getFileMetrics: (
            _input: IAstServiceCachedFileMetricsInput,
        ): Promise<IAstServiceCachedFetchResult<IAstGetFileMetricsResult>> => {
            return Promise.reject(new Error("getFileMetrics is not implemented in this test double"))
        },
        getRepositoryScanStatus: (
            _input: IAstServiceCachedScanStatusInput,
        ): Promise<IAstServiceCachedFetchResult<IAstRepositoryScanStatusResult>> => {
            return Promise.reject(
                new Error("getRepositoryScanStatus is not implemented in this test double"),
            )
        },
        invalidateRepository: (_repositoryId: string): number => 0,
        invalidateRequest: (_requestId: string): number => 0,
        clear: (): void => undefined,
    }

    return {
        service,
        state,
    }
}

describe("AstServiceMultiRepoGraphFederationService", () => {
    test("federates repository graphs with deterministic nodes edges and summaries", async () => {
        let now = 5000
        const cachingDouble = createAstServiceResultCachingDouble({
            getCodeGraph: (input) => {
                if (input.repositoryId === "repo-a") {
                    return Promise.resolve(
                        createCachedCodeGraphFetchResult(
                            {
                                nodes: [
                                    {
                                        id: "a-common",
                                        type: "function",
                                        name: "CommonSymbol",
                                        filePath: "src/a/common.ts",
                                    },
                                    {
                                        id: "a-shared",
                                        type: "function",
                                        name: "SharedSymbol",
                                        filePath: "src/a/shared.ts",
                                    },
                                ],
                                edges: [
                                    {
                                        source: "a-common",
                                        target: "a-shared",
                                        type: "imports",
                                    },
                                ],
                            },
                            false,
                            1,
                        ),
                    )
                }

                return Promise.resolve(
                    createCachedCodeGraphFetchResult(
                        {
                            nodes: [
                                {
                                    id: "b-common",
                                    type: "function",
                                    name: "CommonSymbol",
                                    filePath: "src/b/common.ts",
                                },
                                {
                                    id: "b-shared",
                                    type: "function",
                                    name: "SharedSymbol",
                                    filePath: "src/b/shared.ts",
                                },
                            ],
                            edges: [
                                {
                                    source: "b-common",
                                    target: "b-shared",
                                    type: "calls",
                                },
                            ],
                        },
                        true,
                        1,
                    ),
                )
            },
        })
        const service = new AstServiceMultiRepoGraphFederationService({
            resultCachingService: cachingDouble.service,
            now: () => {
                now += 5
                return now
            },
        })

        const result = await service.federate({
            repositories: [
                {
                    repositoryId: " repo-b ",
                },
                {
                    repositoryId: " repo-a ",
                    branch: " main ",
                },
            ],
            crossRepositoryEdgeThreshold: 2,
            minSharedNodeNameLength: 3,
            idempotencyKey: " federation-key ",
        })

        expect(cachingDouble.state.codeGraphInputs).toEqual([
            {
                repositoryId: "repo-a",
                branch: "main",
                forceRefresh: false,
                idempotencyKey: "federation-key:repo-a",
            },
            {
                repositoryId: "repo-b",
                forceRefresh: false,
                idempotencyKey: "federation-key:repo-b",
            },
        ])
        expect(result.nodes).toEqual([
            {
                id: "repo-a::a-common",
                repositoryId: "repo-a",
                sourceNodeId: "a-common",
                type: "function",
                name: "CommonSymbol",
                filePath: "src/a/common.ts",
            },
            {
                id: "repo-a::a-shared",
                repositoryId: "repo-a",
                sourceNodeId: "a-shared",
                type: "function",
                name: "SharedSymbol",
                filePath: "src/a/shared.ts",
            },
            {
                id: "repo-b::b-common",
                repositoryId: "repo-b",
                sourceNodeId: "b-common",
                type: "function",
                name: "CommonSymbol",
                filePath: "src/b/common.ts",
            },
            {
                id: "repo-b::b-shared",
                repositoryId: "repo-b",
                sourceNodeId: "b-shared",
                type: "function",
                name: "SharedSymbol",
                filePath: "src/b/shared.ts",
            },
        ])
        expect(result.edges).toEqual([
            {
                source: "repo-a::a-common",
                target: "repo-a::a-shared",
                type: "imports",
                repositoryId: "repo-a",
                crossRepository: false,
                strength: 1,
                sharedSymbolCount: 0,
            },
            {
                source: "repo-b::b-common",
                target: "repo-b::b-shared",
                type: "calls",
                repositoryId: "repo-b",
                crossRepository: false,
                strength: 1,
                sharedSymbolCount: 0,
            },
            {
                source: "repo-a::a-common",
                target: "repo-b::b-common",
                type: "federated-shared-symbol",
                crossRepository: true,
                strength: 2,
                sharedSymbolCount: 2,
            },
        ])
        expect(result.repositories).toEqual([
            {
                repositoryId: "repo-a",
                branch: "main",
                sourceNodeCount: 2,
                sourceEdgeCount: 1,
                attempts: 1,
                fromResultCache: false,
            },
            {
                repositoryId: "repo-b",
                sourceNodeCount: 2,
                sourceEdgeCount: 1,
                attempts: 1,
                fromResultCache: true,
            },
        ])
        expect(result.summary).toEqual({
            federationKey: "federation-key",
            repositoryCount: 2,
            totalNodes: 4,
            totalEdges: 3,
            crossRepositoryEdges: 1,
            attempts: 2,
            fromIdempotencyCache: false,
            federatedAtUnixMs: 5005,
        })
    })

    test("retries repository graph fetch and reuses federation idempotency cache", async () => {
        let now = 2000
        let fetchCalls = 0
        const sleepDurations: number[] = []
        const cachingDouble = createAstServiceResultCachingDouble({
            getCodeGraph: () => {
                fetchCalls += 1
                if (fetchCalls === 1) {
                    return Promise.reject(new Error("temporary outage"))
                }

                return Promise.resolve(
                    createCachedCodeGraphFetchResult(
                        {
                            nodes: [
                                {
                                    id: "node-1",
                                    type: "module",
                                    name: "ModuleA",
                                    filePath: "src/a.ts",
                                },
                            ],
                            edges: [],
                        },
                        false,
                        1,
                    ),
                )
            },
        })
        const service = new AstServiceMultiRepoGraphFederationService({
            resultCachingService: cachingDouble.service,
            sleep: (durationMs: number): Promise<void> => {
                sleepDurations.push(durationMs)
                return Promise.resolve()
            },
            now: () => {
                now += 10
                return now
            },
        })

        const first = await service.federate({
            repositories: [
                {
                    repositoryId: "repo-1",
                },
            ],
            idempotencyKey: "shared-key",
            retryPolicy: {
                maxAttempts: 2,
                initialBackoffMs: 5,
                maxBackoffMs: 10,
            },
        })
        const second = await service.federate({
            repositories: [
                {
                    repositoryId: "repo-1",
                },
            ],
            idempotencyKey: "shared-key",
        })

        expect(fetchCalls).toBe(2)
        expect(sleepDurations).toEqual([5])
        expect(first.summary.attempts).toBe(2)
        expect(first.summary.fromIdempotencyCache).toBe(false)
        expect(second.summary.attempts).toBe(0)
        expect(second.summary.fromIdempotencyCache).toBe(true)
        expect(second.nodes).toEqual(first.nodes)
        expect(second.edges).toEqual(first.edges)
    })

    test("deduplicates in-flight federation requests by idempotency key", async () => {
        const deferred = createDeferredPromise<IAstServiceCachedFetchResult<IAstGetCodeGraphResult>>()
        const cachingDouble = createAstServiceResultCachingDouble({
            getCodeGraph: async () => deferred.promise,
        })
        const service = new AstServiceMultiRepoGraphFederationService({
            resultCachingService: cachingDouble.service,
        })

        const firstPromise = service.federate({
            repositories: [
                {
                    repositoryId: "repo-1",
                },
            ],
            idempotencyKey: "in-flight-key",
        })
        const secondPromise = service.federate({
            repositories: [
                {
                    repositoryId: "repo-1",
                },
            ],
            idempotencyKey: "in-flight-key",
        })

        deferred.resolve(
            createCachedCodeGraphFetchResult(
                {
                    nodes: [
                        {
                            id: "node-1",
                            type: "module",
                            name: "RepoModule",
                            filePath: "src/module.ts",
                        },
                    ],
                    edges: [],
                },
                false,
                1,
            ),
        )

        const [first, second] = await Promise.all([firstPromise, secondPromise])
        expect(cachingDouble.state.codeGraphCalls).toBe(1)
        expect(second).toEqual(first)
    })

    test("throws typed errors for validation, non-retryable failures and retry exhaustion", async () => {
        const validationService = new AstServiceMultiRepoGraphFederationService()

        await expectAstServiceMultiRepoGraphFederationError(
            () =>
                validationService.federate({
                    repositories: [
                        {
                            repositoryId: "repo-a",
                        },
                        {
                            repositoryId: " repo-a ",
                        },
                    ],
                }),
            AST_SERVICE_MULTI_REPO_GRAPH_FEDERATION_ERROR_CODE.DUPLICATE_REPOSITORY_ID,
        )

        const nonRetryableService = new AstServiceMultiRepoGraphFederationService({
            resultCachingService: createAstServiceResultCachingDouble({
                getCodeGraph: () => Promise.reject(new Error("upstream denied")),
            }).service,
            shouldRetry: () => false,
        })
        await expectAstServiceMultiRepoGraphFederationError(
            () =>
                nonRetryableService.federate({
                    repositories: [
                        {
                            repositoryId: "repo-a",
                        },
                    ],
                    retryPolicy: {
                        maxAttempts: 3,
                        initialBackoffMs: 1,
                        maxBackoffMs: 2,
                    },
                }),
            AST_SERVICE_MULTI_REPO_GRAPH_FEDERATION_ERROR_CODE.REPOSITORY_FETCH_FAILED,
        )

        const exhaustedService = new AstServiceMultiRepoGraphFederationService({
            resultCachingService: createAstServiceResultCachingDouble({
                getCodeGraph: () => Promise.reject(new Error("upstream timeout")),
            }).service,
            sleep: (): Promise<void> => Promise.resolve(),
            shouldRetry: () => true,
        })
        await expectAstServiceMultiRepoGraphFederationError(
            () =>
                exhaustedService.federate({
                    repositories: [
                        {
                            repositoryId: "repo-a",
                        },
                    ],
                    retryPolicy: {
                        maxAttempts: 2,
                        initialBackoffMs: 1,
                        maxBackoffMs: 2,
                    },
                }),
            AST_SERVICE_MULTI_REPO_GRAPH_FEDERATION_ERROR_CODE.RETRY_EXHAUSTED,
        )
    })
})
