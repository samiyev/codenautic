import {
    EXECUTIVE_REPORT_PROMPT_ERROR_CODE,
    ExecutiveReportPromptError,
} from "./executive-report-prompt.error"

const DEFAULT_MAX_ATTEMPTS = 1
const DEFAULT_RETRY_BACKOFF_MS = 0
const DEFAULT_IDEMPOTENCY_TTL_MS = 300_000

/**
 * Supported trend direction values for executive reports.
 */
export const EXECUTIVE_REPORT_TREND_DIRECTION = {
    UP: "up",
    DOWN: "down",
    STABLE: "stable",
} as const

/**
 * Executive trend direction literal.
 */
export type ExecutiveReportTrendDirection =
    (typeof EXECUTIVE_REPORT_TREND_DIRECTION)[keyof typeof EXECUTIVE_REPORT_TREND_DIRECTION]

/**
 * Repository state metric input item.
 */
export interface IExecutiveRepoStateMetricInput {
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
 * Executive trend input item.
 */
export interface IExecutiveReportTrendInput {
    /**
     * Trend metric name.
     */
    readonly name: string

    /**
     * Trend direction.
     */
    readonly direction: ExecutiveReportTrendDirection

    /**
     * Optional percent delta.
     */
    readonly changePercent?: number

    /**
     * Time window for the trend.
     */
    readonly window: string
}

/**
 * Input payload for executive report prompt generation.
 */
export interface IExecutiveReportPromptInput {
    /**
     * Optional reporting period label.
     */
    readonly reportPeriod?: string

    /**
     * Current repository state metrics.
     */
    readonly repoState: readonly IExecutiveRepoStateMetricInput[]

    /**
     * Trend entries.
     */
    readonly trends: readonly IExecutiveReportTrendInput[]

    /**
     * Highlight bullet points.
     */
    readonly highlights: readonly string[]

    /**
     * Optional risk bullet points.
     */
    readonly risks?: readonly string[]

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
 * Runtime options for executive report prompt builder.
 */
export interface IExecutiveReportPromptOptions {
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
 * Executive report prompt builder contract.
 */
export interface IExecutiveReportPrompt {
    /**
     * Builds executive report prompt from repository insights.
     *
     * @param input Prompt input.
     * @returns Prompt text.
     */
    build(input: IExecutiveReportPromptInput): Promise<string>
}

interface INormalizedExecutiveRepoStateMetricInput {
    readonly name: string
    readonly value: number
    readonly unit?: string
}

interface INormalizedExecutiveReportTrendInput {
    readonly name: string
    readonly direction: ExecutiveReportTrendDirection
    readonly changePercent?: number
    readonly window: string
}

interface INormalizedExecutiveReportPromptInput {
    readonly reportPeriod?: string
    readonly repoState: readonly INormalizedExecutiveRepoStateMetricInput[]
    readonly trends: readonly INormalizedExecutiveReportTrendInput[]
    readonly highlights: readonly string[]
    readonly risks: readonly string[]
    readonly additionalContext?: string
    readonly loadAdditionalContext?: () => Promise<string>
    readonly idempotencyKey?: string
}

interface IExecutiveReportPromptCacheEntry {
    readonly prompt: string
    readonly expiresAtMs: number
}

/**
 * Builds executive report prompt from repository state, trends, and highlights.
 */
export class ExecutiveReportPrompt implements IExecutiveReportPrompt {
    private readonly maxAttempts: number
    private readonly retryBackoffMs: number
    private readonly idempotencyTtlMs: number
    private readonly sleep: (delayMs: number) => Promise<void>
    private readonly now: () => Date
    private readonly inFlightByKey = new Map<string, Promise<string>>()
    private readonly cacheByKey = new Map<string, IExecutiveReportPromptCacheEntry>()

