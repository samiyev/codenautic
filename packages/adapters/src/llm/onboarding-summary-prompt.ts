import {
    ONBOARDING_SUMMARY_PROMPT_ERROR_CODE,
    OnboardingSummaryPromptError,
} from "./onboarding-summary-prompt.error"

const DEFAULT_MAX_ATTEMPTS = 1
const DEFAULT_RETRY_BACKOFF_MS = 0
const DEFAULT_IDEMPOTENCY_TTL_MS = 300_000

/**
 * Metric input item for onboarding summary prompt.
 */
export interface IOnboardingSummaryMetricInput {
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
 * Input payload for onboarding summary prompt generation.
 */
export interface IOnboardingSummaryPromptInput {
    /**
     * Optional project name.
     */
    readonly projectName?: string

    /**
     * Tech stack entries.
     */
    readonly techStack: readonly string[]

    /**
     * Architecture highlight entries.
     */
    readonly architectureHighlights: readonly string[]

    /**
     * Metric entries.
     */
    readonly metrics: readonly IOnboardingSummaryMetricInput[]

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
 * Runtime options for onboarding summary prompt builder.
 */
export interface IOnboardingSummaryPromptOptions {
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
 * Onboarding summary prompt builder contract.
 */
export interface IOnboardingSummaryPrompt {
    /**
     * Builds onboarding summary prompt from scan data.
     *
     * @param input Prompt input.
     * @returns Prompt text.
     */
    build(input: IOnboardingSummaryPromptInput): Promise<string>
}

interface INormalizedOnboardingMetricInput {
    readonly name: string
    readonly value: number
    readonly unit?: string
}

interface INormalizedOnboardingSummaryPromptInput {
    readonly projectName?: string
    readonly techStack: readonly string[]
    readonly architectureHighlights: readonly string[]
    readonly metrics: readonly INormalizedOnboardingMetricInput[]
    readonly additionalContext?: string
    readonly loadAdditionalContext?: () => Promise<string>
    readonly idempotencyKey?: string
}

interface IOnboardingPromptCacheEntry {
    readonly prompt: string
    readonly expiresAtMs: number
}

/**
 * Builds onboarding summary prompt from repository scan data.
 */
export class OnboardingSummaryPrompt implements IOnboardingSummaryPrompt {
    private readonly maxAttempts: number
    private readonly retryBackoffMs: number
    private readonly idempotencyTtlMs: number
    private readonly sleep: (delayMs: number) => Promise<void>
    private readonly now: () => Date
    private readonly inFlightByKey = new Map<string, Promise<string>>()
    private readonly cacheByKey = new Map<string, IOnboardingPromptCacheEntry>()

    /**
     * Creates onboarding summary prompt builder.
     *
     * @param options Optional runtime options.
     */
    public constructor(options: IOnboardingSummaryPromptOptions = {}) {
        this.maxAttempts = validatePositiveInteger(
            options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
            ONBOARDING_SUMMARY_PROMPT_ERROR_CODE.INVALID_MAX_ATTEMPTS,
        )
        this.retryBackoffMs = validateNonNegativeInteger(
            options.retryBackoffMs ?? DEFAULT_RETRY_BACKOFF_MS,
            ONBOARDING_SUMMARY_PROMPT_ERROR_CODE.INVALID_RETRY_BACKOFF_MS,
        )
        this.idempotencyTtlMs = validatePositiveInteger(
            options.idempotencyTtlMs ?? DEFAULT_IDEMPOTENCY_TTL_MS,
            ONBOARDING_SUMMARY_PROMPT_ERROR_CODE.INVALID_IDEMPOTENCY_TTL_MS,
        )
        this.sleep = options.sleep ?? sleepForMilliseconds
        this.now = options.now ?? (() => new Date())
    }

