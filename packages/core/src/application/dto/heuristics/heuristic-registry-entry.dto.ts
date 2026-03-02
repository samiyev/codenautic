/**
 * Supported heuristic categories for registry entries.
 */
export type IHeuristicType =
    | "THRESHOLD"
    | "SCORING"
    | "WEIGHTING"
    | "RETRY_BACKOFF"
    | "TIMEOUT"
    | "RANKING"
    | "FALLBACK_DEFAULT"
    | "RATE_LIMIT"
    | "RESOURCE_LIMIT"
    | "DRIFT_SIGNAL"
    | "PREDICTION_CONFIDENCE"
    | "OTHER"

/**
 * Supported heuristic risk levels.
 */
export type IHeuristicRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"

/**
 * Supported resolution modes for heuristic entries.
 */
export type IHeuristicResolutionMode = "ELIMINATE" | "HARDEN" | "KEEP_CODE_FIRST"

/**
 * Supported lifecycle status for heuristic entries.
 */
export type IHeuristicStatus = "UNTRIAGED" | "TRIAGED" | "IMPLEMENTED"

/**
 * Rule describing how a heuristic entry is verified.
 */
export interface IHeuristicVerificationRule {
    readonly name: string
    readonly description: string
    readonly testCommand: string
}

/**
 * Registry entry for a detected heuristic in code, plans, or rule definitions.
 */
export interface IHeuristicRegistryEntry {
    readonly id: string
    readonly sourceFile: string
    readonly sourceLine: number
    readonly heuristicType: IHeuristicType
    readonly currentExpression: string
    readonly riskLevel: IHeuristicRiskLevel
    readonly resolutionMode: IHeuristicResolutionMode
    readonly targetChange: string
    readonly testsRequired: readonly string[]
    readonly ownerPackage: string
    readonly status: IHeuristicStatus
    readonly ruleUuid?: string
    readonly severity?: string
    readonly buckets?: readonly string[]
    readonly falsePositiveRisk?: IHeuristicRiskLevel
    readonly evidenceLevel?: string
    readonly verificationRule?: IHeuristicVerificationRule
}
