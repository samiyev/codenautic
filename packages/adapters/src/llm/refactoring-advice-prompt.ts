import {
    REFACTORING_ADVICE_PROMPT_ERROR_CODE,
    RefactoringAdvicePromptError,
} from "./refactoring-advice-prompt.error"

const DEFAULT_MAX_ATTEMPTS = 1
const DEFAULT_RETRY_BACKOFF_MS = 0
const DEFAULT_IDEMPOTENCY_TTL_MS = 300_000

/**
 * Refactoring metric input item.
 */
export interface IRefactoringMetricInput {
    /**
     * Metric name.
     */
    readonly name: string

    /**
     * Metric numeric value.
     */
    readonly value: number

    /**
     * Optional metric unit.
     */
    readonly unit?: string
}

/**
 * Coupling edge input item.
 */
export interface IRefactoringCouplingInput {
    /**
     * Source file path.
     */
    readonly sourcePath: string

    /**
     * Target file path.
     */
    readonly targetPath: string

    /**
     * Coupling strength score.
     */
    readonly strength: number

    /**
     * Number of commits touching both files.
     */
    readonly sharedCommitCount: number

    /**
     * Last time this coupling was observed.
     */
    readonly lastSeenAt: string
}

/**
 * Input payload for refactoring advice prompt generation.
 */
export interface IRefactoringAdvicePromptInput {
    /**
     * Optional scope name of the refactoring effort.
     */
    readonly scopeName?: string

    /**
     * Code metrics used for planning.
     */
    readonly codeMetrics: readonly IRefactoringMetricInput[]

    /**
     * Coupling edges used for temporal coupling evidence.
     */
    readonly couplingData: readonly IRefactoringCouplingInput[]

    /**
     * Optional architecture constraints.
     */
    readonly architectureConstraints?: readonly string[]

    /**
     * Optional additional context text.
     */
    readonly additionalContext?: string

    /**
     * Optional asynchronous additional context loader.
     */
    readonly loadAdditionalContext?: () => Promise<string>

    /**
     * Optional idempotency key for dedupe and cache.
     */
    readonly idempotencyKey?: string
}

/**
 * Runtime options for refactoring advice prompt builder.
 */
export interface IRefactoringAdvicePromptOptions {
    /**
     * Maximum attempts for additional context loading.
     */
    readonly maxAttempts?: number

    /**
     * Retry backoff in milliseconds.
     */
    readonly retryBackoffMs?: number

    /**
     * Idempotency cache TTL in milliseconds.
     */
    readonly idempotencyTtlMs?: number

    /**
     * Optional sleep implementation for retry backoff.
     */
    readonly sleep?: (delayMs: number) => Promise<void>

    /**
     * Optional deterministic clock.
     */
    readonly now?: () => Date
}

/**
 * Refactoring advice prompt builder contract.
 */
export interface IRefactoringAdvicePrompt {
    /**
     * Builds refactoring advice prompt.
     *
     * @param input Prompt input.
     * @returns Prompt text.
     */
    build(input: IRefactoringAdvicePromptInput): Promise<string>
}

interface INormalizedRefactoringMetricInput {
    readonly name: string
    readonly value: number
    readonly unit?: string
}

interface INormalizedRefactoringCouplingInput {
    readonly sourcePath: string
    readonly targetPath: string
    readonly strength: number
    readonly sharedCommitCount: number
    readonly lastSeenAt: string
}

interface INormalizedRefactoringAdvicePromptInput {
    readonly scopeName?: string
    readonly codeMetrics: readonly INormalizedRefactoringMetricInput[]
    readonly couplingData: readonly INormalizedRefactoringCouplingInput[]
    readonly architectureConstraints: readonly string[]
    readonly additionalContext?: string
    readonly loadAdditionalContext?: () => Promise<string>
    readonly idempotencyKey?: string
}

interface IRefactoringAdvicePromptCacheEntry {
    readonly prompt: string
    readonly expiresAtMs: number
}

/**
 * Builds refactoring advice prompt from code metrics and coupling data.
 */
