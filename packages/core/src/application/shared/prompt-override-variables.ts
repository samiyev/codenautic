/**
 * Review override payload source for prompt variables.
 */
export interface IReviewOverrideVariableSource {
    readonly categories: {
        readonly descriptions: {
            readonly bug: string
            readonly performance: string
            readonly security: string
        }
    }
    readonly severity: {
        readonly flags: {
            readonly critical: string
            readonly high: string
            readonly medium: string
            readonly low: string
        }
    }
    readonly generation: {
        readonly main: string
    }
}

/**
 * Mapping from prompt variable names to override values.
 */
export const OVERRIDE_VARIABLE_MAP = {
    bugText: (overrides: IReviewOverrideVariableSource) => overrides.categories.descriptions.bug,
    perfText: (overrides: IReviewOverrideVariableSource) => overrides.categories.descriptions.performance,
    secText: (overrides: IReviewOverrideVariableSource) => overrides.categories.descriptions.security,
    criticalText: (overrides: IReviewOverrideVariableSource) => overrides.severity.flags.critical,
    highText: (overrides: IReviewOverrideVariableSource) => overrides.severity.flags.high,
    mediumText: (overrides: IReviewOverrideVariableSource) => overrides.severity.flags.medium,
    lowText: (overrides: IReviewOverrideVariableSource) => overrides.severity.flags.low,
    mainGenText: (overrides: IReviewOverrideVariableSource) => overrides.generation.main,
} as const

/**
 * Prompt override variable keys.
 */
export type ReviewOverrideVariable = keyof typeof OVERRIDE_VARIABLE_MAP

/**
 * Maps review overrides to prompt template variables.
 *
 * @param overrides Review overrides payload.
 * @param variables Variable keys to resolve.
 * @returns Record of prompt variables with override values.
 */
export function mapOverridesToVariables(
    overrides: IReviewOverrideVariableSource,
    variables: readonly ReviewOverrideVariable[],
): Record<string, unknown> {
    const resolved: Record<string, unknown> = {}

    for (const variable of variables) {
        resolved[variable] = OVERRIDE_VARIABLE_MAP[variable](overrides)
    }

    return resolved
}
