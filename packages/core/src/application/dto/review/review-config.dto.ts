import type {IDirectoryConfig} from "../config/directory-config.dto"

export const REVIEW_DEPTH_STRATEGY = {
    AUTO: "auto",
    ALWAYS_LIGHT: "always-light",
    ALWAYS_HEAVY: "always-heavy",
} as const

export type ReviewDepthStrategy =
    (typeof REVIEW_DEPTH_STRATEGY)[keyof typeof REVIEW_DEPTH_STRATEGY]

/**
 * Category descriptions for review prompt overrides.
 */
export interface IReviewPromptOverrideCategoryDescriptionsDTO {
    readonly bug?: string
    readonly performance?: string
    readonly security?: string
}

/**
 * Categories section for review prompt overrides.
 */
export interface IReviewPromptOverrideCategoriesDTO {
    readonly descriptions?: IReviewPromptOverrideCategoryDescriptionsDTO
}

/**
 * Severity flags for review prompt overrides.
 */
export interface IReviewPromptOverrideSeverityFlagsDTO {
    readonly critical?: string
    readonly high?: string
    readonly medium?: string
    readonly low?: string
}

/**
 * Severity section for review prompt overrides.
 */
export interface IReviewPromptOverrideSeverityDTO {
    readonly flags?: IReviewPromptOverrideSeverityFlagsDTO
}

/**
 * Generation section for review prompt overrides.
 */
export interface IReviewPromptOverrideGenerationDTO {
    readonly main?: string
}

/**
 * Templates section for review prompt overrides.
 */
export interface IReviewPromptOverrideTemplatesDTO {
    readonly hallucinationCheck?: string
}

/**
 * Structured prompt overrides for review pipeline.
 */
export interface IReviewPromptOverridesDTO {
    readonly categories?: IReviewPromptOverrideCategoriesDTO
    readonly severity?: IReviewPromptOverrideSeverityDTO
    readonly generation?: IReviewPromptOverrideGenerationDTO
    readonly templates?: IReviewPromptOverrideTemplatesDTO
}

/**
 * Fully resolved and validated review config payload.
 *
 * Index signature keeps backward-compatible extensibility for adapter-specific
 * configuration flags that are not part of core review contract.
 */
export type ValidatedConfig = IReviewConfigDTO & {
    readonly [key: string]: unknown
}

/**
 * Explicit rule-selection layer for review config hierarchy.
 */
export interface IReviewRuleSelectionDTO {
    readonly globalRuleIds?: readonly string[]
    readonly organizationRuleIds?: readonly string[]
}

/**
 * Review configuration snapshot used across application boundaries.
 *
 * This DTO intentionally uses only primitive values and arrays of primitives.
 */
export interface IReviewConfigDTO extends IReviewRuleSelectionDTO {
    readonly severityThreshold: string
    readonly ignorePaths: readonly string[]
    readonly maxSuggestionsPerFile: number
    readonly maxSuggestionsPerCCR: number
    readonly autoCreateIssues?: boolean
    readonly cadence: string
    readonly customRuleIds: readonly string[]
    readonly reviewDepthStrategy?: ReviewDepthStrategy
    readonly directories?: readonly IDirectoryConfig[]
    readonly promptOverrides?: IReviewPromptOverridesDTO
}
