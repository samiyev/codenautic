import {
    FilePath,
    type IFileBlame,
    type IGitBlame,
} from "@codenautic/core"

import {
    AST_OWNERSHIP_CALCULATOR_ERROR_CODE,
    AstOwnershipCalculatorError,
} from "./ast-ownership-calculator.error"

const DEFAULT_PRIMARY_OWNERSHIP_THRESHOLD = 0.5
const DEFAULT_SECONDARY_OWNERSHIP_THRESHOLD = 0.2
const DEFAULT_MAX_FETCH_ATTEMPTS = 2
const DEFAULT_RETRY_BACKOFF_MS = 25
const DEFAULT_CACHE_TTL_MS = 15000
const OWNERSHIP_RATIO_PRECISION = 6

interface INormalizedOwnershipCalculatorInput {
    readonly ref: string
    readonly filePaths: readonly string[]
}

interface INormalizedBlameRange {
    readonly contributorKey: string
    readonly authorName: string
    readonly authorEmail: string
    readonly lineCount: number
    readonly contributedAt: string
    readonly contributedAtMs: number
}

interface IOwnershipAccumulator {
    readonly contributorKey: string
    readonly authorName: string
    readonly authorEmail: string
    lineCount: number
    lastSeenAtMs: number
    lastSeenAt: string
}

interface IAstOwnershipCacheEntry {
    readonly expiresAt: number
    readonly value: IAstOwnershipCalculatorResult
}

/**
 * Batch git blame callback used by ownership calculator.
 */
export type AstOwnershipCalculatorFetchBlameBatch = (
    filePaths: readonly string[],
    ref: string,
) => Promise<readonly IFileBlame[]>

/**
 * Deterministic clock callback.
 */
export type AstOwnershipCalculatorNow = () => number

/**
 * Sleep callback for retry backoff.
 */
export type AstOwnershipCalculatorSleep = (milliseconds: number) => Promise<void>

/**
 * One contributor ownership share for one file.
 */
export interface IAstOwnershipShare {
    /**
     * Stable contributor key for deduplication across files.
     */
    readonly contributorKey: string

    /**
     * Contributor display name.
     */
    readonly authorName: string

    /**
     * Contributor email in lowercase when available.
     */
    readonly authorEmail: string

    /**
     * Number of owned lines in the file.
     */
    readonly lineCount: number

    /**
     * Ownership share in [0..1].
     */
    readonly ownershipRatio: number

    /**
     * Last blame timestamp associated with contributor in file.
     */
    readonly lastSeenAt: string
}

/**
 * Ownership metrics for one file.
 */
export interface IAstFileOwnership {
    /**
     * Repository-relative file path.
     */
    readonly filePath: string

    /**
     * Total lines covered by blame ranges for the file.
     */
    readonly totalLines: number

    /**
     * Number of unique contributors detected for file.
     */
    readonly ownerCount: number

    /**
     * Dominant file owner when available.
     */
    readonly primaryOwner: IAstOwnershipShare | null

    /**
     * Indicates whether primary owner meets configured dominance threshold.
     */
    readonly hasDominantPrimaryOwner: boolean

    /**
     * Secondary owners with ownership share above configured threshold.
     */
    readonly secondaryOwners: readonly IAstOwnershipShare[]

    /**
     * All owners sorted deterministically by ownership descending.
     */
    readonly owners: readonly IAstOwnershipShare[]
}

/**
 * Ownership calculation summary.
 */
export interface IAstOwnershipCalculatorSummary {
    /**
     * Total number of processed files.
     */
    readonly fileCount: number

    /**
     * Total blamed lines across all files.
     */
    readonly totalLines: number

    /**
     * Total unique contributors across all files.
     */
    readonly uniqueOwnerCount: number

    /**
     * Number of files with dominant primary owner.
     */
    readonly dominantPrimaryOwnerFileCount: number

    /**
     * Number of files with at least one secondary owner.
     */
    readonly filesWithSecondaryOwners: number

    /**
     * Average primary owner ratio across files where primary owner exists.
     */
    readonly averagePrimaryOwnershipRatio: number

    /**
     * Configured dominant-primary threshold.
     */
    readonly primaryOwnershipThreshold: number

    /**
     * Configured secondary-owner threshold.
     */
    readonly secondaryOwnershipThreshold: number

    /**
     * ISO timestamp when summary was generated.
     */
    readonly generatedAt: string
}

/**
 * Ownership calculator output payload.
 */
export interface IAstOwnershipCalculatorResult {
    /**
     * File-level ownership metrics in deterministic order.
     */
    readonly items: readonly IAstFileOwnership[]

    /**
     * Aggregated ownership summary.
     */
    readonly summary: IAstOwnershipCalculatorSummary
}

/**
 * Ownership calculator input payload.
 */
