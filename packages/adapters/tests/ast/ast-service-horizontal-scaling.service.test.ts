import {describe, expect, test} from "bun:test"

import {
    AST_SERVICE_HORIZONTAL_SCALING_ACTION,
    AST_SERVICE_HORIZONTAL_SCALING_ERROR_CODE,
    AstServiceHorizontalScalingError,
    AstServiceHorizontalScalingService,
    type IAstServiceHorizontalScalingMetricsSnapshotInput,
} from "../../src/ast"

type AstServiceHorizontalScalingErrorCode =
    (typeof AST_SERVICE_HORIZONTAL_SCALING_ERROR_CODE)[keyof typeof AST_SERVICE_HORIZONTAL_SCALING_ERROR_CODE]

/**
 * Asserts typed AST horizontal scaling error for async action.
 *
 * @param callback Action expected to fail.
 * @param code Expected typed error code.
 * @returns Promise resolved when assertion passes.
 */
async function expectAstServiceHorizontalScalingError(
    callback: () => Promise<unknown>,
    code: AstServiceHorizontalScalingErrorCode,
): Promise<void> {
    try {
        await callback()
    } catch (error) {
        expect(error).toBeInstanceOf(AstServiceHorizontalScalingError)

        if (error instanceof AstServiceHorizontalScalingError) {
            expect(error.code).toBe(code)
            return
        }
    }

    throw new Error("Expected AstServiceHorizontalScalingError to be thrown")
}

describe("AstServiceHorizontalScalingService", () => {
    test("creates deterministic scale-up plan and repository assignments", async () => {
        const service = new AstServiceHorizontalScalingService()
        const result = await service.plan({
            currentReplicas: 2,
            maxReplicas: 10,
            targetBacklogPerReplica: 100,
            hysteresisPercent: 10,
            metricsSnapshot: {
                queueDepth: 20,
                repositories: [
                    {
                        repositoryId: "repo-c",
                        pendingJobs: 120,
                        activeJobs: 10,
                    },
                    {
                        repositoryId: "repo-a",
                        pendingJobs: 80,
                        activeJobs: 5,
                    },
                    {
                        repositoryId: "repo-b",
                        pendingJobs: 60,
                        activeJobs: 0,
                    },
                ],
            },
        })

        expect(result.replicaPlan).toEqual({
            currentReplicas: 2,
            targetReplicas: 4,
            scaleDelta: 2,
            action: AST_SERVICE_HORIZONTAL_SCALING_ACTION.SCALE_UP,
            reason: "Backlog 147.5 exceeded upper threshold 110",
        })
        expect(result.assignments).toEqual([
            {
                replicaId: "replica-1",
                repositoryIds: ["repo-c"],
                pendingJobs: 120,
                activeJobs: 10,
            },
            {
                replicaId: "replica-2",
                repositoryIds: ["repo-a"],
                pendingJobs: 80,
                activeJobs: 5,
            },
            {
                replicaId: "replica-3",
                repositoryIds: ["repo-b"],
                pendingJobs: 60,
                activeJobs: 0,
            },
            {
                replicaId: "replica-4",
                repositoryIds: [],
                pendingJobs: 0,
                activeJobs: 0,
            },
        ])
        expect(result.summary.totalPendingJobs).toBe(260)
        expect(result.summary.totalActiveJobs).toBe(15)
        expect(result.summary.effectiveLoad).toBe(295)
        expect(result.summary.attempts).toBe(0)
        expect(result.summary.fromIdempotencyCache).toBe(false)
    })

    test("creates scale-down plan when load is below hysteresis window", async () => {
        const service = new AstServiceHorizontalScalingService()
        const result = await service.plan({
            currentReplicas: 6,
            minReplicas: 2,
            maxReplicas: 10,
            scaleDownStep: 2,
            targetBacklogPerReplica: 100,
            hysteresisPercent: 20,
            metricsSnapshot: {
                queueDepth: 0,
                repositories: [
                    {
                        repositoryId: "repo-main",
                        pendingJobs: 24,
                        activeJobs: 0,
                    },
                ],
            },
        })

        expect(result.replicaPlan.action).toBe(AST_SERVICE_HORIZONTAL_SCALING_ACTION.SCALE_DOWN)
        expect(result.replicaPlan.targetReplicas).toBe(4)
        expect(result.replicaPlan.scaleDelta).toBe(-2)
        expect(result.summary.backlogPerReplica).toBe(4)
    })

    test("retries metrics provider and supports idempotency cache", async () => {
        let providerCalls = 0
        const service = new AstServiceHorizontalScalingService({
            metricsProvider: async (): Promise<IAstServiceHorizontalScalingMetricsSnapshotInput> => {
                providerCalls += 1

                if (providerCalls === 1) {
                    return Promise.reject(new Error("temporary provider failure"))
                }

                return Promise.resolve({
                    queueDepth: 5,
                    repositories: [
                        {
                            repositoryId: "repo-1",
                            pendingJobs: 40,
                            activeJobs: 10,
                        },
                    ],
                })
            },
            sleep: (): Promise<void> => Promise.resolve(),
            defaultRetryPolicy: {
                maxAttempts: 3,
                initialBackoffMs: 1,
                maxBackoffMs: 2,
            },
        })

        const first = await service.plan({
            currentReplicas: 2,
            idempotencyKey: "scale:repo-1",
        })
        const second = await service.plan({
            currentReplicas: 2,
            idempotencyKey: "scale:repo-1",
        })

        expect(providerCalls).toBe(2)
        expect(first.summary.attempts).toBe(2)
        expect(first.summary.fromIdempotencyCache).toBe(false)
        expect(second.summary.attempts).toBe(0)
        expect(second.summary.fromIdempotencyCache).toBe(true)
        expect(second.replicaPlan).toEqual(first.replicaPlan)
    })

    test("throws typed errors for invalid scaling input and retry exhaustion", async () => {
        const invalidService = new AstServiceHorizontalScalingService()

        await expectAstServiceHorizontalScalingError(
            () =>
                invalidService.plan({
                    currentReplicas: 1,
                    minReplicas: 2,
                    maxReplicas: 1,
                    metricsSnapshot: {
                        queueDepth: 0,
                        repositories: [],
                    },
                }),
            AST_SERVICE_HORIZONTAL_SCALING_ERROR_CODE.INVALID_REPLICA_RANGE,
        )

        await expectAstServiceHorizontalScalingError(
            () =>
                invalidService.plan({
                    currentReplicas: 2,
                    idempotencyKey: " ",
                    metricsSnapshot: {
                        queueDepth: 0,
                        repositories: [],
                    },
                }),
            AST_SERVICE_HORIZONTAL_SCALING_ERROR_CODE.INVALID_IDEMPOTENCY_KEY,
        )

        const exhaustedService = new AstServiceHorizontalScalingService({
            metricsProvider: () => Promise.reject(new Error("upstream timeout")),
            sleep: (): Promise<void> => Promise.resolve(),
            defaultRetryPolicy: {
                maxAttempts: 2,
                initialBackoffMs: 1,
                maxBackoffMs: 2,
            },
        })

        await expectAstServiceHorizontalScalingError(
            () =>
                exhaustedService.plan({
                    currentReplicas: 2,
                }),
            AST_SERVICE_HORIZONTAL_SCALING_ERROR_CODE.RETRY_EXHAUSTED,
        )
    })
})