    /**
     * Creates executive report prompt builder.
     *
     * @param options Optional runtime options.
     */
    public constructor(options: IExecutiveReportPromptOptions = {}) {
        this.maxAttempts = validatePositiveInteger(
            options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
            EXECUTIVE_REPORT_PROMPT_ERROR_CODE.INVALID_MAX_ATTEMPTS,
        )
        this.retryBackoffMs = validateNonNegativeInteger(
            options.retryBackoffMs ?? DEFAULT_RETRY_BACKOFF_MS,
            EXECUTIVE_REPORT_PROMPT_ERROR_CODE.INVALID_RETRY_BACKOFF_MS,
        )
        this.idempotencyTtlMs = validatePositiveInteger(
            options.idempotencyTtlMs ?? DEFAULT_IDEMPOTENCY_TTL_MS,
            EXECUTIVE_REPORT_PROMPT_ERROR_CODE.INVALID_IDEMPOTENCY_TTL_MS,
        )
        this.sleep = options.sleep ?? sleepForMilliseconds
        this.now = options.now ?? (() => new Date())
    }

    /**
     * Builds executive report prompt from repository insights.
     *
     * @param input Prompt input.
     * @returns Prompt text.
     */
    public async build(input: IExecutiveReportPromptInput): Promise<string> {
        const normalized = normalizeExecutiveReportPromptInput(input)
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
    private async buildIdempotent(input: INormalizedExecutiveReportPromptInput): Promise<string> {
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
    private async buildPrompt(input: INormalizedExecutiveReportPromptInput): Promise<string> {
        const loadedContext = await this.loadAdditionalContext(input)
        const additionalContext = mergeAdditionalContext(input.additionalContext, loadedContext)

        return buildPromptTemplate({
            reportPeriod: input.reportPeriod,
            repoState: input.repoState,
            trends: input.trends,
            highlights: input.highlights,
            risks: input.risks,
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
        input: INormalizedExecutiveReportPromptInput,
    ): Promise<string | undefined> {
        if (input.loadAdditionalContext === undefined) {
            return undefined
        }

        for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
            try {
                return normalizeOptionalText(await input.loadAdditionalContext())
            } catch (error) {
                if (attempt === this.maxAttempts) {
                    throw new ExecutiveReportPromptError(
                        EXECUTIVE_REPORT_PROMPT_ERROR_CODE.CONTEXT_LOAD_FAILED,
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
 * Validates and normalizes executive report prompt input.
 *
 * @param input Raw prompt input.
 * @returns Normalized prompt input.
 */
function normalizeExecutiveReportPromptInput(
    input: IExecutiveReportPromptInput,
): INormalizedExecutiveReportPromptInput {
    const repoState = normalizeRepoState(input.repoState)
    const trends = normalizeTrends(input.trends)
    const highlights = normalizeHighlights(input.highlights)
    const risks = normalizeRisks(input.risks)
    const idempotencyKey = normalizeOptionalIdempotencyKey(input.idempotencyKey)

    return {
        reportPeriod: normalizeOptionalText(input.reportPeriod),
        repoState,
        trends,
        highlights,
        risks,
        additionalContext: normalizeOptionalText(input.additionalContext),
        loadAdditionalContext: input.loadAdditionalContext,
        idempotencyKey,
    }
}

/**
 * Validates and normalizes repository state metrics.
 *
 * @param repoState Raw repository state metrics.
 * @returns Normalized repository state metrics.
 */
function normalizeRepoState(
    repoState: readonly IExecutiveRepoStateMetricInput[],
): readonly INormalizedExecutiveRepoStateMetricInput[] {
    if (repoState.length === 0) {
        throw new ExecutiveReportPromptError(
            EXECUTIVE_REPORT_PROMPT_ERROR_CODE.INVALID_REPO_STATE,
        )
    }

    const normalized = repoState.map((metric): INormalizedExecutiveRepoStateMetricInput => {
        const metricName = metric.name.trim()
        if (metricName.length === 0) {
            throw new ExecutiveReportPromptError(
                EXECUTIVE_REPORT_PROMPT_ERROR_CODE.INVALID_REPO_STATE_NAME,
                {
                    stateMetricName: metric.name,
                },
            )
        }

        if (Number.isFinite(metric.value) === false) {
            throw new ExecutiveReportPromptError(
                EXECUTIVE_REPORT_PROMPT_ERROR_CODE.INVALID_REPO_STATE_VALUE,
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
 * Validates and normalizes trend entries.
 *
 * @param trends Raw trend entries.
 * @returns Normalized trend entries.
 */
function normalizeTrends(
    trends: readonly IExecutiveReportTrendInput[],
): readonly INormalizedExecutiveReportTrendInput[] {
    if (trends.length === 0) {
        throw new ExecutiveReportPromptError(
            EXECUTIVE_REPORT_PROMPT_ERROR_CODE.INVALID_TRENDS,
        )
    }

    const normalized = trends.map((trend): INormalizedExecutiveReportTrendInput => {
        const trendName = trend.name.trim()
        if (trendName.length === 0) {
            throw new ExecutiveReportPromptError(
                EXECUTIVE_REPORT_PROMPT_ERROR_CODE.INVALID_TREND_NAME,
                {
                    trendName: trend.name,
                },
            )
        }

        if (isExecutiveTrendDirection(trend.direction) === false) {
            throw new ExecutiveReportPromptError(
                EXECUTIVE_REPORT_PROMPT_ERROR_CODE.INVALID_TREND_DIRECTION,
            )
        }

        const trendWindow = trend.window.trim()
        if (trendWindow.length === 0) {
            throw new ExecutiveReportPromptError(
                EXECUTIVE_REPORT_PROMPT_ERROR_CODE.INVALID_TREND_WINDOW,
            )
        }

        if (
            trend.changePercent !== undefined &&
            Number.isFinite(trend.changePercent) === false
        ) {
            throw new ExecutiveReportPromptError(
                EXECUTIVE_REPORT_PROMPT_ERROR_CODE.INVALID_TREND_CHANGE_PERCENT,
            )
        }

        return {
            name: trendName,
            direction: trend.direction,
            changePercent: trend.changePercent,
            window: trendWindow,
        }
    })

    return normalized.sort(compareTrendEntries)
}

/**
 * Deterministic comparator for trend entries.
 *
 * @param left Left trend entry.
 * @param right Right trend entry.
 * @returns Comparator value.
 */
function compareTrendEntries(
    left: INormalizedExecutiveReportTrendInput,
    right: INormalizedExecutiveReportTrendInput,
): number {
    const nameComparison = left.name.localeCompare(right.name)
    if (nameComparison !== 0) {
        return nameComparison
    }

    return left.window.localeCompare(right.window)
}

/**
 * Validates and normalizes highlights list.
 *
 * @param highlights Raw highlights list.
 * @returns Normalized highlights.
 */
function normalizeHighlights(highlights: readonly string[]): readonly string[] {
    if (highlights.length === 0) {
        throw new ExecutiveReportPromptError(
            EXECUTIVE_REPORT_PROMPT_ERROR_CODE.INVALID_HIGHLIGHTS,
        )
    }

    const normalized = highlights.map((highlight): string => {
        const value = highlight.trim()
        if (value.length === 0) {
            throw new ExecutiveReportPromptError(
                EXECUTIVE_REPORT_PROMPT_ERROR_CODE.INVALID_HIGHLIGHT_ENTRY,
                {
                    highlightEntry: highlight,
                },
            )
        }

        return value
    })

    return [...new Set(normalized)].sort((left, right): number => left.localeCompare(right))
}

/**
 * Validates and normalizes optional risks list.
 *
 * @param risks Optional risks list.
 * @returns Normalized risks.
 */
function normalizeRisks(risks: readonly string[] | undefined): readonly string[] {
    if (risks === undefined) {
        return []
    }

    const normalized = risks.map((risk): string => {
        const value = risk.trim()
        if (value.length === 0) {
            throw new ExecutiveReportPromptError(
                EXECUTIVE_REPORT_PROMPT_ERROR_CODE.INVALID_RISK_ENTRY,
                {
                    riskEntry: risk,
                },
            )
        }
        return value
    })

    return [...new Set(normalized)].sort((left, right): number => left.localeCompare(right))
}

/**
 * Type guard for executive trend direction.
 *
 * @param value Candidate direction.
 * @returns True when value is supported.
 */
function isExecutiveTrendDirection(value: string): value is ExecutiveReportTrendDirection {
    return (
        value === EXECUTIVE_REPORT_TREND_DIRECTION.UP ||
        value === EXECUTIVE_REPORT_TREND_DIRECTION.DOWN ||
        value === EXECUTIVE_REPORT_TREND_DIRECTION.STABLE
    )
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
        throw new ExecutiveReportPromptError(
            EXECUTIVE_REPORT_PROMPT_ERROR_CODE.INVALID_IDEMPOTENCY_KEY,
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
 * Builds executive report prompt template.
 *
 * @param input Normalized prompt input.
 * @returns Prompt text.
 */
function buildPromptTemplate(input: {
    readonly reportPeriod?: string
    readonly repoState: readonly INormalizedExecutiveRepoStateMetricInput[]
    readonly trends: readonly INormalizedExecutiveReportTrendInput[]
    readonly highlights: readonly string[]
    readonly risks: readonly string[]
    readonly additionalContext?: string
}): string {
    const lines: string[] = [
        "Generate an executive narrative report for repository health and delivery momentum.",
        input.reportPeriod === undefined
            ? "Reporting period: Unspecified"
            : `Reporting period: ${input.reportPeriod}`,
        "",
        "Repository state:",
        ...input.repoState.map((metric): string => formatMetricLine(metric)),
        "",
        "Trends:",
        ...input.trends.map((trend): string => formatTrendLine(trend)),
        "",
        "Highlights:",
        ...input.highlights.map((highlight): string => `- ${highlight}`),
    ]

    if (input.risks.length > 0) {
        lines.push("")
        lines.push("Risks:")
        lines.push(...input.risks.map((risk): string => `- ${risk}`))
    }

    if (input.additionalContext !== undefined) {
        lines.push("")
        lines.push("Additional context:")
        lines.push(input.additionalContext)
    }

    lines.push("")
    lines.push("Output requirements:")
    lines.push("1. Write a concise executive summary in 2-4 short paragraphs.")
    lines.push("2. Connect trends to impact on delivery and quality.")
    lines.push("3. Include recommendations for the next reporting cycle.")
    lines.push("4. Keep tone action-oriented and decision-ready.")

    return lines.join("\n")
}

/**
 * Formats one repository state metric line for prompt body.
 *
 * @param metric Repository state metric item.
 * @returns Prompt line.
 */
function formatMetricLine(metric: INormalizedExecutiveRepoStateMetricInput): string {
    const unitSegment = metric.unit === undefined ? "" : ` ${metric.unit}`
    return `- ${metric.name}: ${metric.value}${unitSegment}`
}

/**
 * Formats one trend line for prompt body.
 *
 * @param trend Trend item.
 * @returns Prompt line.
 */
function formatTrendLine(trend: INormalizedExecutiveReportTrendInput): string {
    const changeSegment =
        trend.changePercent === undefined ? "" : `, change: ${trend.changePercent}%`
    return `- ${trend.name}: ${trend.direction} (${trend.window}${changeSegment})`
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
    code: ExecutiveReportPromptError["code"],
): number {
    if (Number.isInteger(value) === false || value <= 0) {
        throw new ExecutiveReportPromptError(code)
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
    code: ExecutiveReportPromptError["code"],
): number {
    if (Number.isInteger(value) === false || value < 0) {
        throw new ExecutiveReportPromptError(code)
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
