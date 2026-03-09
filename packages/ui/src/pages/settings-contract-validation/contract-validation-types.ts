/**
 * Type of contract payload: rules library or theme library.
 */
export type TContractType = "rules-library" | "theme-library"

/**
 * Envelope wrapper for import/export contract payloads.
 */
export interface IContractEnvelope {
    readonly schema: string
    readonly version: number
    readonly type: TContractType
    readonly payload: unknown
}

/**
 * Result of contract envelope validation including errors and migration hints.
 */
export interface IValidationResult {
    readonly errors: ReadonlyArray<string>
    readonly migrationHints: ReadonlyArray<string>
    readonly normalizedEnvelope?: IContractEnvelope
}

/**
 * Single node in parsed blueprint YAML tree structure.
 */
export interface IBlueprintNode {
    readonly id: string
    readonly depth: number
    readonly kind: "layer" | "rule" | "metadata"
    readonly label: string
    readonly value?: string
}

/**
 * Single line in the blueprint syntax highlight preview.
 */
export interface IBlueprintHighlightLine {
    readonly id: string
    readonly indent: number
    readonly key?: string
    readonly value?: string
    readonly comment?: string
}

/**
 * Result of blueprint YAML validation with errors and visual nodes.
 */
export interface IBlueprintValidationResult {
    readonly errors: ReadonlyArray<string>
    readonly nodes: ReadonlyArray<IBlueprintNode>
}

/**
 * Severity level of a drift violation.
 */
export type TDriftSeverity = "critical" | "high" | "medium" | "low"

/**
 * Sort mode for drift violation list.
 */
export type TDriftSortMode = "severity-desc" | "severity-asc" | "files-desc" | "files-asc"

/**
 * Available notification channels for drift alerts.
 */
export type TDriftAlertChannel = "slack" | "email" | "teams" | "webhook"

/**
 * Single drift violation with severity, affected files and rationale.
 */
export interface IDriftViolation {
    readonly id: string
    readonly rule: string
    readonly severity: TDriftSeverity
    readonly affectedFiles: ReadonlyArray<string>
    readonly rationale: string
}

/**
 * Status of an architecture difference between blueprint and reality.
 */
export type TArchitectureDiffStatus = "match" | "missing" | "unexpected"

/**
 * Single node in the architecture structure graph.
 */
export interface IArchitectureStructureNode {
    readonly id: string
    readonly layer: string
    readonly module: string
    readonly dependsOn: ReadonlyArray<string>
}

/**
 * Single difference entry between blueprint and runtime architecture.
 */
export interface IArchitectureDifference {
    readonly id: string
    readonly layer: string
    readonly module: string
    readonly status: TArchitectureDiffStatus
    readonly description: string
}

/**
 * Single data point in the drift score trend chart.
 */
export interface IDriftTrendPoint {
    readonly period: string
    readonly driftScore: number
    readonly architectureChange?: string
}

/**
 * Option descriptor for drift alert notification channel selection.
 */
export interface IDriftAlertChannelOption {
    readonly id: TDriftAlertChannel
    readonly label: string
}

/**
 * Mode of an architecture guardrail rule: allow or forbid.
 */
export type TGuardrailMode = "allow" | "forbid"

/**
 * Single guardrail import rule between source and target layers.
 */
export interface IGuardrailRule {
    readonly id: string
    readonly source: string
    readonly target: string
    readonly mode: TGuardrailMode
}

/**
 * Result of guardrails YAML validation with errors and parsed rules.
 */
export interface IGuardrailValidationResult {
    readonly errors: ReadonlyArray<string>
    readonly rules: ReadonlyArray<IGuardrailRule>
}
