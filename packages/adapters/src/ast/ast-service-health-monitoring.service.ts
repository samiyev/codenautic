import {FilePath} from "@codenautic/core"

import {
    AST_SERVICE_HEALTH_MONITORING_ERROR_CODE,
    AstServiceHealthMonitoringError,
    type AstServiceHealthMonitoringErrorCode,
} from "./ast-service-health-monitoring.error"
import {
    AstServiceClientLibrary,
    type IAstServiceClientLibrary,
} from "./ast-service-client-library.service"
import type {IAstServiceGrpcServerRetryPolicyInput} from "./ast-service-grpc-server.service"

const DEFAULT_MAX_ACCEPTABLE_LATENCY_MS = 500
const DEFAULT_WARNING_FAILURE_THRESHOLD = 1
const DEFAULT_CRITICAL_FAILURE_THRESHOLD = 2

/**
 * Supported health monitoring check names.
 */
export const AST_SERVICE_HEALTH_MONITORING_CHECK_NAME = {
    CODE_GRAPH: "CODE_GRAPH",
    FILE_METRICS: "FILE_METRICS",
    HEALTH_CHECK: "HEALTH_CHECK",
    REPOSITORY_SCAN_START: "REPOSITORY_SCAN_START",
    REPOSITORY_SCAN_STATUS: "REPOSITORY_SCAN_STATUS",
    TRANSPORT_DISCONNECT: "TRANSPORT_DISCONNECT",
} as const

/**
 * Health monitoring check name literal.
 */
export type AstServiceHealthMonitoringCheckName =
    (typeof AST_SERVICE_HEALTH_MONITORING_CHECK_NAME)[keyof typeof AST_SERVICE_HEALTH_MONITORING_CHECK_NAME]

/**
 * Individual check status.
 */
export const AST_SERVICE_HEALTH_MONITORING_CHECK_STATUS = {
    FAIL: "FAIL",
    PASS: "PASS",
    SLOW: "SLOW",
} as const

/**
 * Individual check status literal.
 */
export type AstServiceHealthMonitoringCheckStatus =
    (typeof AST_SERVICE_HEALTH_MONITORING_CHECK_STATUS)[keyof typeof AST_SERVICE_HEALTH_MONITORING_CHECK_STATUS]

/**
 * Aggregated monitoring status.
 */
export const AST_SERVICE_HEALTH_MONITORING_STATUS = {
    DEGRADED: "DEGRADED",
    HEALTHY: "HEALTHY",
    UNHEALTHY: "UNHEALTHY",
} as const

/**
 * Aggregated monitoring status literal.
 */
export type AstServiceHealthMonitoringStatus =
    (typeof AST_SERVICE_HEALTH_MONITORING_STATUS)[keyof typeof AST_SERVICE_HEALTH_MONITORING_STATUS]

/**
 * Clock callback used by health monitoring service.
 */
export type AstServiceHealthMonitoringNow = () => number

/**
 * Input payload for AST service health monitoring.
 */
export interface IAstServiceHealthMonitoringInput {
    /**
     * Optional repository identifier for repository-scoped checks.
     */
    readonly repositoryId?: string

    /**
     * Optional commit sha for commit-scoped checks.
     */
    readonly commitSha?: string

    /**
     * Optional file path subset for graph and metrics checks.
     */
    readonly filePaths?: readonly string[]

    /**
     * Enables code graph check.
     */
    readonly includeCodeGraphCheck?: boolean

    /**
     * Enables file metrics check.
     */
    readonly includeFileMetricsCheck?: boolean

    /**
     * Enables scan start/status checks.
     */
    readonly includeScanStatusCheck?: boolean

    /**
     * Maximum acceptable latency before check is marked as slow.
     */
    readonly maxAcceptableLatencyMs?: number

    /**
     * Failure count threshold for degraded status.
     */
    readonly warningFailureThreshold?: number

    /**
     * Failure count threshold for unhealthy status.
     */
    readonly criticalFailureThreshold?: number

    /**
     * Optional retry policy passed to client library requests.
     */
    readonly retryPolicy?: IAstServiceGrpcServerRetryPolicyInput
}

/**
 * One health monitoring check result.
 */
export interface IAstServiceHealthMonitoringCheckResult {
    /**
     * Monitoring check name.
     */
    readonly name: AstServiceHealthMonitoringCheckName

