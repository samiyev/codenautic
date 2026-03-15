import {
    AST_SERVICE_HORIZONTAL_SCALING_ERROR_CODE,
    AstServiceHorizontalScalingError,
    type AstServiceHorizontalScalingErrorCode,
} from "./ast-service-horizontal-scaling.error"

const DEFAULT_MIN_REPLICAS = 2
const DEFAULT_MAX_REPLICAS = 16
const DEFAULT_SCALE_UP_STEP = 2
const DEFAULT_SCALE_DOWN_STEP = 1
const DEFAULT_TARGET_BACKLOG_PER_REPLICA = 120
const DEFAULT_HYSTERESIS_PERCENT = 20
const DEFAULT_RETRY_MAX_ATTEMPTS = 3
const DEFAULT_RETRY_INITIAL_BACKOFF_MS = 50
const DEFAULT_RETRY_MAX_BACKOFF_MS = 400
const DEFAULT_IDEMPOTENCY_CACHE_SIZE = 500

/**
 * Scaling action type.
 */
export const AST_SERVICE_HORIZONTAL_SCALING_ACTION = {
    NOOP: "NOOP",
    SCALE_DOWN: "SCALE_DOWN",
    SCALE_UP: "SCALE_UP",
} as const

/**
 * Scaling action literal.
 */
export type AstServiceHorizontalScalingAction =
    (typeof AST_SERVICE_HORIZONTAL_SCALING_ACTION)[keyof typeof AST_SERVICE_HORIZONTAL_SCALING_ACTION]

/**
 * Sleep callback used by scaling retry/backoff handling.
 */
export type AstServiceHorizontalScalingSleep = (durationMs: number) => Promise<void>

/**
 * Clock callback used by scaling service.
 */
export type AstServiceHorizontalScalingNow = () => number

/**
 * Retry classifier callback for scaling metrics provider failures.
 */
export type AstServiceHorizontalScalingShouldRetry = (error: unknown, attempt: number) => boolean

/**
 * Retry policy input for scaling metrics provider calls.
 */
export interface IAstServiceHorizontalScalingRetryPolicyInput {
    /**
     * Maximum attempts including initial execution.
     */
    readonly maxAttempts?: number

    /**
     * Initial exponential backoff in milliseconds.
     */
    readonly initialBackoffMs?: number

    /**
     * Maximum capped backoff in milliseconds.
     */
    readonly maxBackoffMs?: number
}

/**
 * Repository load item used by scaling calculations.
 */
export interface IAstServiceHorizontalScalingRepositoryLoad {
    /**
     * Repository identifier.
     */
    readonly repositoryId: string

    /**
     * Pending jobs count for repository.
     */
    readonly pendingJobs: number

    /**
     * Active running jobs count for repository.
     */
    readonly activeJobs: number
}

/**
 * Metrics snapshot input used by scaling service.
 */
export interface IAstServiceHorizontalScalingMetricsSnapshotInput {
    /**
     * Queue depth across all repositories.
     */
    readonly queueDepth: number

    /**
     * Optional total pending jobs override.
     */
    readonly totalPendingJobs?: number

    /**
     * Optional total active jobs override.
     */
    readonly totalActiveJobs?: number

    /**
     * Per-repository load list.
     */
    readonly repositories: readonly IAstServiceHorizontalScalingRepositoryLoad[]
}

/**
 * Normalized metrics snapshot used by planning algorithm.
 */
export interface IAstServiceHorizontalScalingMetricsSnapshot {
    /**
     * Queue depth across all repositories.
     */
    readonly queueDepth: number

    /**
     * Total pending jobs count.
     */
    readonly totalPendingJobs: number

    /**
     * Total active jobs count.
     */
    readonly totalActiveJobs: number

    /**
     * Normalized repository load list.
     */
    readonly repositories: readonly IAstServiceHorizontalScalingRepositoryLoad[]
}

/**
 * Metrics provider request payload.
 */
export interface IAstServiceHorizontalScalingMetricsProviderInput {
    /**
     * Optional repository filter.
     */
    readonly repositoryIds?: readonly string[]
}

/**
 * External metrics provider callback.
 */
export type AstServiceHorizontalScalingMetricsProvider = (
    input: IAstServiceHorizontalScalingMetricsProviderInput,
) => Promise<IAstServiceHorizontalScalingMetricsSnapshotInput>

/**
 * Input payload for horizontal scaling support.
 */
export interface IAstServiceHorizontalScalingInput {
    /**
     * Current number of running replicas.
     */
    readonly currentReplicas: number

    /**
     * Optional lower replica bound.
     */
    readonly minReplicas?: number

    /**
     * Optional upper replica bound.
     */
    readonly maxReplicas?: number

    /**
     * Optional scale-up step size.
     */
    readonly scaleUpStep?: number

    /**
     * Optional scale-down step size.
     */
    readonly scaleDownStep?: number

    /**
     * Optional target backlog per replica.
     */
    readonly targetBacklogPerReplica?: number

    /**
     * Optional hysteresis percent in range [0, 100].
     */
    readonly hysteresisPercent?: number

    /**
     * Optional repository id filter.
     */
    readonly repositoryIds?: readonly string[]

    /**
     * Optional metrics snapshot override.
     */
    readonly metricsSnapshot?: IAstServiceHorizontalScalingMetricsSnapshotInput