export interface IAstOwnershipCalculatorInput {
    /**
     * Git reference used to resolve blame data.
     */
    readonly ref: string

    /**
     * Repository-relative file paths.
     */
    readonly filePaths: readonly string[]
}

/**
 * Runtime options for ownership calculator.
 */
export interface IAstOwnershipCalculatorServiceOptions {
    /**
     * Explicit blame batch callback override.
     */
    readonly fetchBlameBatch?: AstOwnershipCalculatorFetchBlameBatch

    /**
     * Optional git blame port adapter.
     */
    readonly gitBlame?: IGitBlame

    /**
     * Primary ownership threshold in [0..1].
     */
    readonly primaryOwnershipThreshold?: number

    /**
     * Secondary ownership threshold in [0..1].
     */
    readonly secondaryOwnershipThreshold?: number

    /**
     * Maximum blame fetch attempts for transient failures.
     */
    readonly maxFetchAttempts?: number

    /**
     * Retry backoff in milliseconds between failed attempts.
     */
    readonly retryBackoffMs?: number

    /**
     * Cache TTL in milliseconds for idempotent repeated requests.
     */
    readonly cacheTtlMs?: number

    /**
     * Optional deterministic clock callback.
     */
    readonly now?: AstOwnershipCalculatorNow

    /**
     * Optional sleep callback used by retry logic.
     */
    readonly sleep?: AstOwnershipCalculatorSleep
}

/**
 * Ownership calculator contract.
 */
export interface IAstOwnershipCalculatorService {
    /**
     * Calculates file ownership from git blame ranges.
     *
     * @param input Ownership calculation input.
     * @returns Ownership metrics per file with summary.
     */
    calculate(input: IAstOwnershipCalculatorInput): Promise<IAstOwnershipCalculatorResult>
}

/**
 * Calculates deterministic file ownership metrics from git blame payloads.
 */
export class AstOwnershipCalculatorService implements IAstOwnershipCalculatorService {
    private readonly fetchBlameBatch: AstOwnershipCalculatorFetchBlameBatch
    private readonly primaryOwnershipThreshold: number
    private readonly secondaryOwnershipThreshold: number
    private readonly maxFetchAttempts: number
    private readonly retryBackoffMs: number
    private readonly cacheTtlMs: number
    private readonly now: AstOwnershipCalculatorNow
    private readonly sleep: AstOwnershipCalculatorSleep
    private readonly inFlight = new Map<string, Promise<IAstOwnershipCalculatorResult>>()
    private readonly cache = new Map<string, IAstOwnershipCacheEntry>()

    /**
     * Creates AST ownership calculator service.
     *
     * @param options Optional runtime overrides.
     */
    public constructor(options: IAstOwnershipCalculatorServiceOptions = {}) {
        const fallbackFetch = resolveFetchBlameBatch(options.gitBlame)

        this.fetchBlameBatch = validateFetchBlameBatch(
            options.fetchBlameBatch ?? fallbackFetch,
        )
        this.primaryOwnershipThreshold = validateThreshold(
            options.primaryOwnershipThreshold ?? DEFAULT_PRIMARY_OWNERSHIP_THRESHOLD,
            AST_OWNERSHIP_CALCULATOR_ERROR_CODE.INVALID_PRIMARY_THRESHOLD,
        )
        this.secondaryOwnershipThreshold = validateThreshold(
            options.secondaryOwnershipThreshold ?? DEFAULT_SECONDARY_OWNERSHIP_THRESHOLD,
            AST_OWNERSHIP_CALCULATOR_ERROR_CODE.INVALID_SECONDARY_THRESHOLD,
        )
        validateThresholdRelation(
            this.primaryOwnershipThreshold,
            this.secondaryOwnershipThreshold,
        )

        this.maxFetchAttempts = validatePositiveInteger(
            options.maxFetchAttempts ?? DEFAULT_MAX_FETCH_ATTEMPTS,
            AST_OWNERSHIP_CALCULATOR_ERROR_CODE.INVALID_MAX_FETCH_ATTEMPTS,
        )
        this.retryBackoffMs = validateNonNegativeInteger(
            options.retryBackoffMs ?? DEFAULT_RETRY_BACKOFF_MS,
            AST_OWNERSHIP_CALCULATOR_ERROR_CODE.INVALID_RETRY_BACKOFF_MS,
        )
        this.cacheTtlMs = validateNonNegativeInteger(
            options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS,
            AST_OWNERSHIP_CALCULATOR_ERROR_CODE.INVALID_CACHE_TTL_MS,
        )
        this.now = options.now ?? Date.now
        this.sleep = validateSleep(options.sleep ?? defaultSleep)
    }