    /**
     * Check execution status.
     */
    readonly status: AstServiceHealthMonitoringCheckStatus

    /**
     * Check execution latency in milliseconds.
     */
    readonly latencyMs: number

    /**
     * Optional check detail message.
     */
    readonly message?: string

    /**
     * Optional machine-readable error code.
     */
    readonly errorCode?: string
}

/**
 * Summary for one monitoring run.
 */
export interface IAstServiceHealthMonitoringSummary {
    /**
     * Total executed checks count.
     */
    readonly totalChecks: number

    /**
     * Successfully completed checks count.
     */
    readonly passedChecks: number

    /**
     * Failed checks count.
     */
    readonly failedChecks: number

    /**
     * Slow checks count.
     */
    readonly slowChecks: number

    /**
     * Monitoring run total duration in milliseconds.
     */
    readonly durationMs: number

    /**
     * Summary observation timestamp.
     */
    readonly observedAtUnixMs: number
}

/**
 * Output payload for AST service health monitoring.
 */
export interface IAstServiceHealthMonitoringResult {
    /**
     * Aggregated service health status.
     */
    readonly overallStatus: AstServiceHealthMonitoringStatus

    /**
     * Executed checks.
     */
    readonly checks: readonly IAstServiceHealthMonitoringCheckResult[]

    /**
     * Aggregated monitoring summary.
     */
    readonly summary: IAstServiceHealthMonitoringSummary
}

/**
 * Runtime options for AST service health monitoring.
 */
export interface IAstServiceHealthMonitoringServiceOptions {
    /**
     * Optional AST service client library.
     */
    readonly client?: IAstServiceClientLibrary

    /**
     * Optional clock callback.
     */
    readonly now?: AstServiceHealthMonitoringNow
}

/**
 * AST service health monitoring contract.
 */
export interface IAstServiceHealthMonitoringService {
    /**
     * Executes health checks and returns aggregated monitoring status.
     *
     * @param input Optional monitoring input.
     * @returns Monitoring result.
     */
    monitor(input?: IAstServiceHealthMonitoringInput): Promise<IAstServiceHealthMonitoringResult>
}

interface IResolvedAstServiceHealthMonitoringInput {
    readonly repositoryId?: string
    readonly commitSha?: string
    readonly filePaths: readonly string[]
    readonly includeCodeGraphCheck: boolean
    readonly includeFileMetricsCheck: boolean
    readonly includeScanStatusCheck: boolean
    readonly maxAcceptableLatencyMs: number
    readonly warningFailureThreshold: number
    readonly criticalFailureThreshold: number
    readonly retryPolicy?: IAstServiceGrpcServerRetryPolicyInput
}

interface IAstServiceHealthMonitoringCheckExecution<TResult> {
    readonly check: IAstServiceHealthMonitoringCheckResult
    readonly result?: TResult
}

/**
 * Health checks and monitoring orchestration for AST service client library.
 */
export class AstServiceHealthMonitoringService implements IAstServiceHealthMonitoringService {
    private readonly client: IAstServiceClientLibrary
    private readonly now: AstServiceHealthMonitoringNow

    /**
     * Creates AST service health monitoring service.
     *
     * @param options Optional runtime overrides.
     */
    public constructor(options: IAstServiceHealthMonitoringServiceOptions = {}) {
        this.client = options.client ?? new AstServiceClientLibrary()
        this.now = options.now ?? Date.now
    }

