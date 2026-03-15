import {
    PREDICTION_EXPLAIN_PROMPT_ERROR_CODE,
    PredictionExplainPromptError,
} from "./prediction-explain-prompt.error"

const DEFAULT_MAX_ATTEMPTS = 1
const DEFAULT_RETRY_BACKOFF_MS = 0
const DEFAULT_IDEMPOTENCY_TTL_MS = 300_000

/**
 * Supported trend direction values.
 */
export const PREDICTION_TREND_DIRECTION = {
    UP: "up",
    DOWN: "down",
    STABLE: "stable",
} as const

/**
 * Trend direction literal.
 */
export type PredictionTrendDirection =
    (typeof PREDICTION_TREND_DIRECTION)[keyof typeof PREDICTION_TREND_DIRECTION]

/**
 * Prediction metric input item.
 */
export interface IPredictionMetricInput {
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
 * Prediction trend input item.
 */
export interface IPredictionTrendInput {
    /**
     * Metric name associated with trend.
     */
    readonly metricName: string

    /**
     * Trend direction.
     */
    readonly direction: PredictionTrendDirection

    /**
     * Optional percent change.
     */
    readonly changePercent?: number

    /**
     * Trend time window.
     */
    readonly window: string
}

/**
 * Input payload for prediction explain prompt generation.
 */
export interface IPredictionExplainPromptInput {
    /**
     * Metric list used by narrative.
     */
    readonly metrics: readonly IPredictionMetricInput[]

    /**
     * Trend list used by narrative.
     */
    readonly trends: readonly IPredictionTrendInput[]

    /**
     * Optional confidence score in [0, 1] range.
     */
    readonly confidenceScore?: number

    /**
     * Optional additional context text.
     */
    readonly additionalContext?: string

    /**
     * Optional asynchronous additional context loader.
     */
    readonly loadAdditionalContext?: () => Promise<string>

    /**
     * Optional idempotency key for in-flight dedupe and cache.
     */
    readonly idempotencyKey?: string
}

/**
 * Runtime options for prediction explain prompt builder.
 */
export interface IPredictionExplainPromptOptions {
    /**
     * Maximum attempts for async context loading.
     */
    readonly maxAttempts?: number

    /**
     * Retry backoff in milliseconds for context loading.
     */
    readonly retryBackoffMs?: number

    /**
     * Idempotency TTL in milliseconds.
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
 * Prediction explain prompt builder contract.
 */
export interface IPredictionExplainPrompt {
    /**
     * Builds narrative-ready explain prompt.
     *
     * @param input Prompt input.
     * @returns Prompt string.
     */
    build(input: IPredictionExplainPromptInput): Promise<string>
}

interface INormalizedPredictionMetricInput {
    readonly name: string
    readonly value: number
    readonly unit?: string
}

interface INormalizedPredictionTrendInput {
    readonly metricName: string
    readonly direction: PredictionTrendDirection
    readonly changePercent?: number
    readonly window: string
}

interface INormalizedPredictionExplainPromptInput {
    readonly metrics: readonly INormalizedPredictionMetricInput[]
    readonly trends: readonly INormalizedPredictionTrendInput[]
    readonly confidenceScore?: number
    readonly additionalContext?: string
    readonly loadAdditionalContext?: () => Promise<string>
    readonly idempotencyKey?: string
}

interface IPredictionPromptCacheEntry {
    readonly prompt: string
    readonly expiresAtMs: number
}

/**
 * Builds prediction explanation prompt from metrics and trends.
 */
export class PredictionExplainPrompt implements IPredictionExplainPrompt {
    private readonly maxAttempts: number
    private readonly retryBackoffMs: number
    private readonly idempotencyTtlMs: number
    private readonly sleep: (delayMs: number) => Promise<void>
    private readonly now: () => Date
    private readonly inFlightByKey = new Map<string, Promise<string>>()
    private readonly cacheByKey = new Map<string, IPredictionPromptCacheEntry>()

    /**
     * Creates prediction explain prompt builder.
     *
     * @param options Optional runtime options.
     */
    public constructor(options: IPredictionExplainPromptOptions = {}) {
        this.maxAttempts = validatePositiveInteger(
            options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
            PREDICTION_EXPLAIN_PROMPT_ERROR_CODE.INVALID_MAX_ATTEMPTS,
        )
        this.retryBackoffMs = validateNonNegativeInteger(
            options.retryBackoffMs ?? DEFAULT_RETRY_BACKOFF_MS,
            PREDICTION_EXPLAIN_PROMPT_ERROR_CODE.INVALID_RETRY_BACKOFF_MS,
        )
        this.idempotencyTtlMs = validatePositiveInteger(
            options.idempotencyTtlMs ?? DEFAULT_IDEMPOTENCY_TTL_MS,
            PREDICTION_EXPLAIN_PROMPT_ERROR_CODE.INVALID_IDEMPOTENCY_TTL_MS,
        )
        this.sleep = options.sleep ?? sleepForMilliseconds
        this.now = options.now ?? (() => new Date())
    }

