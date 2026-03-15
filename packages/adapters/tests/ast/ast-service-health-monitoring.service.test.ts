import {describe, expect, test} from "bun:test"

import {
    AST_SERVICE_HEALTH_MONITORING_CHECK_NAME,
    AST_SERVICE_HEALTH_MONITORING_CHECK_STATUS,
    AST_SERVICE_HEALTH_MONITORING_ERROR_CODE,
    AST_SERVICE_HEALTH_MONITORING_STATUS,
    AstServiceHealthMonitoringError,
    AstServiceHealthMonitoringService,
    type IAstCodeGraphEdge,
    type IAstCodeGraphNode,
    type IAstFileMetricsItem,
    type IAstGetCodeGraphInput,
    type IAstGetCodeGraphResult,
    type IAstGetFileMetricsInput,
    type IAstGetFileMetricsResult,
    type IAstRepositoryScanStatusInput,
    type IAstRepositoryScanStatusResult,
    type IAstServiceHealthCheckResponse,
    type IAstStartRepositoryScanInput,
    type IAstStartRepositoryScanResult,
    type IAstServiceClientLibrary,
} from "../../src/ast"

type AstServiceHealthMonitoringErrorCode =
    (typeof AST_SERVICE_HEALTH_MONITORING_ERROR_CODE)[keyof typeof AST_SERVICE_HEALTH_MONITORING_ERROR_CODE]

interface IAstServiceClientLibraryDoubleState {
    connectCalls: number
    disconnectCalls: number
    codeGraphInputs: IAstGetCodeGraphInput[]
    fileMetricsInputs: IAstGetFileMetricsInput[]
    startScanInputs: IAstStartRepositoryScanInput[]
    statusInputs: IAstRepositoryScanStatusInput[]
}

interface IAstServiceClientLibraryDoubleOverrides {
    readonly connect?: () => Promise<void>
    readonly disconnect?: () => Promise<void>
    readonly healthCheck?: () => Promise<IAstServiceHealthCheckResponse>
    readonly getCodeGraph?: (input: IAstGetCodeGraphInput) => Promise<IAstGetCodeGraphResult>
    readonly getFileMetrics?: (input: IAstGetFileMetricsInput) => Promise<IAstGetFileMetricsResult>
    readonly startRepositoryScan?: (
        input: IAstStartRepositoryScanInput,
    ) => Promise<IAstStartRepositoryScanResult>
    readonly getRepositoryScanStatus?: (
        input: IAstRepositoryScanStatusInput,
    ) => Promise<IAstRepositoryScanStatusResult>
}

interface IAstServiceClientLibraryDouble {
    readonly client: IAstServiceClientLibrary
    readonly state: IAstServiceClientLibraryDoubleState
}

/**
 * Asserts typed AST service health monitoring error for async action.
 *
 * @param callback Action expected to throw.
 * @param code Expected typed error code.
 * @returns Typed monitoring error.
 */
async function expectAstServiceHealthMonitoringError(
    callback: () => Promise<unknown>,
    code: AstServiceHealthMonitoringErrorCode,
): Promise<AstServiceHealthMonitoringError> {
    try {
        await callback()
    } catch (error) {
        expect(error).toBeInstanceOf(AstServiceHealthMonitoringError)

        if (error instanceof AstServiceHealthMonitoringError) {
            expect(error.code).toBe(code)
            return error
        }
    }

    throw new Error("Expected AstServiceHealthMonitoringError to be thrown")
}

/**
 * Creates deterministic clock callback.
 *
 * @param stepMs Step increment for every `now` call.
 * @returns Deterministic `now` callback.
 */
function createSteppedNow(stepMs: number): () => number {
    let current = 1000

    return (): number => {
        const next = current
        current += stepMs
        return next
    }
}

/**
 * Creates AST service client library double.
 *
 * @param overrides Optional method overrides.
 * @returns Client double with mutable state.
 */