    /**
     * Executes health checks and returns aggregated monitoring status.
     *
     * @param input Optional monitoring input.
     * @returns Monitoring result.
     */
    public async monitor(
        input: IAstServiceHealthMonitoringInput = {},
    ): Promise<IAstServiceHealthMonitoringResult> {
        const startedAt = this.now()
        const resolvedInput = resolveAstServiceHealthMonitoringInput(input)
        const checks: IAstServiceHealthMonitoringCheckResult[] = []
        const connected = await this.connectClient()

        checks.push(
            (await this.executeCheck(
                AST_SERVICE_HEALTH_MONITORING_CHECK_NAME.HEALTH_CHECK,
                resolvedInput.maxAcceptableLatencyMs,
                async () => this.client.healthCheck(),
            )).check,
        )

        if (resolvedInput.includeCodeGraphCheck) {
            checks.push(
                (await this.executeCheck(
                    AST_SERVICE_HEALTH_MONITORING_CHECK_NAME.CODE_GRAPH,
                    resolvedInput.maxAcceptableLatencyMs,
                    async () =>
                        this.client.getCodeGraph({
                            repositoryId: resolvedRequiredRepositoryId(resolvedInput.repositoryId),
                            retryPolicy: resolvedInput.retryPolicy,
                        }),
                )).check,
            )
        }

        if (resolvedInput.includeFileMetricsCheck) {
            checks.push(
                (await this.executeCheck(
                    AST_SERVICE_HEALTH_MONITORING_CHECK_NAME.FILE_METRICS,
                    resolvedInput.maxAcceptableLatencyMs,
                    async () =>
                        this.client.getFileMetrics({
                            repositoryId: resolvedRequiredRepositoryId(resolvedInput.repositoryId),
                            commitSha: resolvedRequiredCommitSha(resolvedInput.commitSha),
                            filePaths: resolvedInput.filePaths,
                            retryPolicy: resolvedInput.retryPolicy,
                        }),
                )).check,
            )
        }

        if (resolvedInput.includeScanStatusCheck) {
            await this.executeScanChecks(resolvedInput, checks)
        }

        await this.appendDisconnectCheck(checks, connected)

        return createMonitoringResult(
            checks,
            startedAt,
            this.now(),
            resolvedInput.warningFailureThreshold,
            resolvedInput.criticalFailureThreshold,
        )
    }

    /**
     * Connects client transport and wraps lifecycle failures.
     *
     * @returns Whether connect has been completed.
     */
    private async connectClient(): Promise<boolean> {
        try {
            await this.client.connect()
            return true
        } catch (error) {
            throw new AstServiceHealthMonitoringError(
                AST_SERVICE_HEALTH_MONITORING_ERROR_CODE.MONITORING_FAILED,
                {
                    causeMessage: resolveUnknownErrorMessage(error),
                },
            )
        }
    }

    /**
     * Runs scan start and status checks.
     *
     * @param input Resolved monitoring input.
     * @param checks Mutable checks collection.
     */
    private async executeScanChecks(
        input: IResolvedAstServiceHealthMonitoringInput,
        checks: IAstServiceHealthMonitoringCheckResult[],
    ): Promise<void> {
        const startScanCheck = await this.executeCheck(
            AST_SERVICE_HEALTH_MONITORING_CHECK_NAME.REPOSITORY_SCAN_START,
            input.maxAcceptableLatencyMs,
            async () =>
                this.client.startRepositoryScan({
                    repositoryId: resolvedRequiredRepositoryId(input.repositoryId),
                    commitSha: resolvedRequiredCommitSha(input.commitSha),
                    filePaths: input.filePaths,
                    retryPolicy: input.retryPolicy,
                }),
        )
        checks.push(startScanCheck.check)

        const startScanResult = startScanCheck.result
        if (startScanResult === undefined) {
            return
        }

        checks.push(
            (await this.executeCheck(
                AST_SERVICE_HEALTH_MONITORING_CHECK_NAME.REPOSITORY_SCAN_STATUS,
                input.maxAcceptableLatencyMs,
                async () =>
                    this.client.getRepositoryScanStatus({
                        requestId: startScanResult.requestId,
                        retryPolicy: input.retryPolicy,
                    }),
            )).check,
        )
    }

    /**
     * Appends disconnect check result.
     *
     * @param checks Mutable checks collection.
     * @param connected Whether client was connected.
     */
    private async appendDisconnectCheck(
        checks: IAstServiceHealthMonitoringCheckResult[],
        connected: boolean,
    ): Promise<void> {
        if (connected === false) {
            return
        }

        checks.push(
            (await this.executeCheck(
                AST_SERVICE_HEALTH_MONITORING_CHECK_NAME.TRANSPORT_DISCONNECT,
                Number.MAX_SAFE_INTEGER,
                async () => this.client.disconnect(),
            )).check,
        )
    }

    /**
     * Executes one monitoring check and maps result into stable check payload.
     *
     * @param name Check name.
     * @param maxAcceptableLatencyMs Slow latency threshold.
     * @param operation Async check operation.
     * @returns Check execution result.
     */
    private async executeCheck<TResult>(
        name: AstServiceHealthMonitoringCheckName,
        maxAcceptableLatencyMs: number,
        operation: () => Promise<TResult>,
    ): Promise<IAstServiceHealthMonitoringCheckExecution<TResult>> {
        const startedAt = this.now()

        try {
            const result = await operation()
            const latencyMs = this.now() - startedAt
            return {
                check: createSuccessfulCheck(name, latencyMs, maxAcceptableLatencyMs),
                result,
            }
        } catch (error) {
            const latencyMs = this.now() - startedAt
            return {
                check: createFailureCheck(name, latencyMs, error),
            }
        }
    }
}

