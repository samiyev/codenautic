import {
    AST_MEMORY_PRESSURE_MANAGER_ERROR_CODE,
    AstMemoryPressureManagerError,
} from "./ast-memory-pressure-manager.error"

const DEFAULT_PAUSE_THRESHOLD_PERCENT = 85
const DEFAULT_RESUME_THRESHOLD_PERCENT = 85
const DEFAULT_MAX_ATTEMPTS = 3
const DEFAULT_INITIAL_BACKOFF_MS = 50
const DEFAULT_MAX_BACKOFF_MS = 1_000

/**
 * Runtime state for memory pressure manager.
 */
export const AST_MEMORY_PRESSURE_STATE = {
    NORMAL: "NORMAL",
    PAUSED: "PAUSED",
} as const

/**
 * Runtime state literal for memory pressure manager.
 */
export type AstMemoryPressureState =
    (typeof AST_MEMORY_PRESSURE_STATE)[keyof typeof AST_MEMORY_PRESSURE_STATE]

/**
 * Sleep function used by retry/backoff logic.
 */
export type AstMemoryPressureSleep = (durationMs: number) => Promise<void>

/**
 * Clock function used for deterministic timestamps.
 */
export type AstMemoryPressureNow = () => Date

/**
 * Retry decision callback for snapshot provider errors.
 */
export type AstMemoryPressureShouldRetry = (error: unknown, attempt: number) => boolean

/**
 * Raw memory usage sample.
 */
export interface IAstMemoryUsageSample {
    /**
     * Used memory bytes.
     */
    readonly usedBytes: number

    /**
     * Total available memory bytes.
     */
    readonly totalBytes: number

    /**
     * Optional stable idempotency sample key.
     */
    readonly sampleId?: string

    /**
     * Optional sample timestamp.
     */
    readonly sampledAt?: Date
}

/**
 * Snapshot provider contract.
 */
export type AstMemoryPressureSnapshotProvider = () => Promise<IAstMemoryUsageSample>

/**
 * Retry policy for snapshot provider calls.
 */
export interface IAstMemoryPressureRetryPolicy {
    /**
     * Maximum number of attempts including initial read.
     */
    readonly maxAttempts?: number

    /**
     * Initial retry backoff in milliseconds.
     */
    readonly initialBackoffMs?: number

    /**
     * Maximum retry backoff in milliseconds.
     */
    readonly maxBackoffMs?: number

    /**
     * Optional callback to classify retryable errors.
     */
    readonly shouldRetry?: AstMemoryPressureShouldRetry
}

/**
 * Runtime status snapshot of memory pressure manager.
 */
export interface IAstMemoryPressureManagerStatus {
    /**
     * Current state.
     */
    readonly state: AstMemoryPressureState

    /**
     * True when manager is in paused state.
     */
    readonly isPaused: boolean

    /**
     * Latest measured memory utilization in percent.
     */
    readonly utilizationPercent: number

    /**
     * Pause threshold in percent.
     */
    readonly pauseThresholdPercent: number

    /**
     * Resume threshold in percent.
     */
    readonly resumeThresholdPercent: number

    /**
     * Last state transition timestamp.
     */
    readonly lastTransitionAt: Date | null

    /**
     * Last sample timestamp.
     */
    readonly lastSampleAt: Date | null

    /**
     * Last accepted sample id.
     */
    readonly lastSampleId: string | null

    /**
     * Last provider failure message.
     */
    readonly lastFailure: string | null
}

/**
 * Runtime options for memory pressure manager service.
 */
export interface IAstMemoryPressureManagerServiceOptions {
    /**
     * Pause threshold in percent.
     */
    readonly pauseThresholdPercent?: number

    /**
     * Resume threshold in percent.
     */
    readonly resumeThresholdPercent?: number

    /**
     * Optional snapshot provider for read-and-evaluate flow.
     */
    readonly snapshotProvider?: AstMemoryPressureSnapshotProvider

    /**
     * Optional default retry policy for snapshot provider calls.
     */
    readonly retryPolicy?: IAstMemoryPressureRetryPolicy

    /**
     * Optional sleep override for retry/backoff.
     */
    readonly sleep?: AstMemoryPressureSleep