    /**
     * Calculates deterministic ownership for requested files.
     *
     * @param input Ownership calculator input payload.
     * @returns Deterministic ownership result.
     */
    public async calculate(
        input: IAstOwnershipCalculatorInput,
    ): Promise<IAstOwnershipCalculatorResult> {
        const normalizedInput = normalizeInput(input)
        const requestKey = createRequestKey(normalizedInput)
        const now = this.now()
        this.pruneExpiredCache(now)

        const cached = this.cache.get(requestKey)
        if (cached !== undefined && cached.expiresAt > now) {
            return cloneOwnershipResult(cached.value)
        }

        const inFlight = this.inFlight.get(requestKey)
        if (inFlight !== undefined) {
            return inFlight
        }

        const operation = this.calculateFresh(normalizedInput, requestKey)
        this.inFlight.set(requestKey, operation)

        try {
            return await operation
        } finally {
            this.inFlight.delete(requestKey)
        }
    }

    /**
     * Calculates ownership without using memoized cache.
     *
     * @param input Normalized ownership input.
     * @param requestKey Stable cache key for normalized input.
     * @returns Ownership result.
     */
    private async calculateFresh(
        input: INormalizedOwnershipCalculatorInput,
        requestKey: string,
    ): Promise<IAstOwnershipCalculatorResult> {
        const blameBatch = await this.fetchBlameBatchWithRetry(input.filePaths, input.ref)
        const normalizedBlameByFile = normalizeBlameBatch(
            blameBatch,
            input.filePaths,
            input.ref,
        )
        const items = input.filePaths.map((filePath): IAstFileOwnership => {
            const normalizedRanges = normalizedBlameByFile.get(filePath) ?? []
            return buildFileOwnership(
                filePath,
                normalizedRanges,
                this.primaryOwnershipThreshold,
                this.secondaryOwnershipThreshold,
            )
        })

        const result = {
            items,
            summary: buildSummary(
                items,
                this.primaryOwnershipThreshold,
                this.secondaryOwnershipThreshold,
                this.now(),
            ),
        }
        const clonedResult = cloneOwnershipResult(result)

        this.cache.set(requestKey, {
            value: clonedResult,
            expiresAt: this.now() + this.cacheTtlMs,
        })

        return cloneOwnershipResult(clonedResult)
    }

    /**
     * Loads blame batch using bounded retries and fixed backoff.
     *
     * @param filePaths Deterministic normalized file paths.
     * @param ref Normalized git ref.
     * @returns Blame payload returned by external adapter.
     */
    private async fetchBlameBatchWithRetry(
        filePaths: readonly string[],
        ref: string,
    ): Promise<readonly IFileBlame[]> {
        let attempt = 0
        let lastError: unknown = undefined

        while (attempt < this.maxFetchAttempts) {
            attempt += 1

            try {
                return await this.fetchBlameBatch(filePaths, ref)
            } catch (error) {
                lastError = error
            }

            if (attempt < this.maxFetchAttempts && this.retryBackoffMs > 0) {
                await this.sleepOrThrow(this.retryBackoffMs, ref, attempt, lastError)
            }
        }

        if (this.maxFetchAttempts === 1) {
            throw new AstOwnershipCalculatorError(
                AST_OWNERSHIP_CALCULATOR_ERROR_CODE.BLAME_FETCH_FAILED,
                {
                    ref,
                    attempt,
                    maxFetchAttempts: this.maxFetchAttempts,
                    causeMessage: resolveUnknownErrorMessage(lastError),
                },
            )
        }

        throw new AstOwnershipCalculatorError(
            AST_OWNERSHIP_CALCULATOR_ERROR_CODE.RETRY_EXHAUSTED,
            {
                ref,
                attempt,
                maxFetchAttempts: this.maxFetchAttempts,
                causeMessage: resolveUnknownErrorMessage(lastError),
            },
        )
    }

    /**
     * Sleeps between retry attempts with typed error wrapping.
     *
     * @param milliseconds Backoff duration in milliseconds.
     * @param ref Git reference for diagnostics.
     * @param attempt Current failed attempt number.
     * @param error Last fetch error payload.
     * @returns Promise resolved after sleep.
     */
    private async sleepOrThrow(
        milliseconds: number,
        ref: string,
        attempt: number,
        error: unknown,
    ): Promise<void> {
        try {
            await this.sleep(milliseconds)
        } catch (sleepError) {
            throw new AstOwnershipCalculatorError(
                AST_OWNERSHIP_CALCULATOR_ERROR_CODE.BLAME_FETCH_FAILED,
                {
                    ref,
                    attempt,
                    maxFetchAttempts: this.maxFetchAttempts,
                    causeMessage: resolveUnknownErrorMessage(sleepError ?? error),
                },
            )
        }
    }

    /**
     * Removes expired cache entries.
     *
     * @param now Current timestamp in milliseconds.
     */
    private pruneExpiredCache(now: number): void {
        for (const [key, entry] of this.cache.entries()) {
            if (entry.expiresAt <= now) {
                this.cache.delete(key)
            }
        }
    }
}