export class RefactoringAdvicePrompt implements IRefactoringAdvicePrompt {
    private readonly maxAttempts: number
    private readonly retryBackoffMs: number
    private readonly idempotencyTtlMs: number
    private readonly sleep: (delayMs: number) => Promise<void>
    private readonly now: () => Date
    private readonly inFlightByKey = new Map<string, Promise<string>>()
    private readonly cacheByKey = new Map<string, IRefactoringAdvicePromptCacheEntry>()

    /**
     * Creates refactoring advice prompt builder.
     *
     * @param options Optional runtime options.
     */
    public constructor(options: IRefactoringAdvicePromptOptions = {}) {
        this.maxAttempts = validatePositiveInteger(
            options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
            REFACTORING_ADVICE_PROMPT_ERROR_CODE.INVALID_MAX_ATTEMPTS,
        )
        this.retryBackoffMs = validateNonNegativeInteger(
            options.retryBackoffMs ?? DEFAULT_RETRY_BACKOFF_MS,
            REFACTORING_ADVICE_PROMPT_ERROR_CODE.INVALID_RETRY_BACKOFF_MS,
        )
        this.idempotencyTtlMs = validatePositiveInteger(
            options.idempotencyTtlMs ?? DEFAULT_IDEMPOTENCY_TTL_MS,
            REFACTORING_ADVICE_PROMPT_ERROR_CODE.INVALID_IDEMPOTENCY_TTL_MS,
        )
        this.sleep = options.sleep ?? sleepForMilliseconds
        this.now = options.now ?? (() => new Date())
    }

    /**
     * Builds refactoring advice prompt.
     *
     * @param input Prompt input.
     * @returns Prompt text.
     */
    public async build(input: IRefactoringAdvicePromptInput): Promise<string> {
        const normalized = normalizeRefactoringAdvicePromptInput(input)
        if (normalized.idempotencyKey === undefined) {
            return this.buildPrompt(normalized)
        }

        return this.buildIdempotent(normalized)
    }

    /**
     * Builds prompt with idempotency cache and in-flight dedupe.
     *
     * @param input Normalized prompt input.
     * @returns Prompt text.
     */
    private async buildIdempotent(
        input: INormalizedRefactoringAdvicePromptInput,
    ): Promise<string> {
        const nowMs = this.now().getTime()
        this.evictExpiredCache(nowMs)

        const idempotencyKey = input.idempotencyKey
        if (idempotencyKey === undefined) {
            return this.buildPrompt(input)
        }

        const cached = this.cacheByKey.get(idempotencyKey)
        if (cached !== undefined) {
            return cached.prompt
        }

        const inFlight = this.inFlightByKey.get(idempotencyKey)
        if (inFlight !== undefined) {
            return inFlight
        }

        const promptPromise = this.buildPrompt(input)
            .then((prompt): string => {
                this.cacheByKey.set(idempotencyKey, {
                    prompt,
                    expiresAtMs: nowMs + this.idempotencyTtlMs,
                })
                return prompt
            })
            .finally((): void => {
                this.inFlightByKey.delete(idempotencyKey)
            })

        this.inFlightByKey.set(idempotencyKey, promptPromise)
        return promptPromise
    }

    /**
     * Builds prompt without idempotency handling.
     *
     * @param input Normalized prompt input.
     * @returns Prompt text.
     */
    private async buildPrompt(input: INormalizedRefactoringAdvicePromptInput): Promise<string> {
        const loadedContext = await this.loadAdditionalContext(input)
        const additionalContext = mergeAdditionalContext(input.additionalContext, loadedContext)

        return buildPromptTemplate({
            scopeName: input.scopeName,
            codeMetrics: input.codeMetrics,
            couplingData: input.couplingData,
            architectureConstraints: input.architectureConstraints,
            additionalContext,
        })
    }

    /**
     * Loads additional context with bounded retry.
     *
     * @param input Normalized prompt input.
     * @returns Loaded context text or undefined.
     */
    private async loadAdditionalContext(
        input: INormalizedRefactoringAdvicePromptInput,
    ): Promise<string | undefined> {
        if (input.loadAdditionalContext === undefined) {
            return undefined
        }

        for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
            try {
                return normalizeOptionalText(await input.loadAdditionalContext())
            } catch (error) {
                if (attempt === this.maxAttempts) {
                    throw new RefactoringAdvicePromptError(
                        REFACTORING_ADVICE_PROMPT_ERROR_CODE.CONTEXT_LOAD_FAILED,
                        {
                            attempt,
                            causeMessage: resolveCauseMessage(error),
                        },
                    )
                }

                if (this.retryBackoffMs > 0) {
                    await this.sleep(this.retryBackoffMs)
                }
            }
        }