    /**
     * Optional metrics provider retry policy override.
     */
    readonly retryPolicy?: IAstServiceHorizontalScalingRetryPolicyInput

    /**
     * Optional idempotency key for deterministic result reuse.
     */
    readonly idempotencyKey?: string
}

/**
 * One planned horizontal scaling decision.
 */
export interface IAstServiceHorizontalScalingReplicaPlan {
    /**
     * Current number of running replicas.
     */
    readonly currentReplicas: number

    /**
     * Planned target replica count.
     */
    readonly targetReplicas: number

    /**
     * Calculated scale delta.
     */
    readonly scaleDelta: number

    /**
     * Scaling action.
     */
    readonly action: AstServiceHorizontalScalingAction

    /**
     * Stable textual explanation.
     */
    readonly reason: string
}

/**
 * One repository-to-replica assignment bucket.
 */
export interface IAstServiceHorizontalScalingReplicaAssignment {
    /**
     * Stable replica identifier.
     */
    readonly replicaId: string

    /**
     * Assigned repository identifiers.
     */
    readonly repositoryIds: readonly string[]

    /**
     * Aggregated pending jobs assigned to replica.
     */
    readonly pendingJobs: number

    /**
     * Aggregated active jobs assigned to replica.
     */
    readonly activeJobs: number
}

/**
 * Summary for one scaling evaluation.
 */
export interface IAstServiceHorizontalScalingSummary {
    /**
     * Total repositories included in evaluation.
     */
    readonly totalRepositories: number

    /**
     * Total pending jobs across included repositories.
     */
    readonly totalPendingJobs: number

    /**
     * Total active jobs across included repositories.
     */
    readonly totalActiveJobs: number

    /**
     * Queue depth included in evaluation.
     */
    readonly queueDepth: number

    /**
     * Effective load value used by algorithm.
     */
    readonly effectiveLoad: number

    /**
     * Effective backlog per current replica.
     */
    readonly backlogPerReplica: number

    /**
     * Target backlog per replica.
     */
    readonly targetBacklogPerReplica: number

    /**
     * Number of attempts used to obtain metrics snapshot.
     */
    readonly attempts: number

    /**
     * Whether result was returned from idempotency cache.
     */
    readonly fromIdempotencyCache: boolean

    /**
     * Evaluation timestamp.
     */
    readonly evaluatedAtUnixMs: number
}

/**
 * Horizontal scaling support output payload.
 */
export interface IAstServiceHorizontalScalingResult {
    /**
     * Planned replica decision.
     */
    readonly replicaPlan: IAstServiceHorizontalScalingReplicaPlan

    /**
     * Deterministic repository assignments for target replicas.
     */
    readonly assignments: readonly IAstServiceHorizontalScalingReplicaAssignment[]

    /**
     * Aggregated scaling summary.
     */
    readonly summary: IAstServiceHorizontalScalingSummary
}

/**
 * Runtime options for horizontal scaling support.
 */
export interface IAstServiceHorizontalScalingServiceOptions {
    /**
     * Optional metrics provider callback.
     */
    readonly metricsProvider?: AstServiceHorizontalScalingMetricsProvider

    /**
     * Optional default retry policy.
     */
    readonly defaultRetryPolicy?: IAstServiceHorizontalScalingRetryPolicyInput

    /**
     * Optional idempotency cache size.
     */
    readonly idempotencyCacheSize?: number

    /**
     * Optional retry/backoff sleep callback.
     */
    readonly sleep?: AstServiceHorizontalScalingSleep

    /**
     * Optional clock callback.
     */
    readonly now?: AstServiceHorizontalScalingNow

    /**
     * Optional retry classifier callback.
     */
    readonly shouldRetry?: AstServiceHorizontalScalingShouldRetry
}

/**
 * Horizontal scaling support contract.
 */
export interface IAstServiceHorizontalScalingService {
    /**
     * Evaluates metrics and produces deterministic horizontal scaling plan.
     *
     * @param input Scaling evaluation input.
     * @returns Deterministic scaling plan and assignments.
     */
    plan(input: IAstServiceHorizontalScalingInput): Promise<IAstServiceHorizontalScalingResult>
}

interface IResolvedRetryPolicy {
    readonly maxAttempts: number
    readonly initialBackoffMs: number
    readonly maxBackoffMs: number
}

interface IResolvedScalingInput {
    readonly currentReplicas: number
    readonly minReplicas: number
    readonly maxReplicas: number
    readonly scaleUpStep: number
    readonly scaleDownStep: number
    readonly targetBacklogPerReplica: number
    readonly hysteresisPercent: number
    readonly repositoryIds?: readonly string[]
    readonly metricsSnapshot?: IAstServiceHorizontalScalingMetricsSnapshotInput
    readonly retryPolicy: IResolvedRetryPolicy
    readonly idempotencyKey?: string
}

interface IScalingMetricsResolution {
    readonly snapshot: IAstServiceHorizontalScalingMetricsSnapshot
    readonly attempts: number
}

interface IReplicaBucket {
    readonly replicaId: string
    readonly repositoryIds: string[]
    pendingJobs: number
    activeJobs: number
}

