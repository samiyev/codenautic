import type {
    IHeuristicResolutionMode,
    IHeuristicRiskLevel,
    IHeuristicVerificationRule,
} from "../heuristics/heuristic-registry-entry.dto"

/**
 * Heuristics metadata transported with imported rules.
 */
export interface IImportedRuleHeuristicsMetadata {
    readonly heuristicsSchemaVersion: number
    readonly ruleUuid: string
    readonly resolutionMode: IHeuristicResolutionMode
    readonly verificationRule: IHeuristicVerificationRule
    readonly falsePositiveRisk: IHeuristicRiskLevel
    readonly evidenceLevel: string
}