        return undefined
    }

    /**
     * Removes expired prompt cache entries.
     *
     * @param nowMs Current timestamp.
     */
    private evictExpiredCache(nowMs: number): void {
        for (const [idempotencyKey, entry] of this.cacheByKey.entries()) {
            if (entry.expiresAtMs <= nowMs) {
                this.cacheByKey.delete(idempotencyKey)
            }
        }
    }
}

/**
 * Validates and normalizes refactoring advice prompt input.
 *
 * @param input Raw prompt input.
 * @returns Normalized prompt input.
 */
function normalizeRefactoringAdvicePromptInput(
    input: IRefactoringAdvicePromptInput,
): INormalizedRefactoringAdvicePromptInput {
    const codeMetrics = normalizeCodeMetrics(input.codeMetrics)
    const couplingData = normalizeCouplingData(input.couplingData)
    const architectureConstraints = normalizeArchitectureConstraints(input.architectureConstraints)
    const idempotencyKey = normalizeOptionalIdempotencyKey(input.idempotencyKey)

    return {
        scopeName: normalizeOptionalText(input.scopeName),
        codeMetrics,
        couplingData,
        architectureConstraints,
        additionalContext: normalizeOptionalText(input.additionalContext),
        loadAdditionalContext: input.loadAdditionalContext,
        idempotencyKey,
    }
}

/**
 * Validates and normalizes code metrics list.
 *
 * @param codeMetrics Raw code metrics list.
 * @returns Normalized metrics.
 */
function normalizeCodeMetrics(
    codeMetrics: readonly IRefactoringMetricInput[],
): readonly INormalizedRefactoringMetricInput[] {
    if (codeMetrics.length === 0) {
        throw new RefactoringAdvicePromptError(
            REFACTORING_ADVICE_PROMPT_ERROR_CODE.INVALID_CODE_METRICS,
        )
    }

    const normalized = codeMetrics.map((metric): INormalizedRefactoringMetricInput => {
        const metricName = metric.name.trim()
        if (metricName.length === 0) {
            throw new RefactoringAdvicePromptError(
                REFACTORING_ADVICE_PROMPT_ERROR_CODE.INVALID_METRIC_NAME,
                {
                    metricName: metric.name,
                },
            )
        }

        if (Number.isFinite(metric.value) === false) {
            throw new RefactoringAdvicePromptError(
                REFACTORING_ADVICE_PROMPT_ERROR_CODE.INVALID_METRIC_VALUE,
            )
        }

        return {
            name: metricName,
            value: metric.value,
            unit: normalizeOptionalText(metric.unit),
        }
    })

    return normalized.sort((left, right): number => left.name.localeCompare(right.name))
}

/**
 * Validates and normalizes coupling edge list.
 *
 * @param couplingData Raw coupling data.
 * @returns Normalized coupling data.
 */