/**
 * Resolves fetch callback from git blame port when available.
 *
 * @param gitBlame Optional git blame port.
 * @returns Fetch callback or undefined.
 */
function resolveFetchBlameBatch(
    gitBlame: IGitBlame | undefined,
): AstOwnershipCalculatorFetchBlameBatch | undefined {
    if (gitBlame === undefined) {
        return undefined
    }

    return (filePaths, ref) => gitBlame.getBlameDataBatch(filePaths, ref)
}

/**
 * Validates ownership input payload and normalizes deterministic order.
 *
 * @param input Raw ownership input payload.
 * @returns Normalized ownership input.
 */
function normalizeInput(
    input: IAstOwnershipCalculatorInput,
): INormalizedOwnershipCalculatorInput {
    return {
        ref: normalizeRef(input.ref),
        filePaths: normalizeFilePaths(input.filePaths),
    }
}

/**
 * Normalizes git reference string.
 *
 * @param ref Raw git reference.
 * @returns Trimmed non-empty git reference.
 */
function normalizeRef(ref: string): string {
    const normalizedRef = ref.trim()
    if (normalizedRef.length > 0) {
        return normalizedRef
    }

    throw new AstOwnershipCalculatorError(
        AST_OWNERSHIP_CALCULATOR_ERROR_CODE.INVALID_REF,
        {ref},
    )
}

/**
 * Normalizes file paths and ensures deterministic unique order.
 *
 * @param filePaths Raw input file paths.
 * @returns Sorted unique normalized file paths.
 */
function normalizeFilePaths(filePaths: readonly string[]): readonly string[] {
    if (filePaths.length === 0) {
        throw new AstOwnershipCalculatorError(
            AST_OWNERSHIP_CALCULATOR_ERROR_CODE.EMPTY_FILE_PATHS,
        )
    }

    const normalizedPaths = new Set<string>()
    for (const filePath of filePaths) {
        const normalizedPath = normalizeFilePath(filePath)
        if (normalizedPaths.has(normalizedPath)) {
            throw new AstOwnershipCalculatorError(
                AST_OWNERSHIP_CALCULATOR_ERROR_CODE.DUPLICATE_FILE_PATH,
                {filePath: normalizedPath},
            )
        }

        normalizedPaths.add(normalizedPath)
    }

    return [...normalizedPaths].sort((left, right) => left.localeCompare(right))
}

/**
 * Normalizes one repository-relative file path.
 *
 * @param filePath Raw file path.
 * @returns Normalized file path.
 */
function normalizeFilePath(filePath: string): string {
    try {
        return FilePath.create(filePath).toString()
    } catch {
        throw new AstOwnershipCalculatorError(
            AST_OWNERSHIP_CALCULATOR_ERROR_CODE.INVALID_FILE_PATH,
            {filePath},
        )
    }
}

/**
 * Validates primary and secondary threshold relation.
 *
 * @param primaryThreshold Primary ownership threshold.
 * @param secondaryThreshold Secondary ownership threshold.
 */
function validateThresholdRelation(
    primaryThreshold: number,
    secondaryThreshold: number,
): void {
    if (secondaryThreshold <= primaryThreshold) {
        return
    }

    throw new AstOwnershipCalculatorError(
        AST_OWNERSHIP_CALCULATOR_ERROR_CODE.INVALID_THRESHOLD_RELATION,
        {
            primaryThreshold,
            secondaryThreshold,
        },
    )
}

/**
 * Validates threshold value in [0..1].
 *
 * @param threshold Raw threshold value.
 * @param code Typed error code to throw on invalid value.
 * @returns Valid threshold value.
 */
function validateThreshold(
    threshold: number,
    code:
        | typeof AST_OWNERSHIP_CALCULATOR_ERROR_CODE.INVALID_PRIMARY_THRESHOLD
        | typeof AST_OWNERSHIP_CALCULATOR_ERROR_CODE.INVALID_SECONDARY_THRESHOLD,
): number {
    if (Number.isFinite(threshold) && threshold >= 0 && threshold <= 1) {
        return threshold
    }

    if (code === AST_OWNERSHIP_CALCULATOR_ERROR_CODE.INVALID_PRIMARY_THRESHOLD) {
        throw new AstOwnershipCalculatorError(code, {
            primaryThreshold: threshold,
        })
    }

    throw new AstOwnershipCalculatorError(code, {
        secondaryThreshold: threshold,
    })
}

/**
 * Validates positive integer option value.
 *
 * @param value Raw value.
 * @param code Typed error code for invalid value.
 * @returns Valid positive integer.
 */