interface ICreateSummaryInput {
    readonly snapshot: IAstServiceHorizontalScalingMetricsSnapshot
    readonly targetBacklogPerReplica: number
    readonly effectiveLoad: number
    readonly backlogPerReplica: number
    readonly attempts: number
    readonly fromIdempotencyCache: boolean
    readonly evaluatedAtUnixMs: number
}

/**
 * Horizontal scaling support service for AST service workloads.
 */
export class AstServiceHorizontalScalingService implements IAstServiceHorizontalScalingService {
    private readonly metricsProvider: AstServiceHorizontalScalingMetricsProvider
    private readonly defaultRetryPolicy?: IAstServiceHorizontalScalingRetryPolicyInput
    private readonly idempotencyCache = new Map<string, IAstServiceHorizontalScalingResult>()
    private readonly idempotencyCacheSize: number
    private readonly sleep: AstServiceHorizontalScalingSleep
    private readonly now: AstServiceHorizontalScalingNow
    private readonly shouldRetry: AstServiceHorizontalScalingShouldRetry

    /**
     * Creates AST horizontal scaling support service.
     *
     * @param options Optional runtime overrides.
     */
    public constructor(options: IAstServiceHorizontalScalingServiceOptions = {}) {
        this.metricsProvider = options.metricsProvider ?? defaultMetricsProvider
        this.defaultRetryPolicy = options.defaultRetryPolicy
        this.idempotencyCacheSize = validatePositiveInteger(
            options.idempotencyCacheSize ?? DEFAULT_IDEMPOTENCY_CACHE_SIZE,
            AST_SERVICE_HORIZONTAL_SCALING_ERROR_CODE.INVALID_IDEMPOTENCY_CACHE_SIZE,
        )
        this.sleep = options.sleep ?? sleepFor
        this.now = options.now ?? Date.now
        this.shouldRetry = options.shouldRetry ?? defaultShouldRetry
    }

    /**
     * Evaluates metrics and produces deterministic horizontal scaling plan.
     *
     * @param input Scaling evaluation input.
     * @returns Deterministic scaling plan and assignments.
     */
    public async plan(
        input: IAstServiceHorizontalScalingInput,
    ): Promise<IAstServiceHorizontalScalingResult> {
        const resolvedInput = resolveScalingInput(input, this.defaultRetryPolicy)
        const cachedResult = this.resolveCachedResult(resolvedInput.idempotencyKey)
        if (cachedResult !== undefined) {
            return cachedResult
        }

        const metricsResolution = await this.resolveMetricsSnapshot(resolvedInput)
        const effectiveLoad = resolveEffectiveLoad(metricsResolution.snapshot)
        const replicaPlan = createReplicaPlan(resolvedInput, effectiveLoad)
        const assignments = createAssignments(
            metricsResolution.snapshot.repositories,
            replicaPlan.targetReplicas,
        )

        const result: IAstServiceHorizontalScalingResult = {
            replicaPlan,
            assignments,
            summary: createSummary({
                snapshot: metricsResolution.snapshot,
                targetBacklogPerReplica: resolvedInput.targetBacklogPerReplica,
                effectiveLoad,
                backlogPerReplica: safeDivide(effectiveLoad, resolvedInput.currentReplicas),
                attempts: metricsResolution.attempts,
                fromIdempotencyCache: false,
                evaluatedAtUnixMs: this.now(),
            }),
        }

        this.persistCachedResult(resolvedInput.idempotencyKey, result)
        return result
    }

    /**
     * Resolves metrics snapshot with optional retry/backoff behavior.
     *
     * @param input Resolved scaling input.
     * @returns Normalized metrics snapshot and attempts count.
     */
    private async resolveMetricsSnapshot(
        input: IResolvedScalingInput,
    ): Promise<IScalingMetricsResolution> {
        if (input.metricsSnapshot !== undefined) {
            return {
                snapshot: normalizeMetricsSnapshot(
                    input.metricsSnapshot,
                    input.repositoryIds,
                ),
                attempts: 0,
            }
        }

        return this.executeWithRetry(
            async () =>
                this.metricsProvider({
                    repositoryIds: input.repositoryIds,
                }),
            input.retryPolicy,
            input.repositoryIds,
        )
    }

    /**
     * Executes metrics provider with retry/backoff policy.
     *
     * @param providerCall Provider invocation callback.
     * @param retryPolicy Resolved retry policy.
     * @param repositoryIds Optional repository filter.
     * @returns Normalized metrics snapshot and attempts count.
     */
    private async executeWithRetry(
        providerCall: () => Promise<IAstServiceHorizontalScalingMetricsSnapshotInput>,
        retryPolicy: IResolvedRetryPolicy,
        repositoryIds: readonly string[] | undefined,
    ): Promise<IScalingMetricsResolution> {
        let attempt = 0
        let lastError: unknown

        while (attempt < retryPolicy.maxAttempts) {
            attempt += 1

            try {
                const snapshot = await providerCall()
                return {
                    snapshot: normalizeMetricsSnapshot(snapshot, repositoryIds),
                    attempts: attempt,
                }
            } catch (error) {
                lastError = error
                const canRetry =
                    attempt < retryPolicy.maxAttempts &&
                    this.shouldRetry(error, attempt)
                if (canRetry) {
                    await this.sleep(resolveBackoffMs(attempt, retryPolicy))
                    continue
                }

                if (attempt >= retryPolicy.maxAttempts) {
                    throw new AstServiceHorizontalScalingError(
                        AST_SERVICE_HORIZONTAL_SCALING_ERROR_CODE.RETRY_EXHAUSTED,
                        {
                            attempts: attempt,
                            causeMessage: resolveUnknownErrorMessage(error),
                        },
                    )
                }

                throw new AstServiceHorizontalScalingError(
                    AST_SERVICE_HORIZONTAL_SCALING_ERROR_CODE.METRICS_PROVIDER_FAILED,
                    {
                        causeMessage: resolveUnknownErrorMessage(error),
                    },
                )
            }
        }

        throw new AstServiceHorizontalScalingError(
            AST_SERVICE_HORIZONTAL_SCALING_ERROR_CODE.RETRY_EXHAUSTED,
            {
                attempts: retryPolicy.maxAttempts,
                causeMessage: resolveUnknownErrorMessage(lastError),
            },
        )
    }

