import type {IPromptConfigurationConfigData} from "./prompt-configuration-config.dto"

export const REVIEW_OVERRIDE_PROMPT_NAMES = {
    CODE_REVIEW_SYSTEM: "code-review-system",
    CROSS_FILE_ANALYSIS_SYSTEM: "cross-file-analysis-system",
} as const

export type ReviewOverridePromptName =
    (typeof REVIEW_OVERRIDE_PROMPT_NAMES)[keyof typeof REVIEW_OVERRIDE_PROMPT_NAMES]

/**
 * Category description set used in review prompts.
 */
export interface IReviewOverrideCategoryDescriptions {
    readonly bug: string
    readonly performance: string
    readonly security: string
}

/**
 * Category config override payload.
 */
export interface IReviewOverrideCategoryConfig {
    readonly descriptions: IReviewOverrideCategoryDescriptions
}

/**
 * Severity flag descriptions used in review prompts.
 */
export interface IReviewOverrideSeverityFlags {
    readonly critical: string
    readonly high: string
    readonly medium: string
    readonly low: string
}

/**
 * Severity config override payload.
 */
export interface IReviewOverrideSeverityConfig {
    readonly flags: IReviewOverrideSeverityFlags
}

/**
 * Generation override payload.
 */
export interface IReviewOverrideGenerationConfig {
    readonly main: string
}

/**
 * Review prompt overrides payload stored in system settings.
 */
export interface IReviewOverridesConfigData {
    readonly name: string
    readonly categories: IReviewOverrideCategoryConfig
    readonly severity: IReviewOverrideSeverityConfig
    readonly generation: IReviewOverrideGenerationConfig
}

/**
 * Parses review overrides settings payload.
 *
 * @param value Raw settings value.
 * @returns Parsed overrides or undefined when payload is invalid.
 */
export function parseReviewOverridesConfig(value: unknown): IReviewOverridesConfigData | undefined {
    const root = readObject(value)
    if (root === undefined) {
        return undefined
    }

    const name = readNonEmptyString(root["name"])
    const categories = parseOverrideCategories(root)
    const severity = parseOverrideSeverity(root)
    const generation = parseOverrideGeneration(root)
    if (name === undefined || categories === undefined || severity === undefined || generation === undefined) {
        return undefined
    }

    return {
        name,
        categories,
        severity,
        generation,
    }
}

/**
 * Builds prompt configuration defaults from review overrides.
 *
 * @param overrides Parsed review overrides.
 * @returns Prompt configuration payloads for review templates.
 */
export function buildReviewOverridePromptConfigurations(
    overrides: IReviewOverridesConfigData,
): readonly IPromptConfigurationConfigData[] {
    const baseDefaults = buildBaseDefaults(overrides)
    const crossFileDefaults = buildCrossFileDefaults(overrides)

    return Object.freeze([
        {
            name: REVIEW_OVERRIDE_PROMPT_NAMES.CODE_REVIEW_SYSTEM,
            defaults: baseDefaults,
            isGlobal: true,
        },
        {
            name: REVIEW_OVERRIDE_PROMPT_NAMES.CROSS_FILE_ANALYSIS_SYSTEM,
            defaults: crossFileDefaults,
            isGlobal: true,
        },
    ])
}

/**
 * Resolves config override defaults for code review prompt templates.
 *
 * @param overrides Parsed overrides payload.
 * @returns Defaults map for review templates.
 */
function buildBaseDefaults(overrides: IReviewOverridesConfigData): Record<string, unknown> {
    return {
        bugText: overrides.categories.descriptions.bug,
        perfText: overrides.categories.descriptions.performance,
        secText: overrides.categories.descriptions.security,
        criticalText: overrides.severity.flags.critical,
        highText: overrides.severity.flags.high,
        mediumText: overrides.severity.flags.medium,
        lowText: overrides.severity.flags.low,
        mainGenText: overrides.generation.main,
    }
}

/**
 * Builds overrides for cross-file prompts (severity + main generation text).
 *
 * @param overrides Parsed overrides payload.
 * @returns Defaults map for cross-file template.
 */
function buildCrossFileDefaults(overrides: IReviewOverridesConfigData): Record<string, unknown> {
    return {
        criticalText: overrides.severity.flags.critical,
        highText: overrides.severity.flags.high,
        mediumText: overrides.severity.flags.medium,
        lowText: overrides.severity.flags.low,
        mainGenText: overrides.generation.main,
    }
}

/**
 * Reads plain object value.
 *
 * @param value Raw value.
 * @returns Object when value is a plain record.
 */
function readObject(value: unknown): Record<string, unknown> | undefined {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return undefined
    }

    return value as Record<string, unknown>
}

/**
 * Reads non-empty string value preserving original formatting.
 *
 * @param value Raw value.
 * @returns String when value is non-empty.
 */
function readNonEmptyString(value: unknown): string | undefined {
    if (typeof value !== "string") {
        return undefined
    }

    if (value.trim().length === 0) {
        return undefined
    }

    return value
}

/**
 * Parses categories payload.
 *
 * @param root Root settings payload.
 * @returns Parsed category config or undefined.
 */
function parseOverrideCategories(
    root: Record<string, unknown>,
): IReviewOverrideCategoryConfig | undefined {
    const categories = readObject(root["categories"])
    if (categories === undefined) {
        return undefined
    }

    const descriptions = readObject(categories["descriptions"])
    if (descriptions === undefined) {
        return undefined
    }

    const bug = readNonEmptyString(descriptions["bug"])
    const performance = readNonEmptyString(descriptions["performance"])
    const security = readNonEmptyString(descriptions["security"])
    if (bug === undefined || performance === undefined || security === undefined) {
        return undefined
    }

    return {
        descriptions: {
            bug,
            performance,
            security,
        },
    }
}

/**
 * Parses severity payload.
 *
 * @param root Root settings payload.
 * @returns Parsed severity config or undefined.
 */
function parseOverrideSeverity(
    root: Record<string, unknown>,
): IReviewOverrideSeverityConfig | undefined {
    const severity = readObject(root["severity"])
    if (severity === undefined) {
        return undefined
    }

    const flags = readObject(severity["flags"])
    if (flags === undefined) {
        return undefined
    }

    const critical = readNonEmptyString(flags["critical"])
    const high = readNonEmptyString(flags["high"])
    const medium = readNonEmptyString(flags["medium"])
    const low = readNonEmptyString(flags["low"])
    if (critical === undefined || high === undefined || medium === undefined || low === undefined) {
        return undefined
    }

    return {
        flags: {
            critical,
            high,
            medium,
            low,
        },
    }
}

/**
 * Parses generation payload.
 *
 * @param root Root settings payload.
 * @returns Parsed generation config or undefined.
 */
function parseOverrideGeneration(
    root: Record<string, unknown>,
): IReviewOverrideGenerationConfig | undefined {
    const generation = readObject(root["generation"])
    if (generation === undefined) {
        return undefined
    }

    const main = readNonEmptyString(generation["main"])
    if (main === undefined) {
        return undefined
    }

    return {
        main,
    }
}