function createAstServiceClientLibraryDouble(
    overrides: IAstServiceClientLibraryDoubleOverrides = {},
): IAstServiceClientLibraryDouble {
    const state: IAstServiceClientLibraryDoubleState = {
        connectCalls: 0,
        disconnectCalls: 0,
        codeGraphInputs: [],
        fileMetricsInputs: [],
        startScanInputs: [],
        statusInputs: [],
    }

    const defaultNodes: readonly IAstCodeGraphNode[] = []
    const defaultEdges: readonly IAstCodeGraphEdge[] = []
    const defaultMetrics: readonly IAstFileMetricsItem[] = []

    const client: IAstServiceClientLibrary = {
        connect: (): Promise<void> => {
            state.connectCalls += 1
            return overrides.connect?.() ?? Promise.resolve()
        },
        disconnect: (): Promise<void> => {
            state.disconnectCalls += 1
            return overrides.disconnect?.() ?? Promise.resolve()
        },
        healthCheck: (): Promise<IAstServiceHealthCheckResponse> => {
            return (
                overrides.healthCheck?.() ??
                Promise.resolve({
                    status: "SERVING",
                    version: "1.0.0",
                    timestampUnixMs: 1700000000000,
                })
            )
        },
        startRepositoryScan: (input: IAstStartRepositoryScanInput): Promise<IAstStartRepositoryScanResult> => {
            state.startScanInputs.push(input)

            return (
                overrides.startRepositoryScan?.(input) ??
                Promise.resolve({
                    requestId: "scan-1",
                    state: "QUEUED",
                })
            )
        },
        getRepositoryScanStatus: (
            input: IAstRepositoryScanStatusInput,
        ): Promise<IAstRepositoryScanStatusResult> => {
            state.statusInputs.push(input)

            return (
                overrides.getRepositoryScanStatus?.(input) ??
                Promise.resolve({
                    requestId: input.requestId,
                    state: "RUNNING",
                    progressPercent: 10,
                })
            )
        },
        getCodeGraph: (input: IAstGetCodeGraphInput): Promise<IAstGetCodeGraphResult> => {
            state.codeGraphInputs.push(input)

            return (
                overrides.getCodeGraph?.(input) ??
                Promise.resolve({
                    nodes: defaultNodes,
                    edges: defaultEdges,
                })
            )
        },
        getFileMetrics: (input: IAstGetFileMetricsInput): Promise<IAstGetFileMetricsResult> => {
            state.fileMetricsInputs.push(input)

            return (
                overrides.getFileMetrics?.(input) ??
                Promise.resolve({
                    items: defaultMetrics,
                })
            )
        },
    }

    return {
        client,
        state,
    }
}