    /**
     * Resolves cached result by idempotency key.
     *
     * @param idempotencyKey Optional idempotency key.
     * @returns Cached result with cache flag when available.
     */
    private resolveCachedResult(
        idempotencyKey: string | undefined,
    ): IAstServiceHorizontalScalingResult | undefined {
        if (idempotencyKey === undefined) {
            return undefined
        }

        const cached = this.idempotencyCache.get(idempotencyKey)
        if (cached === undefined) {
            return undefined
        }

        return {
            replicaPlan: cached.replicaPlan,
            assignments: cached.assignments,
            summary: {
                ...cached.summary,
                attempts: 0,
                fromIdempotencyCache: true,
                evaluatedAtUnixMs: this.now(),
            },
        }
    }

    /**
     * Persists result in bounded idempotency cache.
     *
     * @param idempotencyKey Optional idempotency key.
     * @param result Scaling result.
     */
    private persistCachedResult(
        idempotencyKey: string | undefined,
        result: IAstServiceHorizontalScalingResult,
    ): void {
        if (idempotencyKey === undefined) {
            return
        }

        if (this.idempotencyCache.size >= this.idempotencyCacheSize) {
            const firstKey = this.idempotencyCache.keys().next().value
            if (firstKey !== undefined) {
                this.idempotencyCache.delete(firstKey)
            }
        }

        this.idempotencyCache.set(idempotencyKey, result)
    }
}

/**
 * Resolves and validates scaling input.
 *
 * @param input Raw scaling input.
 * @param defaultRetryPolicy Optional default retry policy.
 * @returns Resolved scaling input.
 */
function resolveScalingInput(
    input: IAstServiceHorizontalScalingInput,
    defaultRetryPolicy: IAstServiceHorizontalScalingRetryPolicyInput | undefined,
): IResolvedScalingInput {
    const currentReplicas = validatePositiveInteger(
        input.currentReplicas,
        AST_SERVICE_HORIZONTAL_SCALING_ERROR_CODE.INVALID_CURRENT_REPLICAS,
    )
    const minReplicas = validatePositiveInteger(
        input.minReplicas ?? DEFAULT_MIN_REPLICAS,
        AST_SERVICE_HORIZONTAL_SCALING_ERROR_CODE.INVALID_MIN_REPLICAS,
    )
    const maxReplicas = validatePositiveInteger(
        input.maxReplicas ?? DEFAULT_MAX_REPLICAS,
        AST_SERVICE_HORIZONTAL_SCALING_ERROR_CODE.INVALID_MAX_REPLICAS,
    )
    validateReplicaRange(minReplicas, maxReplicas)
    ensureCurrentReplicasWithinRange(currentReplicas, minReplicas, maxReplicas)

    return {
        currentReplicas,
        minReplicas,
        maxReplicas,
        scaleUpStep: validatePositiveInteger(
            input.scaleUpStep ?? DEFAULT_SCALE_UP_STEP,
            AST_SERVICE_HORIZONTAL_SCALING_ERROR_CODE.INVALID_SCALE_UP_STEP,
        ),
        scaleDownStep: validatePositiveInteger(
            input.scaleDownStep ?? DEFAULT_SCALE_DOWN_STEP,
            AST_SERVICE_HORIZONTAL_SCALING_ERROR_CODE.INVALID_SCALE_DOWN_STEP,
        ),
        targetBacklogPerReplica: validatePositiveInteger(
            input.targetBacklogPerReplica ?? DEFAULT_TARGET_BACKLOG_PER_REPLICA,
            AST_SERVICE_HORIZONTAL_SCALING_ERROR_CODE.INVALID_TARGET_BACKLOG_PER_REPLICA,
        ),
        hysteresisPercent: validatePercentage(input.hysteresisPercent ?? DEFAULT_HYSTERESIS_PERCENT),
        repositoryIds: normalizeRepositoryIds(input.repositoryIds),
        metricsSnapshot: input.metricsSnapshot,
        retryPolicy: resolveRetryPolicy(input.retryPolicy, defaultRetryPolicy),
        idempotencyKey: normalizeIdempotencyKey(input.idempotencyKey),
    }
}

/**
 * Resolves retry policy with defaults and validation.
 *
 * @param retryPolicy Optional request-level retry policy.
 * @param defaultRetryPolicy Optional service-level retry policy.
 * @returns Resolved retry policy.
 */
