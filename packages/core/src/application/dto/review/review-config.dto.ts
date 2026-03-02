/**
 * Optional prompt overrides for review pipeline stages.
 */
export interface IReviewPromptOverridesDTO {
    readonly systemPrompt?: string
    readonly reviewerPrompt?: string
    readonly summaryPrompt?: string
}

/**
 * Review configuration snapshot used across application boundaries.
 *
 * This DTO intentionally uses only primitive values and arrays of primitives.
 */
export interface IReviewConfigDTO {
    readonly severityThreshold: string
    readonly ignorePaths: readonly string[]
    readonly maxSuggestionsPerFile: number
    readonly maxSuggestionsPerCCR: number
    readonly cadence: string
    readonly customRuleIds: readonly string[]
    readonly promptOverrides?: IReviewPromptOverridesDTO
}