function validatePositiveInteger(
    value: number,
    code: typeof AST_OWNERSHIP_CALCULATOR_ERROR_CODE.INVALID_MAX_FETCH_ATTEMPTS,
): number {
    if (Number.isSafeInteger(value) && value > 0) {
        return value
    }

    throw new AstOwnershipCalculatorError(code, {
        maxFetchAttempts: value,
    })
}

/**
 * Validates non-negative integer option value.
 *
 * @param value Raw option value.
 * @param code Typed error code for invalid value.
 * @returns Valid non-negative integer.
 */
function validateNonNegativeInteger(
    value: number,
    code:
        | typeof AST_OWNERSHIP_CALCULATOR_ERROR_CODE.INVALID_RETRY_BACKOFF_MS
        | typeof AST_OWNERSHIP_CALCULATOR_ERROR_CODE.INVALID_CACHE_TTL_MS,
): number {
    if (Number.isSafeInteger(value) && value >= 0) {
        return value
    }

    if (code === AST_OWNERSHIP_CALCULATOR_ERROR_CODE.INVALID_RETRY_BACKOFF_MS) {
        throw new AstOwnershipCalculatorError(code, {
            retryBackoffMs: value,
        })
    }

    throw new AstOwnershipCalculatorError(code, {
        cacheTtlMs: value,
    })
}

/**
 * Validates blame fetch callback.
 *
 * @param fetchBlameBatch Candidate callback.
 * @returns Valid blame fetch callback.
 */
function validateFetchBlameBatch(
    fetchBlameBatch: AstOwnershipCalculatorFetchBlameBatch | undefined,
): AstOwnershipCalculatorFetchBlameBatch {
    if (typeof fetchBlameBatch === "function") {
        return fetchBlameBatch
    }

    throw new AstOwnershipCalculatorError(
        AST_OWNERSHIP_CALCULATOR_ERROR_CODE.INVALID_FETCH_BLAME_BATCH,
    )
}

/**
 * Validates sleep callback.
 *
 * @param sleep Candidate sleep callback.
 * @returns Valid sleep callback.
 */
function validateSleep(
    sleep: AstOwnershipCalculatorSleep,
): AstOwnershipCalculatorSleep {
    if (typeof sleep === "function") {
        return sleep
    }

    throw new AstOwnershipCalculatorError(
        AST_OWNERSHIP_CALCULATOR_ERROR_CODE.INVALID_SLEEP,
    )
}

/**
 * Creates stable cache key from normalized request.
 *
 * @param input Normalized ownership input.
 * @returns Stable deterministic cache key.
 */
function createRequestKey(input: INormalizedOwnershipCalculatorInput): string {
    return `${input.ref}::${input.filePaths.join("|")}`
}

/**
 * Validates and normalizes blame batch payload.
 *
 * @param blameBatch Raw blame batch payload.
 * @param requestedFilePaths Requested normalized file paths.
 * @param ref Normalized git ref.
 * @returns Normalized blame ranges grouped by file path.
 */
function normalizeBlameBatch(
    blameBatch: unknown,
    requestedFilePaths: readonly string[],
    ref: string,
): ReadonlyMap<string, readonly INormalizedBlameRange[]> {
    if (!Array.isArray(blameBatch)) {
        throw new AstOwnershipCalculatorError(
            AST_OWNERSHIP_CALCULATOR_ERROR_CODE.INVALID_BLAME_BATCH_PAYLOAD,
            {ref},
        )
    }

    const requestedSet = new Set<string>(requestedFilePaths)
    const normalizedMap = new Map<string, readonly INormalizedBlameRange[]>()

    for (const rawFileBlame of blameBatch) {
        const fileBlame = normalizeBlamePayloadEntry(rawFileBlame, requestedSet)
        const filePath = fileBlame.filePath
        if (normalizedMap.has(filePath)) {
            throw new AstOwnershipCalculatorError(
                AST_OWNERSHIP_CALCULATOR_ERROR_CODE.DUPLICATE_BLAME_FILE_PATH,
                {
                    ref,
                    filePath,
                },
            )
        }

        normalizedMap.set(filePath, fileBlame.ranges)
    }

    for (const requestedFilePath of requestedFilePaths) {
        if (!normalizedMap.has(requestedFilePath)) {
            normalizedMap.set(requestedFilePath, [])
        }
    }

    return normalizedMap
}

/**
 * Validates and normalizes one file-level blame payload entry.
 *
 * @param payloadEntry Raw file-level blame payload entry.
 * @param requestedSet Requested file path set.
 * @returns Normalized file-level blame payload entry.
 */
function normalizeBlamePayloadEntry(
    payloadEntry: unknown,
    requestedSet: ReadonlySet<string>,
): {
    readonly filePath: string
    readonly ranges: readonly INormalizedBlameRange[]
} {
    if (!isObjectRecord(payloadEntry)) {
        throw new AstOwnershipCalculatorError(
            AST_OWNERSHIP_CALCULATOR_ERROR_CODE.INVALID_BLAME_BATCH_PAYLOAD,
        )
    }

    const filePath = normalizeBlameFilePath(payloadEntry.filePath, requestedSet)
    const ranges = normalizeBlameRanges(payloadEntry.blame, filePath)

    return {
        filePath,
        ranges,
    }
}