function resolveRetryPolicy(
    retryPolicy: IAstServiceHorizontalScalingRetryPolicyInput | undefined,
    defaultRetryPolicy: IAstServiceHorizontalScalingRetryPolicyInput | undefined,
): IResolvedRetryPolicy {
    const source = retryPolicy ?? defaultRetryPolicy
    const maxAttempts = validatePositiveInteger(
        source?.maxAttempts ?? DEFAULT_RETRY_MAX_ATTEMPTS,
        AST_SERVICE_HORIZONTAL_SCALING_ERROR_CODE.INVALID_RETRY_MAX_ATTEMPTS,
    )
    const initialBackoffMs = validatePositiveInteger(
        source?.initialBackoffMs ?? DEFAULT_RETRY_INITIAL_BACKOFF_MS,
        AST_SERVICE_HORIZONTAL_SCALING_ERROR_CODE.INVALID_RETRY_INITIAL_BACKOFF_MS,
    )
    const maxBackoffMs = validatePositiveInteger(
        source?.maxBackoffMs ?? DEFAULT_RETRY_MAX_BACKOFF_MS,
        AST_SERVICE_HORIZONTAL_SCALING_ERROR_CODE.INVALID_MAX_BACKOFF_MS,
    )

    if (maxBackoffMs < initialBackoffMs) {
        throw new AstServiceHorizontalScalingError(
            AST_SERVICE_HORIZONTAL_SCALING_ERROR_CODE.INVALID_MAX_BACKOFF_MS,
            {
                value: maxBackoffMs,
            },
        )
    }

    return {
        maxAttempts,
        initialBackoffMs,
        maxBackoffMs,
    }
}

/**
 * Normalizes optional repository filter.
 *
 * @param repositoryIds Optional repository ids.
 * @returns Sorted unique repository ids.
 */
function normalizeRepositoryIds(repositoryIds: readonly string[] | undefined): readonly string[] | undefined {
    if (repositoryIds === undefined) {
        return undefined
    }

    const normalized = new Set<string>()
    for (const repositoryId of repositoryIds) {
        const normalizedRepositoryId = repositoryId.trim()
        if (normalizedRepositoryId.length === 0) {
            throw new AstServiceHorizontalScalingError(
                AST_SERVICE_HORIZONTAL_SCALING_ERROR_CODE.INVALID_REPOSITORY_ID,
                {
                    repositoryId,
                },
            )
        }

        normalized.add(normalizedRepositoryId)
    }

    return [...normalized].sort((left, right) => left.localeCompare(right))
}

/**
 * Normalizes optional idempotency key.
 *
 * @param idempotencyKey Optional idempotency key.
 * @returns Normalized idempotency key.
 */
function normalizeIdempotencyKey(idempotencyKey: string | undefined): string | undefined {
    if (idempotencyKey === undefined) {
        return undefined
    }

    const normalizedKey = idempotencyKey.trim()
    if (normalizedKey.length > 0) {
        return normalizedKey
    }

    throw new AstServiceHorizontalScalingError(
        AST_SERVICE_HORIZONTAL_SCALING_ERROR_CODE.INVALID_IDEMPOTENCY_KEY,
        {
            idempotencyKey,
        },
    )
}

/**
 * Normalizes and validates metrics snapshot.
 *
 * @param snapshot Raw metrics snapshot.
 * @param repositoryIds Optional repository filter.
 * @returns Normalized metrics snapshot.
 */
function normalizeMetricsSnapshot(
    snapshot: IAstServiceHorizontalScalingMetricsSnapshotInput,
    repositoryIds: readonly string[] | undefined,
): IAstServiceHorizontalScalingMetricsSnapshot {
    const queueDepth = validateNonNegativeInteger(
        snapshot.queueDepth,
        AST_SERVICE_HORIZONTAL_SCALING_ERROR_CODE.INVALID_QUEUE_DEPTH,
    )
    const repositories = normalizeRepositoryLoads(snapshot.repositories, repositoryIds)
    const totalPendingFromRepositories = repositories.reduce((sum, item) => sum + item.pendingJobs, 0)
    const totalActiveFromRepositories = repositories.reduce((sum, item) => sum + item.activeJobs, 0)
    const totalPendingJobs = resolveTotalPendingJobs(
        snapshot.totalPendingJobs,
        totalPendingFromRepositories,
    )
    const totalActiveJobs = resolveTotalActiveJobs(
        snapshot.totalActiveJobs,
        totalActiveFromRepositories,
    )

    return {
        queueDepth,
        totalPendingJobs,
        totalActiveJobs,
        repositories,
    }
}

/**
 * Resolves total pending jobs value with optional override validation.
 *
 * @param value Optional pending jobs override.
 * @param fallback Fallback computed pending jobs.
 * @returns Resolved pending jobs value.
 */
function resolveTotalPendingJobs(value: number | undefined, fallback: number): number {
    if (value === undefined) {
        return fallback
    }

    return validateNonNegativeInteger(
        value,
        AST_SERVICE_HORIZONTAL_SCALING_ERROR_CODE.INVALID_TOTAL_PENDING_JOBS,
    )
}