    /**
     * Optional clock override.
     */
    readonly now?: AstMemoryPressureNow
}

/**
 * Memory pressure manager contract.
 */
export interface IAstMemoryPressureManagerService {
    /**
     * Evaluates one memory sample and updates state transitions.
     *
     * @param sample Memory usage sample.
     * @returns Updated status snapshot.
     */
    evaluate(sample: IAstMemoryUsageSample): IAstMemoryPressureManagerStatus

    /**
     * Reads one sample from provider with retry/backoff and evaluates it.
     *
     * @returns Updated status snapshot.
     */
    readAndEvaluate(): Promise<IAstMemoryPressureManagerStatus>

    /**
     * Returns current status snapshot.
     *
     * @returns Current status.
     */
    getStatus(): IAstMemoryPressureManagerStatus
}

interface IAstMemoryPressureNormalizedRetryPolicy {
    readonly maxAttempts: number
    readonly initialBackoffMs: number
    readonly maxBackoffMs: number
    readonly shouldRetry: AstMemoryPressureShouldRetry
}

/**
 * Implements memory-pressure state transitions for AST worker infrastructure.
 */
export class AstMemoryPressureManagerService implements IAstMemoryPressureManagerService {
    private readonly pauseThresholdPercent: number
    private readonly resumeThresholdPercent: number
    private readonly snapshotProvider?: AstMemoryPressureSnapshotProvider
    private readonly retryPolicy: IAstMemoryPressureNormalizedRetryPolicy
    private readonly sleep: AstMemoryPressureSleep
    private readonly now: AstMemoryPressureNow
    private state: AstMemoryPressureState = AST_MEMORY_PRESSURE_STATE.NORMAL
    private utilizationPercent = 0
    private lastTransitionAt: Date | null = null
    private lastSampleAt: Date | null = null
    private lastSampleId: string | null = null
    private lastFailure: string | null = null

    /**
     * Creates memory pressure manager service.
     *
     * @param options Optional runtime configuration.
     */
    public constructor(options: IAstMemoryPressureManagerServiceOptions = {}) {
        this.pauseThresholdPercent = validateThresholdPercent(
            options.pauseThresholdPercent ?? DEFAULT_PAUSE_THRESHOLD_PERCENT,
            AST_MEMORY_PRESSURE_MANAGER_ERROR_CODE.INVALID_PAUSE_THRESHOLD_PERCENT,
        )
        this.resumeThresholdPercent = validateThresholdPercent(
            options.resumeThresholdPercent ?? DEFAULT_RESUME_THRESHOLD_PERCENT,
            AST_MEMORY_PRESSURE_MANAGER_ERROR_CODE.INVALID_RESUME_THRESHOLD_PERCENT,
        )

        validateThresholdRelationship(this.pauseThresholdPercent, this.resumeThresholdPercent)

        if (
            options.snapshotProvider !== undefined &&
            typeof options.snapshotProvider !== "function"
        ) {
            throw new AstMemoryPressureManagerError(
                AST_MEMORY_PRESSURE_MANAGER_ERROR_CODE.INVALID_SNAPSHOT_PROVIDER,
            )
        }

        this.snapshotProvider = options.snapshotProvider
        this.retryPolicy = normalizeRetryPolicy(options.retryPolicy)
        this.sleep = options.sleep ?? sleepFor
        this.now = options.now ?? (() => new Date())
    }

    /**
     * Evaluates one memory sample and updates state transitions.
     *
     * @param sample Memory usage sample.
     * @returns Updated status snapshot.
     */
    public evaluate(sample: IAstMemoryUsageSample): IAstMemoryPressureManagerStatus {
        const normalizedSample = normalizeMemoryUsageSample(sample, this.now)

        if (isDuplicateSample(normalizedSample.sampleId, this.lastSampleId)) {
            return this.getStatus()
        }

        this.lastFailure = null
        this.lastSampleAt = normalizedSample.sampledAt
        this.lastSampleId = normalizedSample.sampleId ?? null
        this.utilizationPercent = calculateUtilizationPercent(
            normalizedSample.usedBytes,
            normalizedSample.totalBytes,
        )
        this.updateStateTransition(this.utilizationPercent)

        return this.getStatus()
    }