/**
 * Creates stable monitoring result.
 *
 * @param checks Executed checks.
 * @param startedAt Start timestamp.
 * @param observedAtUnixMs Observation timestamp.
 * @param warningFailureThreshold Degraded threshold.
 * @param criticalFailureThreshold Unhealthy threshold.
 * @returns Stable monitoring result.
 */
function createMonitoringResult(
    checks: readonly IAstServiceHealthMonitoringCheckResult[],
    startedAt: number,
    observedAtUnixMs: number,
    warningFailureThreshold: number,
    criticalFailureThreshold: number,
): IAstServiceHealthMonitoringResult {
    const summary = createSummary(checks, startedAt, observedAtUnixMs)

    return {
        overallStatus: resolveOverallStatus(
            summary.failedChecks,
            summary.slowChecks,
            warningFailureThreshold,
            criticalFailureThreshold,
        ),
        checks,
        summary,
    }
}

/**
 * Creates summary for executed checks.
 *
 * @param checks Executed checks.
 * @param startedAt Start timestamp.
 * @param observedAtUnixMs Observation timestamp.
 * @returns Monitoring summary.
 */
function createSummary(
    checks: readonly IAstServiceHealthMonitoringCheckResult[],
    startedAt: number,
    observedAtUnixMs: number,
): IAstServiceHealthMonitoringSummary {
    const totalChecks = checks.length
    const failedChecks = checks.filter(
        (check) => check.status === AST_SERVICE_HEALTH_MONITORING_CHECK_STATUS.FAIL,
    ).length
    const slowChecks = checks.filter(
        (check) => check.status === AST_SERVICE_HEALTH_MONITORING_CHECK_STATUS.SLOW,
    ).length
    const passedChecks = totalChecks - failedChecks - slowChecks

    return {
        totalChecks,
        passedChecks,
        failedChecks,
        slowChecks,
        durationMs: observedAtUnixMs - startedAt,
        observedAtUnixMs,
    }
}

/**
 * Resolves aggregated monitoring status.
 *
 * @param failedChecks Failed checks count.
 * @param slowChecks Slow checks count.
 * @param warningFailureThreshold Degraded threshold.
 * @param criticalFailureThreshold Unhealthy threshold.
 * @returns Aggregated monitoring status.
 */
function resolveOverallStatus(
    failedChecks: number,
    slowChecks: number,
    warningFailureThreshold: number,
    criticalFailureThreshold: number,
): AstServiceHealthMonitoringStatus {
    if (failedChecks >= criticalFailureThreshold) {
        return AST_SERVICE_HEALTH_MONITORING_STATUS.UNHEALTHY
    }

    if (failedChecks >= warningFailureThreshold || slowChecks > 0) {
        return AST_SERVICE_HEALTH_MONITORING_STATUS.DEGRADED
    }

    return AST_SERVICE_HEALTH_MONITORING_STATUS.HEALTHY
}

/**
 * Creates successful check result.
 *
 * @param name Check name.
 * @param latencyMs Check latency.
 * @param maxAcceptableLatencyMs Slow latency threshold.
 * @returns Successful check result.
 */
function createSuccessfulCheck(
    name: AstServiceHealthMonitoringCheckName,
    latencyMs: number,
    maxAcceptableLatencyMs: number,
): IAstServiceHealthMonitoringCheckResult {
    if (latencyMs > maxAcceptableLatencyMs) {
        return {
            name,
            status: AST_SERVICE_HEALTH_MONITORING_CHECK_STATUS.SLOW,
            latencyMs,
            message: `Check latency exceeded threshold ${maxAcceptableLatencyMs}ms`,
        }
    }

    return {
        name,
        status: AST_SERVICE_HEALTH_MONITORING_CHECK_STATUS.PASS,
        latencyMs,
    }
}

/**
 * Creates failed check result.
 *
 * @param name Check name.
 * @param latencyMs Check latency.
 * @param error Underlying error.
 * @returns Failed check result.
 */