/**
 * Validates and normalizes one blame file path.
 *
 * @param filePath Raw blame file path.
 * @param requestedSet Requested file path set.
 * @returns Normalized file path.
 */
function normalizeBlameFilePath(
    filePath: unknown,
    requestedSet: ReadonlySet<string>,
): string {
    if (typeof filePath !== "string") {
        throw new AstOwnershipCalculatorError(
            AST_OWNERSHIP_CALCULATOR_ERROR_CODE.INVALID_BLAME_BATCH_PAYLOAD,
        )
    }

    const normalizedFilePath = normalizeFilePath(filePath)
    if (requestedSet.has(normalizedFilePath)) {
        return normalizedFilePath
    }

    throw new AstOwnershipCalculatorError(
        AST_OWNERSHIP_CALCULATOR_ERROR_CODE.INVALID_BLAME_FILE_PATH,
        {filePath: normalizedFilePath},
    )
}

/**
 * Validates and normalizes blame ranges for one file path.
 *
 * @param blameRanges Raw blame ranges.
 * @param filePath Normalized file path.
 * @returns Normalized blame ranges.
 */
function normalizeBlameRanges(
    blameRanges: unknown,
    filePath: string,
): readonly INormalizedBlameRange[] {
    if (!Array.isArray(blameRanges)) {
        throw new AstOwnershipCalculatorError(
            AST_OWNERSHIP_CALCULATOR_ERROR_CODE.INVALID_BLAME_BATCH_PAYLOAD,
            {filePath},
        )
    }

    return blameRanges.map((range): INormalizedBlameRange => {
        const lineStart = normalizePositiveIntegerProperty(range, "lineStart", filePath)
        const lineEnd = normalizePositiveIntegerProperty(range, "lineEnd", filePath)
        if (lineEnd < lineStart) {
            throw new AstOwnershipCalculatorError(
                AST_OWNERSHIP_CALCULATOR_ERROR_CODE.INVALID_BLAME_ENTRY,
                {filePath},
            )
        }

        const lineCount = lineEnd - lineStart + 1
        const authorName = normalizeOptionalStringProperty(range, "authorName")
        const authorEmail = normalizeOptionalStringProperty(range, "authorEmail").toLowerCase()
        const contributorKey = resolveContributorKey(authorName, authorEmail, filePath)
        const contributedAtMs = Date.parse(
            normalizeRequiredStringProperty(range, "date", filePath),
        )

        if (Number.isNaN(contributedAtMs)) {
            throw new AstOwnershipCalculatorError(
                AST_OWNERSHIP_CALCULATOR_ERROR_CODE.INVALID_BLAME_ENTRY,
                {filePath},
            )
        }

        return {
            contributorKey,
            authorName: authorName.length > 0 ? authorName : authorEmail,
            authorEmail,
            lineCount,
            contributedAt: new Date(contributedAtMs).toISOString(),
            contributedAtMs,
        }
    })
}

/**
 * Normalizes required positive integer property from blame entry.
 *
 * @param value Raw blame range payload.
 * @param property Property name.
 * @param filePath File path for diagnostics.
 * @returns Normalized positive integer property value.
 */
function normalizePositiveIntegerProperty(
    value: unknown,
    property: "lineStart" | "lineEnd",
    filePath: string,
): number {
    if (!isObjectRecord(value)) {
        throw new AstOwnershipCalculatorError(
            AST_OWNERSHIP_CALCULATOR_ERROR_CODE.INVALID_BLAME_ENTRY,
            {filePath},
        )
    }

    const rawValue = value[property]
    if (typeof rawValue === "number" && Number.isSafeInteger(rawValue) && rawValue > 0) {
        return rawValue
    }

    throw new AstOwnershipCalculatorError(
        AST_OWNERSHIP_CALCULATOR_ERROR_CODE.INVALID_BLAME_ENTRY,
        {filePath},
    )
}

/**
 * Normalizes required string property from blame entry.
 *
 * @param value Raw blame entry payload.
 * @param property Property name.
 * @param filePath File path for diagnostics.
 * @returns Trimmed non-empty string property value.
 */
function normalizeRequiredStringProperty(
    value: unknown,
    property: "date",
    filePath: string,
): string {
    const normalizedValue = normalizeOptionalStringProperty(value, property)
    if (normalizedValue.length > 0) {
        return normalizedValue
    }

    throw new AstOwnershipCalculatorError(
        AST_OWNERSHIP_CALCULATOR_ERROR_CODE.INVALID_BLAME_ENTRY,
        {filePath},
    )
}