    /**
     * Reads one sample from provider with retry/backoff and evaluates it.
     *
     * @returns Updated status snapshot.
     */
    public async readAndEvaluate(): Promise<IAstMemoryPressureManagerStatus> {
        const snapshotProvider = this.getSnapshotProvider()
        let attempt = 1

        while (attempt <= this.retryPolicy.maxAttempts) {
            try {
                const sample = await snapshotProvider()
                return this.evaluate(sample)
            } catch (error) {
                const shouldRetry =
                    attempt < this.retryPolicy.maxAttempts &&
                    this.retryPolicy.shouldRetry(error, attempt)

                if (shouldRetry === false) {
                    this.lastFailure = normalizeErrorReason(error)
                    throw new AstMemoryPressureManagerError(
                        AST_MEMORY_PRESSURE_MANAGER_ERROR_CODE.SNAPSHOT_PROVIDER_FAILED,
                        {
                            attempts: attempt,
                            reason: this.lastFailure,
                        },
                    )
                }

                await this.sleep(
                    computeBackoffDuration(
                        attempt,
                        this.retryPolicy.initialBackoffMs,
                        this.retryPolicy.maxBackoffMs,
                    ),
                )
                attempt += 1
            }
        }

        this.lastFailure = "Retry loop exhausted unexpectedly"
        throw new AstMemoryPressureManagerError(
            AST_MEMORY_PRESSURE_MANAGER_ERROR_CODE.SNAPSHOT_PROVIDER_FAILED,
            {
                attempts: this.retryPolicy.maxAttempts,
                reason: this.lastFailure,
            },
        )
    }

    /**
     * Returns current status snapshot.
     *
     * @returns Current status.
     */
    public getStatus(): IAstMemoryPressureManagerStatus {
        return {
            state: this.state,
            isPaused: this.state === AST_MEMORY_PRESSURE_STATE.PAUSED,
            utilizationPercent: this.utilizationPercent,
            pauseThresholdPercent: this.pauseThresholdPercent,
            resumeThresholdPercent: this.resumeThresholdPercent,
            lastTransitionAt: this.lastTransitionAt,
            lastSampleAt: this.lastSampleAt,
            lastSampleId: this.lastSampleId,
            lastFailure: this.lastFailure,
        }
    }

    /**
     * Applies pause/resume transitions using threshold rules.
     *
     * @param utilizationPercent Current utilization percent.
     */
    private updateStateTransition(utilizationPercent: number): void {
        if (
            this.state === AST_MEMORY_PRESSURE_STATE.NORMAL &&
            utilizationPercent >= this.pauseThresholdPercent
        ) {
            this.state = AST_MEMORY_PRESSURE_STATE.PAUSED
            this.lastTransitionAt = this.now()
            return
        }

        if (
            this.state === AST_MEMORY_PRESSURE_STATE.PAUSED &&
            utilizationPercent < this.resumeThresholdPercent
        ) {
            this.state = AST_MEMORY_PRESSURE_STATE.NORMAL
            this.lastTransitionAt = this.now()
        }
    }

    /**
     * Returns configured snapshot provider or throws when absent.
     *
     * @returns Snapshot provider.
     */
    private getSnapshotProvider(): AstMemoryPressureSnapshotProvider {
        if (this.snapshotProvider === undefined) {
            throw new AstMemoryPressureManagerError(
                AST_MEMORY_PRESSURE_MANAGER_ERROR_CODE.INVALID_SNAPSHOT_PROVIDER,
            )
        }

        return this.snapshotProvider
    }
}

/**
 * Validates one threshold percentage.
 *
 * @param value Raw threshold value.
 * @param code Error code used on validation failure.
 * @returns Validated threshold value.
 */
function validateThresholdPercent(
    value: number,
    code:
        | typeof AST_MEMORY_PRESSURE_MANAGER_ERROR_CODE.INVALID_PAUSE_THRESHOLD_PERCENT
        | typeof AST_MEMORY_PRESSURE_MANAGER_ERROR_CODE.INVALID_RESUME_THRESHOLD_PERCENT,
): number {
    if (Number.isFinite(value) === false || value < 0 || value > 100) {
        throw new AstMemoryPressureManagerError(code, {
            pauseThresholdPercent:
                code === AST_MEMORY_PRESSURE_MANAGER_ERROR_CODE.INVALID_PAUSE_THRESHOLD_PERCENT
                    ? value
                    : undefined,
            resumeThresholdPercent:
                code === AST_MEMORY_PRESSURE_MANAGER_ERROR_CODE.INVALID_RESUME_THRESHOLD_PERCENT
                    ? value
                    : undefined,
        })
    }

    return value
}