function createFailureCheck(
    name: AstServiceHealthMonitoringCheckName,
    latencyMs: number,
    error: unknown,
): IAstServiceHealthMonitoringCheckResult {
    return {
        name,
        status: AST_SERVICE_HEALTH_MONITORING_CHECK_STATUS.FAIL,
        latencyMs,
        message: resolveUnknownErrorMessage(error),
        errorCode: resolveErrorCode(error),
    }
}

/**
 * Resolves error code from unknown error payload.
 *
 * @param error Unknown error payload.
 * @returns Error code when available.
 */
function resolveErrorCode(error: unknown): string | undefined {
    if (typeof error !== "object" || error === null) {
        return undefined
    }

    const maybeCode: unknown = Reflect.get(error, "code")
    if (typeof maybeCode === "string" && maybeCode.trim().length > 0) {
        return maybeCode
    }

    return undefined
}

/**
 * Resolves unknown error into stable text message.
 *
 * @param error Unknown error payload.
 * @returns Stable text message.
 */
function resolveUnknownErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message
    }

    return "Unknown error"
}

/**
 * Resolves required repository id from optional normalized input.
 *
 * @param repositoryId Optional repository id.
 * @returns Required repository id.
 * @throws AstServiceHealthMonitoringError when repository id is missing.
 */
function resolvedRequiredRepositoryId(repositoryId: string | undefined): string {
    if (repositoryId !== undefined) {
        return repositoryId
    }

    throw new AstServiceHealthMonitoringError(
        AST_SERVICE_HEALTH_MONITORING_ERROR_CODE.MISSING_REPOSITORY_ID,
    )
}

/**
 * Resolves required commit sha from optional normalized input.
 *
 * @param commitSha Optional commit sha.
 * @returns Required commit sha.
 * @throws AstServiceHealthMonitoringError when commit sha is missing.
 */
function resolvedRequiredCommitSha(commitSha: string | undefined): string {
    if (commitSha !== undefined) {
        return commitSha
    }

    throw new AstServiceHealthMonitoringError(AST_SERVICE_HEALTH_MONITORING_ERROR_CODE.MISSING_COMMIT_SHA)
}

/**
 * Resolves and validates monitoring input.
 *
 * @param input Raw monitoring input.
 * @returns Normalized monitoring input.
 */
function resolveAstServiceHealthMonitoringInput(
    input: IAstServiceHealthMonitoringInput,
): IResolvedAstServiceHealthMonitoringInput {
    const repositoryId = normalizeRepositoryId(input.repositoryId)
    const commitSha = normalizeCommitSha(input.commitSha)
    const filePaths = normalizeFilePaths(input.filePaths)
    const includeCodeGraphCheck = input.includeCodeGraphCheck ?? repositoryId !== undefined
    const includeFileMetricsCheck =
        input.includeFileMetricsCheck ?? (repositoryId !== undefined && commitSha !== undefined)
    const includeScanStatusCheck =
        input.includeScanStatusCheck ?? (repositoryId !== undefined && commitSha !== undefined)
    const maxAcceptableLatencyMs = normalizePositiveInteger(
        input.maxAcceptableLatencyMs ?? DEFAULT_MAX_ACCEPTABLE_LATENCY_MS,
        AST_SERVICE_HEALTH_MONITORING_ERROR_CODE.INVALID_MAX_ACCEPTABLE_LATENCY_MS,
    )
    const warningFailureThreshold = normalizePositiveInteger(
        input.warningFailureThreshold ?? DEFAULT_WARNING_FAILURE_THRESHOLD,
        AST_SERVICE_HEALTH_MONITORING_ERROR_CODE.INVALID_WARNING_FAILURE_THRESHOLD,
    )
    const criticalFailureThreshold = normalizePositiveInteger(
        input.criticalFailureThreshold ?? DEFAULT_CRITICAL_FAILURE_THRESHOLD,
        AST_SERVICE_HEALTH_MONITORING_ERROR_CODE.INVALID_CRITICAL_FAILURE_THRESHOLD,
    )

    ensureRequiredMonitoringIdentifiers(
        repositoryId,
        commitSha,
        includeCodeGraphCheck,
        includeFileMetricsCheck,
        includeScanStatusCheck,
    )
    ensureFailureThresholdRange(warningFailureThreshold, criticalFailureThreshold)

    return {
        repositoryId,
        commitSha,
        filePaths,
        includeCodeGraphCheck,
        includeFileMetricsCheck,
        includeScanStatusCheck,
        maxAcceptableLatencyMs,
        warningFailureThreshold,
        criticalFailureThreshold,
        retryPolicy: input.retryPolicy,
    }
}