/**
 * Normalizes optional string property from blame entry payload.
 *
 * @param value Raw blame entry payload.
 * @param property Property name.
 * @returns Trimmed string or empty string when absent.
 */
function normalizeOptionalStringProperty(
    value: unknown,
    property: "authorName" | "authorEmail" | "date",
): string {
    if (!isObjectRecord(value)) {
        return ""
    }

    const rawValue = value[property]
    if (typeof rawValue === "string") {
        return rawValue.trim()
    }

    return ""
}

/**
 * Checks whether unknown payload is a plain object record.
 *
 * @param value Unknown payload.
 * @returns True when payload is object record.
 */
function isObjectRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null
}

/**
 * Resolves stable contributor key from author fields.
 *
 * @param authorName Normalized author name.
 * @param authorEmail Normalized author email.
 * @param filePath File path for diagnostics.
 * @returns Stable contributor key.
 */
function resolveContributorKey(
    authorName: string,
    authorEmail: string,
    filePath: string,
): string {
    if (authorEmail.length > 0) {
        return `email:${authorEmail}`
    }

    if (authorName.length > 0) {
        return `name:${authorName.toLowerCase()}`
    }

    throw new AstOwnershipCalculatorError(
        AST_OWNERSHIP_CALCULATOR_ERROR_CODE.INVALID_BLAME_ENTRY,
        {filePath},
    )
}

/**
 * Builds file-level ownership payload from normalized blame ranges.
 *
 * @param filePath File path.
 * @param ranges Normalized blame ranges.
 * @param primaryThreshold Primary ownership threshold.
 * @param secondaryThreshold Secondary ownership threshold.
 * @returns File-level ownership payload.
 */
function buildFileOwnership(
    filePath: string,
    ranges: readonly INormalizedBlameRange[],
    primaryThreshold: number,
    secondaryThreshold: number,
): IAstFileOwnership {
    const accumulators = new Map<string, IOwnershipAccumulator>()
    let totalLines = 0

    for (const range of ranges) {
        totalLines += range.lineCount
        const existing = accumulators.get(range.contributorKey)
        if (existing === undefined) {
            accumulators.set(range.contributorKey, {
                contributorKey: range.contributorKey,
                authorName: range.authorName,
                authorEmail: range.authorEmail,
                lineCount: range.lineCount,
                lastSeenAtMs: range.contributedAtMs,
                lastSeenAt: range.contributedAt,
            })
            continue
        }

        existing.lineCount += range.lineCount
        if (range.contributedAtMs > existing.lastSeenAtMs) {
            existing.lastSeenAtMs = range.contributedAtMs
            existing.lastSeenAt = range.contributedAt
        }
    }

    const owners = buildOwnershipShares(accumulators, totalLines)
    const primaryOwner = owners[0] ?? null
    const hasDominantPrimaryOwner =
        primaryOwner !== null && primaryOwner.ownershipRatio >= primaryThreshold
    const secondaryOwners = owners.filter((owner, index) => {
        return index > 0 && owner.ownershipRatio >= secondaryThreshold
    })

    return {
        filePath,
        totalLines,
        ownerCount: owners.length,
        primaryOwner,
        hasDominantPrimaryOwner,
        secondaryOwners,
        owners,
    }
}

/**
 * Converts ownership accumulators into deterministic ownership shares.
 *
 * @param accumulators Contributor ownership accumulators.
 * @param totalLines Total file line count.
 * @returns Sorted ownership shares.
 */
function buildOwnershipShares(
    accumulators: ReadonlyMap<string, IOwnershipAccumulator>,
    totalLines: number,
): readonly IAstOwnershipShare[] {
    if (totalLines === 0) {
        return []
    }

    const shares = [...accumulators.values()]
        .map((item): IAstOwnershipShare => {
            const ownershipRatio = roundOwnershipRatio(item.lineCount / totalLines)
            return {
                contributorKey: item.contributorKey,
                authorName: item.authorName,
                authorEmail: item.authorEmail,
                lineCount: item.lineCount,
                ownershipRatio,
                lastSeenAt: item.lastSeenAt,
            }
        })
        .sort(compareOwnershipShares)

    return shares
}

/**
 * Compares ownership shares deterministically.
 *
 * @param left Left ownership share.
 * @param right Right ownership share.
 * @returns Negative when left should go first.
 */
function compareOwnershipShares(
    left: IAstOwnershipShare,
    right: IAstOwnershipShare,
): number {
    if (left.lineCount !== right.lineCount) {
        return right.lineCount - left.lineCount
    }

    if (left.authorEmail !== right.authorEmail) {
        return left.authorEmail.localeCompare(right.authorEmail)
    }

    if (left.authorName !== right.authorName) {
        return left.authorName.localeCompare(right.authorName)
    }

    return left.contributorKey.localeCompare(right.contributorKey)
}