/**
 * Resolves total active jobs value with optional override validation.
 *
 * @param value Optional active jobs override.
 * @param fallback Fallback computed active jobs.
 * @returns Resolved active jobs value.
 */
function resolveTotalActiveJobs(value: number | undefined, fallback: number): number {
    if (value === undefined) {
        return fallback
    }

    return validateNonNegativeInteger(
        value,
        AST_SERVICE_HORIZONTAL_SCALING_ERROR_CODE.INVALID_ACTIVE_JOBS,
    )
}

/**
 * Normalizes repository load list with optional filtering.
 *
 * @param repositories Raw repository load list.
 * @param repositoryIds Optional repository filter.
 * @returns Normalized repository load list.
 */
function normalizeRepositoryLoads(
    repositories: readonly IAstServiceHorizontalScalingRepositoryLoad[],
    repositoryIds: readonly string[] | undefined,
): readonly IAstServiceHorizontalScalingRepositoryLoad[] {
    const allowed = repositoryIds !== undefined ? new Set(repositoryIds) : undefined
    const deduplicated = new Map<string, IAstServiceHorizontalScalingRepositoryLoad>()

    for (const repository of repositories) {
        const repositoryId = repository.repositoryId.trim()
        if (repositoryId.length === 0) {
            throw new AstServiceHorizontalScalingError(
                AST_SERVICE_HORIZONTAL_SCALING_ERROR_CODE.INVALID_REPOSITORY_ID,
                {
                    repositoryId: repository.repositoryId,
                },
            )
        }

        if (allowed !== undefined && allowed.has(repositoryId) === false) {
            continue
        }

        const pendingJobs = validateNonNegativeInteger(
            repository.pendingJobs,
            AST_SERVICE_HORIZONTAL_SCALING_ERROR_CODE.INVALID_TOTAL_PENDING_JOBS,
        )
        const activeJobs = validateNonNegativeInteger(
            repository.activeJobs,
            AST_SERVICE_HORIZONTAL_SCALING_ERROR_CODE.INVALID_ACTIVE_JOBS,
        )
        const existing = deduplicated.get(repositoryId)
        if (existing === undefined) {
            deduplicated.set(repositoryId, {
                repositoryId,
                pendingJobs,
                activeJobs,
            })
            continue
        }

        deduplicated.set(repositoryId, {
            repositoryId,
            pendingJobs: existing.pendingJobs + pendingJobs,
            activeJobs: existing.activeJobs + activeJobs,
        })
    }

    return [...deduplicated.values()].sort((left, right) => left.repositoryId.localeCompare(right.repositoryId))
}

/**
 * Resolves effective load used by scaling decision.
 *
 * @param snapshot Normalized metrics snapshot.
 * @returns Effective load value.
 */
function resolveEffectiveLoad(snapshot: IAstServiceHorizontalScalingMetricsSnapshot): number {
    return snapshot.totalPendingJobs + snapshot.totalActiveJobs + snapshot.queueDepth
}

/**
 * Creates deterministic replica plan.
 *
 * @param input Resolved scaling input.
 * @param effectiveLoad Effective load value.
 * @returns Deterministic replica plan.
 */
function createReplicaPlan(
    input: IResolvedScalingInput,
    effectiveLoad: number,
): IAstServiceHorizontalScalingReplicaPlan {
    const currentBacklog = safeDivide(effectiveLoad, input.currentReplicas)
    const desiredReplicas = clampReplicas(
        Math.ceil(safeDivide(effectiveLoad, input.targetBacklogPerReplica)),
        input.minReplicas,
        input.maxReplicas,
    )
    const upperThreshold = input.targetBacklogPerReplica * (1 + input.hysteresisPercent / 100)
    const lowerThreshold = input.targetBacklogPerReplica * (1 - input.hysteresisPercent / 100)

    if (currentBacklog > upperThreshold && input.currentReplicas < input.maxReplicas) {
        return createScaleUpPlan(input, desiredReplicas, currentBacklog, upperThreshold)
    }

    if (currentBacklog < lowerThreshold && input.currentReplicas > input.minReplicas) {
        return createScaleDownPlan(input, desiredReplicas, currentBacklog, lowerThreshold)
    }

    return {
        currentReplicas: input.currentReplicas,
        targetReplicas: input.currentReplicas,
        scaleDelta: 0,
        action: AST_SERVICE_HORIZONTAL_SCALING_ACTION.NOOP,
        reason: `Backlog ${roundTo(currentBacklog, 2)} is within hysteresis window`,
    }
}

/**
 * Creates scale-up plan.
 *
 * @param input Resolved scaling input.
 * @param desiredReplicas Desired replica count.
 * @param currentBacklog Current backlog per replica.
 * @param threshold Upper threshold.
 * @returns Scale-up plan.
 */
function createScaleUpPlan(
    input: IResolvedScalingInput,
    desiredReplicas: number,
    currentBacklog: number,
    threshold: number,
): IAstServiceHorizontalScalingReplicaPlan {
    const stepTarget = Math.min(input.maxReplicas, input.currentReplicas + input.scaleUpStep)
    const targetReplicas = Math.max(stepTarget, desiredReplicas)

    return {
        currentReplicas: input.currentReplicas,
        targetReplicas,
        scaleDelta: targetReplicas - input.currentReplicas,
        action: AST_SERVICE_HORIZONTAL_SCALING_ACTION.SCALE_UP,
        reason: `Backlog ${roundTo(currentBacklog, 2)} exceeded upper threshold ${roundTo(
            threshold,
            2,
        )}`,
    }
}