/**
 * Ensures required repository and commit identifiers for enabled checks.
 *
 * @param repositoryId Optional repository id.
 * @param commitSha Optional commit sha.
 * @param includeCodeGraphCheck Enables code graph check.
 * @param includeFileMetricsCheck Enables file metrics check.
 * @param includeScanStatusCheck Enables scan checks.
 */
function ensureRequiredMonitoringIdentifiers(
    repositoryId: string | undefined,
    commitSha: string | undefined,
    includeCodeGraphCheck: boolean,
    includeFileMetricsCheck: boolean,
    includeScanStatusCheck: boolean,
): void {
    if (includeCodeGraphCheck || includeFileMetricsCheck || includeScanStatusCheck) {
        resolvedRequiredRepositoryId(repositoryId)
    }

    if (includeFileMetricsCheck || includeScanStatusCheck) {
        resolvedRequiredCommitSha(commitSha)
    }
}

/**
 * Ensures warning and critical failure thresholds order.
 *
 * @param warningFailureThreshold Warning failure threshold.
 * @param criticalFailureThreshold Critical failure threshold.
 */
function ensureFailureThresholdRange(
    warningFailureThreshold: number,
    criticalFailureThreshold: number,
): void {
    if (criticalFailureThreshold >= warningFailureThreshold) {
        return
    }

    throw new AstServiceHealthMonitoringError(
        AST_SERVICE_HEALTH_MONITORING_ERROR_CODE.INVALID_FAILURE_THRESHOLD_RANGE,
        {value: criticalFailureThreshold},
    )
}

/**
 * Normalizes optional repository identifier.
 *
 * @param repositoryId Raw repository identifier.
 * @returns Normalized repository identifier.
 */
function normalizeRepositoryId(repositoryId: string | undefined): string | undefined {
    if (repositoryId === undefined) {
        return undefined
    }

    const normalizedRepositoryId = repositoryId.trim()
    if (normalizedRepositoryId.length > 0) {
        return normalizedRepositoryId
    }

    throw new AstServiceHealthMonitoringError(
        AST_SERVICE_HEALTH_MONITORING_ERROR_CODE.INVALID_REPOSITORY_ID,
        {repositoryId},
    )
}

/**
 * Normalizes optional commit sha.
 *
 * @param commitSha Raw commit sha.
 * @returns Normalized commit sha.
 */
function normalizeCommitSha(commitSha: string | undefined): string | undefined {
    if (commitSha === undefined) {
        return undefined
    }

    const normalizedCommitSha = commitSha.trim()
    const commitShaPattern = /^[a-f0-9]{7,64}$/i

    if (commitShaPattern.test(normalizedCommitSha)) {
        return normalizedCommitSha
    }

    throw new AstServiceHealthMonitoringError(
        AST_SERVICE_HEALTH_MONITORING_ERROR_CODE.INVALID_COMMIT_SHA,
        {commitSha},
    )
}

/**
 * Normalizes optional file path filters.
 *
 * @param filePaths Raw file path filters.
 * @returns Sorted unique normalized file paths.
 */
function normalizeFilePaths(filePaths: readonly string[] | undefined): readonly string[] {
    if (filePaths === undefined) {
        return []
    }

    const normalizedPaths = new Set<string>()
    for (const filePath of filePaths) {
        try {
            normalizedPaths.add(FilePath.create(filePath).toString())
        } catch {
            throw new AstServiceHealthMonitoringError(
                AST_SERVICE_HEALTH_MONITORING_ERROR_CODE.INVALID_FILE_PATH,
                {filePath},
            )
        }
    }

    return [...normalizedPaths].sort((left, right) => left.localeCompare(right))
}

/**
 * Validates positive integer configuration values.
 *
 * @param value Raw numeric value.
 * @param errorCode Error code for invalid value.
 * @returns Validated positive integer.
 */
function normalizePositiveInteger(
    value: number,
    errorCode: AstServiceHealthMonitoringErrorCode,
): number {
    if (Number.isInteger(value) && value > 0) {
        return value
    }

    throw new AstServiceHealthMonitoringError(errorCode, {value})
}