/**
 * Validates pause/resume threshold relationship.
 *
 * @param pauseThresholdPercent Pause threshold.
 * @param resumeThresholdPercent Resume threshold.
 */
function validateThresholdRelationship(
    pauseThresholdPercent: number,
    resumeThresholdPercent: number,
): void {
    if (resumeThresholdPercent > pauseThresholdPercent) {
        throw new AstMemoryPressureManagerError(
            AST_MEMORY_PRESSURE_MANAGER_ERROR_CODE.INVALID_RESUME_THRESHOLD_PERCENT,
            {
                pauseThresholdPercent,
                resumeThresholdPercent,
            },
        )
    }
}

/**
 * Normalizes memory sample and validates numeric values.
 *
 * @param sample Raw sample.
 * @param now Clock callback.
 * @returns Normalized sample.
 */
function normalizeMemoryUsageSample(
    sample: IAstMemoryUsageSample,
    now: AstMemoryPressureNow,
): Required<Pick<IAstMemoryUsageSample, "usedBytes" | "totalBytes" | "sampledAt">> &
    Pick<IAstMemoryUsageSample, "sampleId"> {
    validateUsedBytes(sample.usedBytes)
    validateTotalBytes(sample.totalBytes)

    if (sample.usedBytes > sample.totalBytes) {
        throw new AstMemoryPressureManagerError(
            AST_MEMORY_PRESSURE_MANAGER_ERROR_CODE.INVALID_USED_BYTES,
            {
                usedBytes: sample.usedBytes,
            },
        )
    }

    return {
        usedBytes: sample.usedBytes,
        totalBytes: sample.totalBytes,
        sampleId: normalizeSampleId(sample.sampleId),
        sampledAt: sample.sampledAt ?? now(),
    }
}

/**
 * Validates used-bytes value.
 *
 * @param usedBytes Raw used-bytes value.
 */
function validateUsedBytes(usedBytes: number): void {
    if (Number.isFinite(usedBytes) === false || usedBytes < 0) {
        throw new AstMemoryPressureManagerError(
            AST_MEMORY_PRESSURE_MANAGER_ERROR_CODE.INVALID_USED_BYTES,
            {
                usedBytes,
            },
        )
    }
}

/**
 * Validates total-bytes value.
 *
 * @param totalBytes Raw total-bytes value.
 */
function validateTotalBytes(totalBytes: number): void {
    if (Number.isFinite(totalBytes) === false || totalBytes <= 0) {
        throw new AstMemoryPressureManagerError(
            AST_MEMORY_PRESSURE_MANAGER_ERROR_CODE.INVALID_TOTAL_BYTES,
            {
                totalBytes,
            },
        )
    }
}

/**
 * Calculates utilization percent.
 *
 * @param usedBytes Used memory in bytes.
 * @param totalBytes Total memory in bytes.
 * @returns Utilization percent rounded to two decimals.
 */
function calculateUtilizationPercent(usedBytes: number, totalBytes: number): number {
    return Math.round((usedBytes / totalBytes) * 10_000) / 100
}

/**
 * Normalizes optional sample id.
 *
 * @param sampleId Raw sample id.
 * @returns Trimmed sample id or undefined.
 */
function normalizeSampleId(sampleId: string | undefined): string | undefined {
    if (sampleId === undefined) {
        return undefined
    }

    const normalized = sampleId.trim()
    return normalized.length > 0 ? normalized : undefined
}

/**
 * Checks whether current sample is duplicate by id.
 *
 * @param currentSampleId Current sample id.
 * @param previousSampleId Last accepted sample id.
 * @returns True when sample is duplicate.
 */
function isDuplicateSample(
    currentSampleId: string | undefined,
    previousSampleId: string | null,
): boolean {
    return currentSampleId !== undefined && currentSampleId === previousSampleId
}