/**
 * Creates scale-down plan.
 *
 * @param input Resolved scaling input.
 * @param desiredReplicas Desired replica count.
 * @param currentBacklog Current backlog per replica.
 * @param threshold Lower threshold.
 * @returns Scale-down plan.
 */
function createScaleDownPlan(
    input: IResolvedScalingInput,
    desiredReplicas: number,
    currentBacklog: number,
    threshold: number,
): IAstServiceHorizontalScalingReplicaPlan {
    const stepTarget = Math.max(input.minReplicas, input.currentReplicas - input.scaleDownStep)
    const targetReplicas = Math.max(stepTarget, Math.max(input.minReplicas, desiredReplicas))

    return {
        currentReplicas: input.currentReplicas,
        targetReplicas,
        scaleDelta: targetReplicas - input.currentReplicas,
        action: AST_SERVICE_HORIZONTAL_SCALING_ACTION.SCALE_DOWN,
        reason: `Backlog ${roundTo(currentBacklog, 2)} dropped below lower threshold ${roundTo(
            threshold,
            2,
        )}`,
    }
}

/**
 * Creates deterministic repository assignments for replicas.
 *
 * @param repositories Normalized repositories.
 * @param targetReplicas Target replica count.
 * @returns Deterministic assignments.
 */
function createAssignments(
    repositories: readonly IAstServiceHorizontalScalingRepositoryLoad[],
    targetReplicas: number,
): readonly IAstServiceHorizontalScalingReplicaAssignment[] {
    const buckets = createReplicaBuckets(targetReplicas)
    const sortedRepositories = [...repositories].sort(compareRepositoryLoad)

    for (const repository of sortedRepositories) {
        const bucket = selectLeastLoadedBucket(buckets)
        bucket.repositoryIds.push(repository.repositoryId)
        bucket.pendingJobs += repository.pendingJobs
        bucket.activeJobs += repository.activeJobs
    }

    return buckets.map((bucket) => ({
        replicaId: bucket.replicaId,
        repositoryIds: [...bucket.repositoryIds],
        pendingJobs: bucket.pendingJobs,
        activeJobs: bucket.activeJobs,
    }))
}

/**
 * Creates initial replica buckets.
 *
 * @param targetReplicas Target replica count.
 * @returns Mutable replica buckets.
 */
function createReplicaBuckets(targetReplicas: number): IReplicaBucket[] {
    const buckets: IReplicaBucket[] = []
    for (let index = 0; index < targetReplicas; index += 1) {
        buckets.push({
            replicaId: `replica-${index + 1}`,
            repositoryIds: [],
            pendingJobs: 0,
            activeJobs: 0,
        })
    }

    return buckets
}

/**
 * Compares repositories by load and id for deterministic ordering.
 *
 * @param left Left repository.
 * @param right Right repository.
 * @returns Comparator value.
 */
function compareRepositoryLoad(
    left: IAstServiceHorizontalScalingRepositoryLoad,
    right: IAstServiceHorizontalScalingRepositoryLoad,
): number {
    if (right.pendingJobs !== left.pendingJobs) {
        return right.pendingJobs - left.pendingJobs
    }

    if (right.activeJobs !== left.activeJobs) {
        return right.activeJobs - left.activeJobs
    }

    return left.repositoryId.localeCompare(right.repositoryId)
}

/**
 * Selects least-loaded replica bucket.
 *
 * @param buckets Mutable replica buckets.
 * @returns Least-loaded bucket.
 */
function selectLeastLoadedBucket(buckets: IReplicaBucket[]): IReplicaBucket {
    let selected = buckets[0]
    if (selected === undefined) {
        throw new AstServiceHorizontalScalingError(
            AST_SERVICE_HORIZONTAL_SCALING_ERROR_CODE.INVALID_MIN_REPLICAS,
            {value: 0},
        )
    }

    for (const candidate of buckets) {
        if (candidate.pendingJobs < selected.pendingJobs) {
            selected = candidate
            continue
        }

        if (candidate.pendingJobs > selected.pendingJobs) {
            continue
        }

        if (candidate.activeJobs < selected.activeJobs) {
            selected = candidate
            continue
        }

        if (candidate.activeJobs > selected.activeJobs) {
            continue
        }

        if (candidate.replicaId.localeCompare(selected.replicaId) < 0) {
            selected = candidate
        }
    }

    return selected
}

/**
 * Creates scaling summary.
 *
 * @param input Summary input payload.
 * @returns Scaling summary.
 */
function createSummary(input: ICreateSummaryInput): IAstServiceHorizontalScalingSummary {
    return {
        totalRepositories: input.snapshot.repositories.length,
        totalPendingJobs: input.snapshot.totalPendingJobs,
        totalActiveJobs: input.snapshot.totalActiveJobs,
        queueDepth: input.snapshot.queueDepth,
        effectiveLoad: input.effectiveLoad,
        backlogPerReplica: roundTo(input.backlogPerReplica, 4),
        targetBacklogPerReplica: input.targetBacklogPerReplica,
        attempts: input.attempts,
        fromIdempotencyCache: input.fromIdempotencyCache,
        evaluatedAtUnixMs: input.evaluatedAtUnixMs,
    }
}