function normalizeCouplingData(
    couplingData: readonly IRefactoringCouplingInput[],
): readonly INormalizedRefactoringCouplingInput[] {
    if (couplingData.length === 0) {
        throw new RefactoringAdvicePromptError(
            REFACTORING_ADVICE_PROMPT_ERROR_CODE.INVALID_COUPLING_DATA,
        )
    }

    const normalized = couplingData.map((edge): INormalizedRefactoringCouplingInput => {
        const sourcePath = edge.sourcePath.trim()
        if (sourcePath.length === 0) {
            throw new RefactoringAdvicePromptError(
                REFACTORING_ADVICE_PROMPT_ERROR_CODE.INVALID_SOURCE_PATH,
                {
                    sourcePath: edge.sourcePath,
                },
            )
        }

        const targetPath = edge.targetPath.trim()
        if (targetPath.length === 0) {
            throw new RefactoringAdvicePromptError(
                REFACTORING_ADVICE_PROMPT_ERROR_CODE.INVALID_TARGET_PATH,
                {
                    targetPath: edge.targetPath,
                },
            )
        }

        if (Number.isFinite(edge.strength) === false || edge.strength < 0) {
            throw new RefactoringAdvicePromptError(
                REFACTORING_ADVICE_PROMPT_ERROR_CODE.INVALID_COUPLING_STRENGTH,
            )
        }

        if (
            Number.isInteger(edge.sharedCommitCount) === false ||
            edge.sharedCommitCount <= 0
        ) {
            throw new RefactoringAdvicePromptError(
                REFACTORING_ADVICE_PROMPT_ERROR_CODE.INVALID_SHARED_COMMIT_COUNT,
            )
        }

        const timestamp = Date.parse(edge.lastSeenAt)
        if (Number.isFinite(timestamp) === false) {
            throw new RefactoringAdvicePromptError(
                REFACTORING_ADVICE_PROMPT_ERROR_CODE.INVALID_LAST_SEEN_AT,
            )
        }

        return {
            sourcePath,
            targetPath,
            strength: edge.strength,
            sharedCommitCount: edge.sharedCommitCount,
            lastSeenAt: new Date(timestamp).toISOString(),
        }
    })

    return normalized.sort(compareCouplingEdge)
}

/**
 * Deterministic comparator for coupling edges.
 *
 * @param left Left edge.
 * @param right Right edge.
 * @returns Comparator value.
 */
function compareCouplingEdge(
    left: INormalizedRefactoringCouplingInput,
    right: INormalizedRefactoringCouplingInput,
): number {
    if (left.strength !== right.strength) {
        return right.strength - left.strength
    }

    if (left.sharedCommitCount !== right.sharedCommitCount) {
        return right.sharedCommitCount - left.sharedCommitCount
    }

    const sourceComparison = left.sourcePath.localeCompare(right.sourcePath)
    if (sourceComparison !== 0) {
        return sourceComparison
    }

    return left.targetPath.localeCompare(right.targetPath)
}

/**
 * Validates and normalizes architecture constraints list.
 *
 * @param architectureConstraints Optional constraints.
 * @returns Normalized constraints.
 */
function normalizeArchitectureConstraints(
    architectureConstraints: readonly string[] | undefined,
): readonly string[] {
    if (architectureConstraints === undefined) {
        return []
    }

    const normalized = architectureConstraints.map((constraint): string => {
        const value = constraint.trim()
        if (value.length === 0) {
            throw new RefactoringAdvicePromptError(
                REFACTORING_ADVICE_PROMPT_ERROR_CODE.INVALID_ARCHITECTURE_CONSTRAINT,
                {
                    architectureConstraint: constraint,
                },
            )
        }

        return value
    })

    return [...new Set(normalized)].sort((left, right): number => left.localeCompare(right))
}

/**
 * Normalizes optional idempotency key.
 *
 * @param idempotencyKey Optional idempotency key.
 * @returns Normalized key or undefined.
 */
function normalizeOptionalIdempotencyKey(idempotencyKey?: string): string | undefined {
    if (idempotencyKey === undefined) {
        return undefined
    }

    const normalized = idempotencyKey.trim()
    if (normalized.length === 0) {
        throw new RefactoringAdvicePromptError(
            REFACTORING_ADVICE_PROMPT_ERROR_CODE.INVALID_IDEMPOTENCY_KEY,
            {
                idempotencyKey,
            },
        )
    }

    return normalized
}

/**
 * Normalizes optional text by trimming empty values.
 *
 * @param value Optional text.
 * @returns Normalized text or undefined.
 */
function normalizeOptionalText(value?: string): string | undefined {
    if (value === undefined) {
        return undefined
    }

    const normalized = value.trim()
    if (normalized.length === 0) {
        return undefined
    }

    return normalized
}

/**
 * Merges static and asynchronously loaded context blocks.
 *
 * @param inlineContext Inline context text.
 * @param loadedContext Asynchronously loaded context text.
 * @returns Merged context text.
 */