/**
 * Normalizes retry policy with defaults.
 *
 * @param retryPolicy Optional retry policy.
 * @returns Normalized retry policy.
 */
function normalizeRetryPolicy(
    retryPolicy: IAstMemoryPressureRetryPolicy | undefined,
): IAstMemoryPressureNormalizedRetryPolicy {
    const maxAttempts = validateMaxAttempts(retryPolicy?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS)
    const initialBackoffMs = validateInitialBackoffMs(
        retryPolicy?.initialBackoffMs ?? DEFAULT_INITIAL_BACKOFF_MS,
    )
    const maxBackoffMs = validateMaxBackoffMs(retryPolicy?.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS)

    if (maxBackoffMs < initialBackoffMs) {
        throw new AstMemoryPressureManagerError(
            AST_MEMORY_PRESSURE_MANAGER_ERROR_CODE.INVALID_MAX_BACKOFF_MS,
            {
                maxBackoffMs,
            },
        )
    }

    return {
        maxAttempts,
        initialBackoffMs,
        maxBackoffMs,
        shouldRetry: retryPolicy?.shouldRetry ?? defaultShouldRetry,
    }
}

/**
 * Validates max-attempt value.
 *
 * @param maxAttempts Raw max-attempt value.
 * @returns Validated max-attempt value.
 */
function validateMaxAttempts(maxAttempts: number): number {
    if (Number.isSafeInteger(maxAttempts) === false || maxAttempts < 1) {
        throw new AstMemoryPressureManagerError(
            AST_MEMORY_PRESSURE_MANAGER_ERROR_CODE.INVALID_MAX_ATTEMPTS,
            {
                maxAttempts,
            },
        )
    }

    return maxAttempts
}

/**
 * Validates initial-backoff value.
 *
 * @param initialBackoffMs Raw initial-backoff value.
 * @returns Validated initial-backoff value.
 */
function validateInitialBackoffMs(initialBackoffMs: number): number {
    if (Number.isSafeInteger(initialBackoffMs) === false || initialBackoffMs < 0) {
        throw new AstMemoryPressureManagerError(
            AST_MEMORY_PRESSURE_MANAGER_ERROR_CODE.INVALID_INITIAL_BACKOFF_MS,
            {
                initialBackoffMs,
            },
        )
    }

    return initialBackoffMs
}

/**
 * Validates max-backoff value.
 *
 * @param maxBackoffMs Raw max-backoff value.
 * @returns Validated max-backoff value.
 */
function validateMaxBackoffMs(maxBackoffMs: number): number {
    if (Number.isSafeInteger(maxBackoffMs) === false || maxBackoffMs < 0) {
        throw new AstMemoryPressureManagerError(
            AST_MEMORY_PRESSURE_MANAGER_ERROR_CODE.INVALID_MAX_BACKOFF_MS,
            {
                maxBackoffMs,
            },
        )
    }

    return maxBackoffMs
}

/**
 * Computes exponential backoff duration.
 *
 * @param attempt Current attempt number.
 * @param initialBackoffMs Initial backoff value.
 * @param maxBackoffMs Max backoff value.
 * @returns Backoff duration in milliseconds.
 */
function computeBackoffDuration(
    attempt: number,
    initialBackoffMs: number,
    maxBackoffMs: number,
): number {
    const exponent = Math.max(0, attempt - 1)
    const scaledBackoff = initialBackoffMs * 2 ** exponent
    return Math.min(maxBackoffMs, scaledBackoff)
}

/**
 * Normalizes unknown error into stable reason text.
 *
 * @param error Unknown thrown value.
 * @returns Stable reason text.
 */
function normalizeErrorReason(error: unknown): string {
    if (error instanceof Error) {
        return error.message
    }

    if (typeof error === "string") {
        return error
    }

    return "Unknown error"
}

/**
 * Default retry classifier.
 *
 * @returns Always true.
 */
function defaultShouldRetry(): boolean {
    return true
}

/**
 * Sleeps for one duration in milliseconds.
 *
 * @param durationMs Duration in milliseconds.
 * @returns Promise resolved after delay.
 */
async function sleepFor(durationMs: number): Promise<void> {
    await new Promise<void>((resolve) => {
        setTimeout(resolve, durationMs)
    })
}