/**
 * Ensures current replicas are inside configured range.
 *
 * @param currentReplicas Current replicas.
 * @param minReplicas Min replicas.
 * @param maxReplicas Max replicas.
 */
function ensureCurrentReplicasWithinRange(
    currentReplicas: number,
    minReplicas: number,
    maxReplicas: number,
): void {
    if (currentReplicas >= minReplicas && currentReplicas <= maxReplicas) {
        return
    }

    throw new AstServiceHorizontalScalingError(
        AST_SERVICE_HORIZONTAL_SCALING_ERROR_CODE.INVALID_CURRENT_REPLICAS,
        {value: currentReplicas},
    )
}

/**
 * Validates replica bounds.
 *
 * @param minReplicas Min replicas.
 * @param maxReplicas Max replicas.
 */
function validateReplicaRange(minReplicas: number, maxReplicas: number): void {
    if (maxReplicas >= minReplicas) {
        return
    }

    throw new AstServiceHorizontalScalingError(
        AST_SERVICE_HORIZONTAL_SCALING_ERROR_CODE.INVALID_REPLICA_RANGE,
        {
            minReplicas,
            maxReplicas,
        },
    )
}

/**
 * Validates positive integer value.
 *
 * @param value Raw value.
 * @param errorCode Typed error code.
 * @returns Validated integer.
 */
function validatePositiveInteger(
    value: number,
    errorCode: AstServiceHorizontalScalingErrorCode,
): number {
    if (Number.isSafeInteger(value) && value > 0) {
        return value
    }

    throw new AstServiceHorizontalScalingError(errorCode, {value})
}

/**
 * Validates non-negative integer value.
 *
 * @param value Raw value.
 * @param errorCode Typed error code.
 * @returns Validated integer.
 */
function validateNonNegativeInteger(
    value: number,
    errorCode: AstServiceHorizontalScalingErrorCode,
): number {
    if (Number.isSafeInteger(value) && value >= 0) {
        return value
    }

    throw new AstServiceHorizontalScalingError(errorCode, {value})
}

/**
 * Validates percentage value in range [0, 100].
 *
 * @param value Raw percentage value.
 * @returns Validated percentage.
 */
function validatePercentage(value: number): number {
    if (Number.isFinite(value) && value >= 0 && value <= 100) {
        return value
    }

    throw new AstServiceHorizontalScalingError(
        AST_SERVICE_HORIZONTAL_SCALING_ERROR_CODE.INVALID_HYSTERESIS_PERCENT,
        {value},
    )
}

/**
 * Calculates bounded exponential backoff.
 *
 * @param attempt Attempt number.
 * @param retryPolicy Resolved retry policy.
 * @returns Backoff in milliseconds.
 */
function resolveBackoffMs(attempt: number, retryPolicy: IResolvedRetryPolicy): number {
    const exponent = Math.max(0, attempt - 1)
    const backoff = retryPolicy.initialBackoffMs * 2 ** exponent
    return Math.min(retryPolicy.maxBackoffMs, backoff)
}

/**
 * Clamps replica value into configured range.
 *
 * @param value Raw replica value.
 * @param minReplicas Min replicas.
 * @param maxReplicas Max replicas.
 * @returns Clamped replica value.
 */
function clampReplicas(value: number, minReplicas: number, maxReplicas: number): number {
    return Math.min(maxReplicas, Math.max(minReplicas, value))
}

/**
 * Divides numbers with zero protection.
 *
 * @param value Numerator value.
 * @param divider Divider value.
 * @returns Division result or zero.
 */
function safeDivide(value: number, divider: number): number {
    if (divider === 0) {
        return 0
    }

    return value / divider
}

/**
 * Rounds numeric value with fixed precision.
 *
 * @param value Raw numeric value.
 * @param precision Decimal precision.
 * @returns Rounded value.
 */
function roundTo(value: number, precision: number): number {
    const factor = 10 ** precision
    return Math.round(value * factor) / factor
}

/**
 * Default retry classifier.
 *
 * @param error Unknown error payload.
 * @returns `true` when retry should continue.
 */
function defaultShouldRetry(error: unknown): boolean {
    if (typeof error !== "object" || error === null) {
        return true
    }

    const retryable = (error as {readonly retryable?: unknown}).retryable
    if (typeof retryable === "boolean") {
        return retryable
    }

    return true
}

/**
 * Default sleep callback used by retry/backoff handling.
 *
 * @param durationMs Sleep duration in milliseconds.
 * @returns Promise resolved after timeout.
 */
function sleepFor(durationMs: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, durationMs)
    })
}

/**
 * Default metrics provider callback.
 *
 * @returns Empty metrics snapshot.
 */
function defaultMetricsProvider(): Promise<IAstServiceHorizontalScalingMetricsSnapshotInput> {
    return Promise.resolve({
        queueDepth: 0,
        repositories: [],
    })
}

/**
 * Resolves unknown error into stable message.
 *
 * @param error Unknown error payload.
 * @returns Stable message.
 */
function resolveUnknownErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message
    }

    return "Unknown error"
}