describe("AstServiceHealthMonitoringService", () => {
    test("returns healthy status when all checks pass within latency threshold", async () => {
        const clientDouble = createAstServiceClientLibraryDouble()
        const service = new AstServiceHealthMonitoringService({
            client: clientDouble.client,
            now: createSteppedNow(5),
        })

        const result = await service.monitor({
            repositoryId: " repo-1 ",
            commitSha: " abcdef1 ",
            filePaths: ["src/b.ts", "src/a.ts", "src/a.ts"],
            maxAcceptableLatencyMs: 20,
        })

        expect(result.overallStatus).toBe(AST_SERVICE_HEALTH_MONITORING_STATUS.HEALTHY)
        expect(result.checks.map((check) => check.name)).toEqual([
            AST_SERVICE_HEALTH_MONITORING_CHECK_NAME.HEALTH_CHECK,
            AST_SERVICE_HEALTH_MONITORING_CHECK_NAME.CODE_GRAPH,
            AST_SERVICE_HEALTH_MONITORING_CHECK_NAME.FILE_METRICS,
            AST_SERVICE_HEALTH_MONITORING_CHECK_NAME.REPOSITORY_SCAN_START,
            AST_SERVICE_HEALTH_MONITORING_CHECK_NAME.REPOSITORY_SCAN_STATUS,
            AST_SERVICE_HEALTH_MONITORING_CHECK_NAME.TRANSPORT_DISCONNECT,
        ])
        expect(result.checks.every((check) => check.status === AST_SERVICE_HEALTH_MONITORING_CHECK_STATUS.PASS)).toBe(
            true,
        )
        expect(result.summary.failedChecks).toBe(0)
        expect(result.summary.slowChecks).toBe(0)
        expect(clientDouble.state.connectCalls).toBe(1)
        expect(clientDouble.state.disconnectCalls).toBe(1)
        expect(clientDouble.state.codeGraphInputs[0]).toEqual({
            repositoryId: "repo-1",
            retryPolicy: undefined,
        })
        expect(clientDouble.state.fileMetricsInputs[0]).toEqual({
            repositoryId: "repo-1",
            commitSha: "abcdef1",
            filePaths: ["src/a.ts", "src/b.ts"],
            retryPolicy: undefined,
        })
    })

    test("returns degraded status when checks are slow", async () => {
        const clientDouble = createAstServiceClientLibraryDouble()
        const service = new AstServiceHealthMonitoringService({
            client: clientDouble.client,
            now: createSteppedNow(70),
        })

        const result = await service.monitor({
            includeCodeGraphCheck: false,
            includeFileMetricsCheck: false,
            includeScanStatusCheck: false,
            maxAcceptableLatencyMs: 20,
        })

        expect(result.overallStatus).toBe(AST_SERVICE_HEALTH_MONITORING_STATUS.DEGRADED)
        expect(result.summary.totalChecks).toBe(2)
        expect(result.summary.slowChecks).toBe(1)
        expect(result.summary.failedChecks).toBe(0)
        expect(result.checks[0]?.status).toBe(AST_SERVICE_HEALTH_MONITORING_CHECK_STATUS.SLOW)
        expect(result.checks[1]?.name).toBe(AST_SERVICE_HEALTH_MONITORING_CHECK_NAME.TRANSPORT_DISCONNECT)
        expect(result.checks[1]?.status).toBe(AST_SERVICE_HEALTH_MONITORING_CHECK_STATUS.PASS)
    })

    test("returns unhealthy status when failure threshold is reached", async () => {
        const clientDouble = createAstServiceClientLibraryDouble({
            getCodeGraph: () =>
                Promise.reject(
                    Object.assign(new Error("graph unavailable"), {
                        code: "GRAPH_UNAVAILABLE",
                    }),
                ),
            getFileMetrics: () => Promise.reject(new Error("metrics unavailable")),
        })
        const service = new AstServiceHealthMonitoringService({
            client: clientDouble.client,
            now: createSteppedNow(3),
        })

        const result = await service.monitor({
            repositoryId: "repo-2",
            commitSha: "bcdef12",
            includeScanStatusCheck: false,
            criticalFailureThreshold: 2,
            warningFailureThreshold: 1,
        })

        expect(result.overallStatus).toBe(AST_SERVICE_HEALTH_MONITORING_STATUS.UNHEALTHY)
        expect(result.summary.failedChecks).toBe(2)

        const codeGraphCheck = result.checks.find(
            (check) => check.name === AST_SERVICE_HEALTH_MONITORING_CHECK_NAME.CODE_GRAPH,
        )
        expect(codeGraphCheck?.status).toBe(AST_SERVICE_HEALTH_MONITORING_CHECK_STATUS.FAIL)
        expect(codeGraphCheck?.errorCode).toBe("GRAPH_UNAVAILABLE")
    })

    test("throws typed errors for invalid monitoring input configuration", async () => {
        const clientDouble = createAstServiceClientLibraryDouble()
        const service = new AstServiceHealthMonitoringService({
            client: clientDouble.client,
        })

        await expectAstServiceHealthMonitoringError(
            () =>
                service.monitor({
                    warningFailureThreshold: 3,
                    criticalFailureThreshold: 2,
                }),
            AST_SERVICE_HEALTH_MONITORING_ERROR_CODE.INVALID_FAILURE_THRESHOLD_RANGE,
        )

        await expectAstServiceHealthMonitoringError(
            () =>
                service.monitor({
                    includeFileMetricsCheck: true,
                    repositoryId: "repo",
                }),
            AST_SERVICE_HEALTH_MONITORING_ERROR_CODE.MISSING_COMMIT_SHA,
        )

        await expectAstServiceHealthMonitoringError(
            () =>
                service.monitor({
                    repositoryId: "   ",
                }),
            AST_SERVICE_HEALTH_MONITORING_ERROR_CODE.INVALID_REPOSITORY_ID,
        )
    })

    test("wraps connect lifecycle failures into monitoring failed error", async () => {
        const clientDouble = createAstServiceClientLibraryDouble({
            connect: () => Promise.reject(new Error("transport offline")),
        })
        const service = new AstServiceHealthMonitoringService({
            client: clientDouble.client,
        })

        const error = await expectAstServiceHealthMonitoringError(
            () => service.monitor(),
            AST_SERVICE_HEALTH_MONITORING_ERROR_CODE.MONITORING_FAILED,
        )

        expect(error.causeMessage).toBe("transport offline")
        expect(clientDouble.state.disconnectCalls).toBe(0)
    })
})