    /**
     * Builds narrative-ready explain prompt.
     *
     * @param input Prompt input.
     * @returns Prompt string.
     */
    public async build(input: IPredictionExplainPromptInput): Promise<string> {
        const normalized = normalizePredictionExplainPromptInput(input)
        if (normalized.idempotencyKey === undefined) {
            return this.buildPrompt(normalized)
        }

        return this.buildIdempotent(normalized)
    }

    /**
     * Builds prompt with idempotency dedupe and cache.
     *
     * @param input Normalized prompt input.
     * @returns Prompt string.
     */
    private async buildIdempotent(
        input: INormalizedPredictionExplainPromptInput,
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
     * @returns Prompt string.
     */
    private async buildPrompt(input: INormalizedPredictionExplainPromptInput): Promise<string> {
        const loadedContext = await this.loadAdditionalContext(input)
        const additionalContext = mergeAdditionalContext(input.additionalContext, loadedContext)

        return buildPromptTemplate({
            metrics: input.metrics,
            trends: input.trends,
            confidenceScore: input.confidenceScore,
            additionalContext,
        })
    }

    /**
     * Loads additional context with bounded retry.
     *
     * @param input Normalized prompt input.
     * @returns Loaded context string or undefined.
     */
    private async loadAdditionalContext(
        input: INormalizedPredictionExplainPromptInput,
    ): Promise<string | undefined> {
        if (input.loadAdditionalContext === undefined) {
            return undefined
        }

        for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
            try {
                return normalizeOptionalText(await input.loadAdditionalContext())
            } catch (error) {
                if (attempt === this.maxAttempts) {
                    throw new PredictionExplainPromptError(
                        PREDICTION_EXPLAIN_PROMPT_ERROR_CODE.CONTEXT_LOAD_FAILED,
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
 * Validates and normalizes prediction explain prompt input.
 *
 * @param input Raw prompt input.
 * @returns Normalized prompt input.
 */
function normalizePredictionExplainPromptInput(
    input: IPredictionExplainPromptInput,
): INormalizedPredictionExplainPromptInput {
    const metrics = normalizeMetrics(input.metrics)
    const trends = normalizeTrends(input.trends)
    const confidenceScore = normalizeConfidenceScore(input.confidenceScore)
    const idempotencyKey = normalizeOptionalIdempotencyKey(input.idempotencyKey)

    return {
        metrics,
        trends,
        confidenceScore,
        additionalContext: normalizeOptionalText(input.additionalContext),
        loadAdditionalContext: input.loadAdditionalContext,
        idempotencyKey,
    }
}

/**
 * Validates and normalizes metrics input.
 *
 * @param metrics Raw metrics input.
 * @returns Normalized metrics.
 */
function normalizeMetrics(
    metrics: readonly IPredictionMetricInput[],
): readonly INormalizedPredictionMetricInput[] {
    if (metrics.length === 0) {
        throw new PredictionExplainPromptError(
            PREDICTION_EXPLAIN_PROMPT_ERROR_CODE.INVALID_METRICS,
        )
    }

    const normalized = metrics.map((metric): INormalizedPredictionMetricInput => {
        const metricName = metric.name.trim()
        if (metricName.length === 0) {
            throw new PredictionExplainPromptError(
                PREDICTION_EXPLAIN_PROMPT_ERROR_CODE.INVALID_METRIC_NAME,
                {
                    metricName: metric.name,
                },
            )
        }

        if (Number.isFinite(metric.value) === false) {
            throw new PredictionExplainPromptError(
                PREDICTION_EXPLAIN_PROMPT_ERROR_CODE.INVALID_METRIC_VALUE,
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
 * Validates and normalizes trends input.
 *
 * @param trends Raw trends input.
 * @returns Normalized trends.
 */
function normalizeTrends(
    trends: readonly IPredictionTrendInput[],
): readonly INormalizedPredictionTrendInput[] {
    if (trends.length === 0) {
        throw new PredictionExplainPromptError(
            PREDICTION_EXPLAIN_PROMPT_ERROR_CODE.INVALID_TRENDS,
        )
    }

    const normalized = trends.map((trend): INormalizedPredictionTrendInput => {
        const trendMetricName = trend.metricName.trim()
        if (trendMetricName.length === 0) {
            throw new PredictionExplainPromptError(
                PREDICTION_EXPLAIN_PROMPT_ERROR_CODE.INVALID_TREND_METRIC_NAME,
                {
                    trendMetricName: trend.metricName,
                },
            )
        }

        if (isPredictionTrendDirection(trend.direction) === false) {
            throw new PredictionExplainPromptError(
                PREDICTION_EXPLAIN_PROMPT_ERROR_CODE.INVALID_TREND_DIRECTION,
            )
        }

        const normalizedWindow = trend.window.trim()
        if (normalizedWindow.length === 0) {
            throw new PredictionExplainPromptError(
                PREDICTION_EXPLAIN_PROMPT_ERROR_CODE.INVALID_TREND_WINDOW,
            )
        }

        if (
            trend.changePercent !== undefined
            && Number.isFinite(trend.changePercent) === false
        ) {
            throw new PredictionExplainPromptError(
                PREDICTION_EXPLAIN_PROMPT_ERROR_CODE.INVALID_METRIC_VALUE,
            )
        }

        return {
            metricName: trendMetricName,
            direction: trend.direction,
            changePercent: trend.changePercent,
            window: normalizedWindow,
        }
    })

    return normalized.sort((left, right): number => {
        if (left.metricName === right.metricName) {
            return left.window.localeCompare(right.window)
        }
        return left.metricName.localeCompare(right.metricName)
    })
}

/**
 * Validates optional confidence score.
 *
 * @param confidenceScore Optional confidence score.
 * @returns Normalized confidence score.
 */
function normalizeConfidenceScore(confidenceScore?: number): number | undefined {
    if (confidenceScore === undefined) {
        return undefined
    }

    if (Number.isFinite(confidenceScore) === false || confidenceScore < 0 || confidenceScore > 1) {
        throw new PredictionExplainPromptError(
            PREDICTION_EXPLAIN_PROMPT_ERROR_CODE.INVALID_CONFIDENCE_SCORE,
        )
    }

    return confidenceScore
}

/**
 * Normalizes optional idempotency key.
 *
 * @param idempotencyKey Optional idempotency key.
 * @returns Normalized idempotency key or undefined.
 */
function normalizeOptionalIdempotencyKey(idempotencyKey?: string): string | undefined {
    if (idempotencyKey === undefined) {
        return undefined
    }

    const normalized = idempotencyKey.trim()
    if (normalized.length === 0) {
        throw new PredictionExplainPromptError(
            PREDICTION_EXPLAIN_PROMPT_ERROR_CODE.INVALID_IDEMPOTENCY_KEY,
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
 * Builds final narrative prompt text from normalized input.
 *
 * @param input Normalized input data.
 * @returns Prompt text.
 */
function buildPromptTemplate(input: {
    readonly metrics: readonly INormalizedPredictionMetricInput[]
    readonly trends: readonly INormalizedPredictionTrendInput[]
    readonly confidenceScore?: number
    readonly additionalContext?: string
}): string {
    const lines: string[] = [
        "You are a senior engineering analytics narrator.",
        "Explain the prediction in clear natural language for technical and non-technical readers.",
        "",
        "Metrics:",
        ...input.metrics.map((metric): string => formatMetricLine(metric)),
        "",
        "Trends:",
        ...input.trends.map((trend): string => formatTrendLine(trend)),
    ]

    if (input.confidenceScore !== undefined) {
        lines.push("")
        lines.push(`Confidence score: ${input.confidenceScore}`)
    }

    if (input.additionalContext !== undefined) {
        lines.push("")
        lines.push("Additional context:")
        lines.push(input.additionalContext)
    }

    lines.push("")
    lines.push("Output requirements:")
    lines.push("1. Start with one concise summary sentence.")
    lines.push("2. Explain key drivers behind the forecast using provided metrics and trends.")
    lines.push("3. Mention confidence and uncertainty in practical terms.")
    lines.push("4. End with one actionable recommendation.")

    return lines.join("\n")
}

/**
 * Formats one metric line for prompt body.
 *
 * @param metric Metric item.
 * @returns Prompt line.
 */
function formatMetricLine(metric: INormalizedPredictionMetricInput): string {
    const unitSegment = metric.unit === undefined ? "" : ` ${metric.unit}`
    return `- ${metric.name}: ${metric.value}${unitSegment}`
}

/**
 * Formats one trend line for prompt body.
 *
 * @param trend Trend item.
 * @returns Prompt line.
 */
function formatTrendLine(trend: INormalizedPredictionTrendInput): string {
    const changeSegment =
        trend.changePercent === undefined ? "n/a" : `${trend.changePercent}%`
    return `- ${trend.metricName} (${trend.window}): direction=${trend.direction}, change=${changeSegment}`
}

/**
 * Type guard for trend direction.
 *
 * @param value Trend direction candidate.
 * @returns True when value is supported trend direction.
 */
function isPredictionTrendDirection(value: string): value is PredictionTrendDirection {
    return value === PREDICTION_TREND_DIRECTION.UP
        || value === PREDICTION_TREND_DIRECTION.DOWN
        || value === PREDICTION_TREND_DIRECTION.STABLE
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
    code: PredictionExplainPromptError["code"],
): number {
    if (Number.isInteger(value) === false || value <= 0) {
        throw new PredictionExplainPromptError(code)
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
    code: PredictionExplainPromptError["code"],
): number {
    if (Number.isInteger(value) === false || value < 0) {
        throw new PredictionExplainPromptError(code)
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