/**
 * Builds ownership summary from file-level items.
 *
 * @param items File-level ownership items.
 * @param primaryThreshold Primary threshold.
 * @param secondaryThreshold Secondary threshold.
 * @param now Current timestamp in milliseconds.
 * @returns Ownership summary.
 */
function buildSummary(
    items: readonly IAstFileOwnership[],
    primaryThreshold: number,
    secondaryThreshold: number,
    now: number,
): IAstOwnershipCalculatorSummary {
    const uniqueOwners = new Set<string>()
    let totalLines = 0
    let filesWithSecondaryOwners = 0
    let dominantPrimaryOwnerFileCount = 0
    let primaryOwnershipRatioSum = 0
    let filesWithPrimaryOwner = 0

    for (const item of items) {
        totalLines += item.totalLines
        if (item.secondaryOwners.length > 0) {
            filesWithSecondaryOwners += 1
        }
        if (item.hasDominantPrimaryOwner) {
            dominantPrimaryOwnerFileCount += 1
        }
        if (item.primaryOwner !== null) {
            filesWithPrimaryOwner += 1
            primaryOwnershipRatioSum += item.primaryOwner.ownershipRatio
        }

        for (const owner of item.owners) {
            uniqueOwners.add(owner.contributorKey)
        }
    }

    return {
        fileCount: items.length,
        totalLines,
        uniqueOwnerCount: uniqueOwners.size,
        dominantPrimaryOwnerFileCount,
        filesWithSecondaryOwners,
        averagePrimaryOwnershipRatio:
            filesWithPrimaryOwner > 0
                ? roundOwnershipRatio(primaryOwnershipRatioSum / filesWithPrimaryOwner)
                : 0,
        primaryOwnershipThreshold: primaryThreshold,
        secondaryOwnershipThreshold: secondaryThreshold,
        generatedAt: new Date(now).toISOString(),
    }
}

/**
 * Rounds ownership ratio to stable precision.
 *
 * @param ratio Raw ownership ratio.
 * @returns Rounded ownership ratio.
 */
function roundOwnershipRatio(ratio: number): number {
    return Number(ratio.toFixed(OWNERSHIP_RATIO_PRECISION))
}

/**
 * Clones ownership result for safe cache reads.
 *
 * @param result Ownership result to clone.
 * @returns Deep clone of ownership result.
 */
function cloneOwnershipResult(
    result: IAstOwnershipCalculatorResult,
): IAstOwnershipCalculatorResult {
    return {
        items: result.items.map((item): IAstFileOwnership => {
            return {
                filePath: item.filePath,
                totalLines: item.totalLines,
                ownerCount: item.ownerCount,
                primaryOwner: item.primaryOwner === null ? null : cloneOwnershipShare(item.primaryOwner),
                hasDominantPrimaryOwner: item.hasDominantPrimaryOwner,
                secondaryOwners: item.secondaryOwners.map((owner) => cloneOwnershipShare(owner)),
                owners: item.owners.map((owner) => cloneOwnershipShare(owner)),
            }
        }),
        summary: {
            fileCount: result.summary.fileCount,
            totalLines: result.summary.totalLines,
            uniqueOwnerCount: result.summary.uniqueOwnerCount,
            dominantPrimaryOwnerFileCount: result.summary.dominantPrimaryOwnerFileCount,
            filesWithSecondaryOwners: result.summary.filesWithSecondaryOwners,
            averagePrimaryOwnershipRatio: result.summary.averagePrimaryOwnershipRatio,
            primaryOwnershipThreshold: result.summary.primaryOwnershipThreshold,
            secondaryOwnershipThreshold: result.summary.secondaryOwnershipThreshold,
            generatedAt: result.summary.generatedAt,
        },
    }
}

/**
 * Clones one ownership share object.
 *
 * @param share Ownership share to clone.
 * @returns Ownership share clone.
 */
function cloneOwnershipShare(share: IAstOwnershipShare): IAstOwnershipShare {
    return {
        contributorKey: share.contributorKey,
        authorName: share.authorName,
        authorEmail: share.authorEmail,
        lineCount: share.lineCount,
        ownershipRatio: share.ownershipRatio,
        lastSeenAt: share.lastSeenAt,
    }
}

/**
 * Default retry sleep implementation.
 *
 * @param milliseconds Sleep duration.
 * @returns Promise resolved after duration.
 */
async function defaultSleep(milliseconds: number): Promise<void> {
    await new Promise<void>((resolve) => {
        setTimeout(resolve, milliseconds)
    })
}

/**
 * Resolves unknown error payload to stable message.
 *
 * @param error Unknown error payload.
 * @returns Stable error message.
 */
function resolveUnknownErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message
    }

    return "Unknown error"
}