    /**
     * Builds onboarding summary prompt from scan data.
     *
     * @param input Prompt input.
     * @returns Prompt text.
     */
    public async build(input: IOnboardingSummaryPromptInput): Promise<string> {
        const normalized = normalizeOnboardingSummaryPromptInput(input)
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
        input: INormalizedOnboardingSummaryPromptInput,
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
    private async buildPrompt(input: INormalizedOnboardingSummaryPromptInput): Promise<string> {
        const loadedContext = await this.loadAdditionalContext(input)
        const additionalContext = mergeAdditionalContext(input.additionalContext, loadedContext)

        return buildPromptTemplate({
            projectName: input.projectName,
            techStack: input.techStack,
            architectureHighlights: input.architectureHighlights,
            metrics: input.metrics,
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
        input: INormalizedOnboardingSummaryPromptInput,
    ): Promise<string | undefined> {
        if (input.loadAdditionalContext === undefined) {
            return undefined
        }

        for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
            try {
                return normalizeOptionalText(await input.loadAdditionalContext())
            } catch (error) {
                if (attempt === this.maxAttempts) {
                    throw new OnboardingSummaryPromptError(
                        ONBOARDING_SUMMARY_PROMPT_ERROR_CODE.CONTEXT_LOAD_FAILED,
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
 * Validates and normalizes onboarding summary prompt input.
 *
 * @param input Raw prompt input.
 * @returns Normalized prompt input.
 */
function normalizeOnboardingSummaryPromptInput(
    input: IOnboardingSummaryPromptInput,
): INormalizedOnboardingSummaryPromptInput {
    const techStack = normalizeTechStack(input.techStack)
    const architectureHighlights = normalizeArchitectureHighlights(input.architectureHighlights)
    const metrics = normalizeMetrics(input.metrics)
    const idempotencyKey = normalizeOptionalIdempotencyKey(input.idempotencyKey)

    return {
        projectName: normalizeOptionalText(input.projectName),
        techStack,
        architectureHighlights,
        metrics,
        additionalContext: normalizeOptionalText(input.additionalContext),
        loadAdditionalContext: input.loadAdditionalContext,
        idempotencyKey,
    }
}

/**
 * Validates and normalizes tech stack list.
 *
 * @param techStack Raw tech stack list.
 * @returns Normalized tech stack list.
 */
function normalizeTechStack(techStack: readonly string[]): readonly string[] {
    if (techStack.length === 0) {
        throw new OnboardingSummaryPromptError(
            ONBOARDING_SUMMARY_PROMPT_ERROR_CODE.INVALID_TECH_STACK,
        )
    }

    const normalized = techStack.map((entry): string => {
        const value = entry.trim()
        if (value.length === 0) {
            throw new OnboardingSummaryPromptError(
                ONBOARDING_SUMMARY_PROMPT_ERROR_CODE.INVALID_TECH_STACK_ENTRY,
                {
                    entry,
                },
            )
        }
        return value
    })

    return [...new Set(normalized)].sort((left, right): number => left.localeCompare(right))
}

/**
 * Validates and normalizes architecture highlight list.
 *
 * @param architectureHighlights Raw architecture highlight list.
 * @returns Normalized architecture highlight list.
 */
function normalizeArchitectureHighlights(
    architectureHighlights: readonly string[],
): readonly string[] {
    if (architectureHighlights.length === 0) {
        throw new OnboardingSummaryPromptError(
            ONBOARDING_SUMMARY_PROMPT_ERROR_CODE.INVALID_ARCHITECTURE_HIGHLIGHTS,
        )
    }

    const normalized = architectureHighlights.map((entry): string => {
        const value = entry.trim()
        if (value.length === 0) {
            throw new OnboardingSummaryPromptError(
                ONBOARDING_SUMMARY_PROMPT_ERROR_CODE.INVALID_ARCHITECTURE_HIGHLIGHT,
                {
                    entry,
                },
            )
        }
        return value
    })

    return [...new Set(normalized)].sort((left, right): number => left.localeCompare(right))
}

/**
 * Validates and normalizes metrics list.
 *
 * @param metrics Raw metrics list.
 * @returns Normalized metrics list.
 */
function normalizeMetrics(
    metrics: readonly IOnboardingSummaryMetricInput[],
): readonly INormalizedOnboardingMetricInput[] {
    if (metrics.length === 0) {
        throw new OnboardingSummaryPromptError(
            ONBOARDING_SUMMARY_PROMPT_ERROR_CODE.INVALID_METRICS,
        )
    }

    const normalized = metrics.map((metric): INormalizedOnboardingMetricInput => {
        const metricName = metric.name.trim()
        if (metricName.length === 0) {
            throw new OnboardingSummaryPromptError(
                ONBOARDING_SUMMARY_PROMPT_ERROR_CODE.INVALID_METRIC_NAME,
                {
                    metricName: metric.name,
                },
            )
        }

        if (Number.isFinite(metric.value) === false) {
            throw new OnboardingSummaryPromptError(
                ONBOARDING_SUMMARY_PROMPT_ERROR_CODE.INVALID_METRIC_VALUE,
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
        throw new OnboardingSummaryPromptError(
            ONBOARDING_SUMMARY_PROMPT_ERROR_CODE.INVALID_IDEMPOTENCY_KEY,
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
 * Builds onboarding summary prompt template.
 *
 * @param input Normalized input data.
 * @returns Prompt text.
 */
function buildPromptTemplate(input: {
    readonly projectName?: string
    readonly techStack: readonly string[]
    readonly architectureHighlights: readonly string[]
    readonly metrics: readonly INormalizedOnboardingMetricInput[]
    readonly additionalContext?: string
}): string {
    const lines: string[] = [
        "Create a concise onboarding summary for a new engineer joining the project.",
        input.projectName === undefined ? "Project: Unknown project" : `Project: ${input.projectName}`,
        "",
        "Tech stack:",
        ...input.techStack.map((entry): string => `- ${entry}`),
        "",
        "Architecture highlights:",
        ...input.architectureHighlights.map((entry): string => `- ${entry}`),
        "",
        "Key metrics:",
        ...input.metrics.map((metric): string => formatMetricLine(metric)),
    ]

    if (input.additionalContext !== undefined) {
        lines.push("")
        lines.push("Additional context:")
        lines.push(input.additionalContext)
    }

    lines.push("")
    lines.push("Output requirements:")
    lines.push("1. Give a short project overview in 2-3 sentences.")
    lines.push("2. Highlight what matters first for onboarding.")
    lines.push("3. Mention one practical first-week action plan.")

    return lines.join("\n")
}

/**
 * Formats one metric line for prompt body.
 *
 * @param metric Metric item.
 * @returns Prompt line.
 */
function formatMetricLine(metric: INormalizedOnboardingMetricInput): string {
    const unitSegment = metric.unit === undefined ? "" : ` ${metric.unit}`
    return `- ${metric.name}: ${metric.value}${unitSegment}`
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
    code: OnboardingSummaryPromptError["code"],
): number {
    if (Number.isInteger(value) === false || value <= 0) {
        throw new OnboardingSummaryPromptError(code)
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
    code: OnboardingSummaryPromptError["code"],
): number {
    if (Number.isInteger(value) === false || value < 0) {
        throw new OnboardingSummaryPromptError(code)
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