function mergeAdditionalContext(
    inlineContext: string | undefined,
    loadedContext: string | undefined,
): string | undefined {
    const segments: string[] = []

    if (inlineContext !== undefined) {
        segments.push(inlineContext)
    }
    if (loadedContext !== undefined) {
        segments.push(loadedContext)
    }

    if (segments.length === 0) {
        return undefined
    }

    return segments.join("\n")
}

/**
 * Builds refactoring advice prompt template.
 *
 * @param input Normalized prompt input.
 * @returns Prompt text.
 */
function buildPromptTemplate(input: {
    readonly scopeName?: string
    readonly codeMetrics: readonly INormalizedRefactoringMetricInput[]
    readonly couplingData: readonly INormalizedRefactoringCouplingInput[]
    readonly architectureConstraints: readonly string[]
    readonly additionalContext?: string
}): string {
    const lines: string[] = [
        "Suggest a pragmatic refactoring strategy for the codebase slice below.",
        input.scopeName === undefined ? "Scope: Unspecified scope" : `Scope: ${input.scopeName}`,
        "",
        "Code metrics:",
        ...input.codeMetrics.map((metric): string => formatMetricLine(metric)),
        "",
        "Temporal coupling edges:",
        ...input.couplingData.map((edge): string => formatCouplingLine(edge)),
    ]

    if (input.architectureConstraints.length > 0) {
        lines.push("")
        lines.push("Architecture constraints:")
        lines.push(
            ...input.architectureConstraints.map((constraint): string => `- ${constraint}`),
        )
    }

    if (input.additionalContext !== undefined) {
        lines.push("")
        lines.push("Additional context:")
        lines.push(input.additionalContext)
    }

    lines.push("")
    lines.push("Output requirements:")
    lines.push("1. Propose a phased refactoring plan with priorities.")
    lines.push("2. Justify each phase using metrics and coupling evidence.")
    lines.push("3. List key risks and mitigations.")
    lines.push("4. Suggest first sprint execution steps with validation checks.")

    return lines.join("\n")
}

/**
 * Formats one metric line for prompt body.
 *
 * @param metric Metric item.
 * @returns Prompt line.
 */
function formatMetricLine(metric: INormalizedRefactoringMetricInput): string {
    const unitSegment = metric.unit === undefined ? "" : ` ${metric.unit}`
    return `- ${metric.name}: ${metric.value}${unitSegment}`
}

/**
 * Formats one temporal coupling edge line for prompt body.
 *
 * @param edge Coupling edge.
 * @returns Prompt line.
 */
function formatCouplingLine(edge: INormalizedRefactoringCouplingInput): string {
    return (
        `- ${edge.sourcePath} -> ${edge.targetPath} ` +
        `(strength: ${edge.strength}, shared commits: ${edge.sharedCommitCount}, ` +
        `last seen: ${edge.lastSeenAt})`
    )
}

/**
 * Validates positive integer value.
 *
 * @param value Candidate value.
 * @param code Error code.
 * @returns Validated integer.
 */
function validatePositiveInteger(
    value: number,
    code: RefactoringAdvicePromptError["code"],
): number {
    if (Number.isInteger(value) === false || value <= 0) {
        throw new RefactoringAdvicePromptError(code)
    }
    return value
}

/**
 * Validates non-negative integer value.
 *
 * @param value Candidate value.
 * @param code Error code.
 * @returns Validated integer.
 */
function validateNonNegativeInteger(
    value: number,
    code: RefactoringAdvicePromptError["code"],
): number {
    if (Number.isInteger(value) === false || value < 0) {
        throw new RefactoringAdvicePromptError(code)
    }
    return value
}

/**
 * Sleeps for provided milliseconds.
 *
 * @param delayMs Delay milliseconds.
 * @returns Promise resolved after delay.
 */
function sleepForMilliseconds(delayMs: number): Promise<void> {
    if (delayMs === 0) {
        return Promise.resolve()
    }
    return new Promise((resolve): void => {
        setTimeout(resolve, delayMs)
    })
}

/**
 * Resolves safe cause message from unknown error.
 *
 * @param error Unknown error payload.
 * @returns Cause message or undefined.
 */
function resolveCauseMessage(error: unknown): string | undefined {
    if (error instanceof Error) {
        return error.message
    }
    if (typeof error === "string") {
        return error
    }
    return undefined
}
