import type {ISuggestionDTO} from "../../dto/review/suggestion.dto"
import type {
    IPipelineStageUseCase,
    IStageCommand,
    IStageTransition,
} from "../../types/review/pipeline-stage.contract"
import {StageError} from "../../../domain/errors/stage.error"
import {RiskScore} from "../../../domain/value-objects/risk-score.value-object"
import {Result} from "../../../shared/result"
import {
    INITIAL_STAGE_ATTEMPT,
    isPipelineCollectionItem,
    mergeExternalContext,
    readStringField,
} from "./pipeline-stage-state.utils"

const CRITICAL_SEVERITY = "CRITICAL"
const HIGH_SEVERITY = "HIGH"
const MEDIUM_SEVERITY = "MEDIUM"
const LOW_SEVERITY = "LOW"
const MAX_FACTOR_SCORE = 100
const ISSUE_FACTOR_STEP = 10
const FILE_FACTOR_STEP = 5
const HOTSPOT_FACTOR_STEP = 10
const INCIDENT_FACTOR_STEP = 20
const CRITICAL_COMPLEXITY_WEIGHT = 25
const HIGH_COMPLEXITY_WEIGHT = 15
const MEDIUM_COMPLEXITY_WEIGHT = 5
const LOW_COMPLEXITY_WEIGHT = 2

/**
 * Constructor dependencies for aggregate-results stage use case.
 */
export interface IAggregateResultsStageDependencies {
    now?: () => Date
}

interface ITokenUsageSummary {
    input: number
    output: number
    total: number
}

interface ISuggestionStringFields {
    readonly id: string
    readonly filePath: string
    readonly severity: string
    readonly category: string
    readonly message: string
}

interface ISuggestionMetaFields {
    readonly lineStart: number
    readonly lineEnd: number
    readonly committable: boolean
    readonly rankScore: number
}

/**
 * Stage 15 use case. Aggregates suggestions, token usage, and risk metrics.
 */
export class AggregateResultsStageUseCase implements IPipelineStageUseCase {
    public readonly stageId: string
    public readonly stageName: string

    private readonly nowProvider: () => Date

    /**
     * Creates aggregate-results stage use case.
     *
     * @param dependencies Stage dependencies.
     */
    public constructor(dependencies: IAggregateResultsStageDependencies = {}) {
        this.stageId = "aggregate-results"
        this.stageName = "Aggregate Results"
        this.nowProvider = dependencies.now ?? (() => new Date())
    }

    /**
     * Aggregates result metrics for downstream summary/finalization stages.
     *
     * @param input Stage command payload.
     * @returns Updated stage transition.
     */
    public execute(input: IStageCommand): Promise<Result<IStageTransition, StageError>> {
        try {
            const suggestions = this.normalizeSuggestions(input.state.suggestions)
            const severityDistribution = this.countBySeverity(suggestions)
            const tokenUsage = this.resolveTokenUsage(input.state.externalContext)
            const riskScore = this.calculateRiskScore(
                suggestions,
                input.state.files.length,
                severityDistribution,
                input.state.externalContext,
            )
            const aggregatedAt = this.nowProvider().toISOString()
            const metrics = {
                issueCount: suggestions.length,
                severityDistribution,
                tokenUsage,
                riskScore: riskScore.value,
                riskLevel: riskScore.level,
                fileCount: input.state.files.length,
                aggregatedAt,
            }

            return Promise.resolve(
                Result.ok<IStageTransition, StageError>({
                    state: input.state.with({
                        metrics: this.mergeMetrics(input.state.metrics, metrics),
                        externalContext: mergeExternalContext(input.state.externalContext, {
                            aggregatedResults: metrics,
                        }),
                    }),
                    metadata: {
                        checkpointHint: "results:aggregated",
                    },
                }),
            )
        } catch (error: unknown) {
            return Promise.resolve(
                Result.fail<IStageTransition, StageError>(
                    this.createStageError(
                        input.state.runId,
                        input.state.definitionVersion,
                        "Failed to aggregate review results",
                        true,
                        error instanceof Error ? error : undefined,
                    ),
                ),
            )
        }
    }

    /**
     * Normalizes state suggestions to typed DTO list.
     *
     * @param source Source suggestions payload.
     * @returns Typed suggestion list.
     */
    private normalizeSuggestions(source: readonly unknown[]): ISuggestionDTO[] {
        const suggestions: ISuggestionDTO[] = []

        for (const item of source) {
            if (!isPipelineCollectionItem(item)) {
                continue
            }

            const suggestion = this.mapSuggestion(item)
            if (suggestion === null) {
                continue
            }

            suggestions.push(suggestion)
        }

        return suggestions
    }

    /**
     * Maps one raw suggestion payload to typed DTO.
     *
     * @param source Raw suggestion payload.
     * @returns Typed suggestion or null.
     */
    private mapSuggestion(source: Readonly<Record<string, unknown>>): ISuggestionDTO | null {
        const stringFields = this.readSuggestionStringFields(source)
        if (stringFields === null) {
            return null
        }

        const metaFields = this.readSuggestionMetaFields(source)
        if (metaFields === null) {
            return null
        }

        return {
            id: stringFields.id,
            filePath: stringFields.filePath,
            lineStart: metaFields.lineStart,
            lineEnd: metaFields.lineEnd,
            severity: stringFields.severity,
            category: stringFields.category,
            message: stringFields.message,
            codeBlock: this.readCodeBlock(source),
            committable: metaFields.committable,
            rankScore: metaFields.rankScore,
        }
    }

    /**
     * Reads required suggestion string fields.
     *
     * @param source Raw suggestion payload.
     * @returns String fields payload or null.
     */
    private readSuggestionStringFields(
        source: Readonly<Record<string, unknown>>,
    ): ISuggestionStringFields | null {
        const id = readStringField(source, "id")
        const filePath = readStringField(source, "filePath")
        const severity = readStringField(source, "severity")
        const category = readStringField(source, "category")
        const message = readStringField(source, "message")
        if (
            id === undefined ||
            filePath === undefined ||
            severity === undefined ||
            category === undefined ||
            message === undefined
        ) {
            return null
        }

        return {
            id,
            filePath,
            severity,
            category,
            message,
        }
    }

    /**
     * Reads required suggestion numeric and boolean fields.
     *
     * @param source Raw suggestion payload.
     * @returns Metadata fields payload or null.
     */
    private readSuggestionMetaFields(source: Readonly<Record<string, unknown>>): ISuggestionMetaFields | null {
        const lineStart = source["lineStart"]
        const lineEnd = source["lineEnd"]
        const committable = source["committable"]
        const rankScore = source["rankScore"]
        if (
            typeof lineStart !== "number" ||
            typeof lineEnd !== "number" ||
            typeof committable !== "boolean" ||
            typeof rankScore !== "number"
        ) {
            return null
        }

        return {
            lineStart,
            lineEnd,
            committable,
            rankScore,
        }
    }

    /**
     * Reads optional code block from suggestion payload.
     *
     * @param source Raw suggestion payload.
     * @returns Trimmed code block when present.
     */
    private readCodeBlock(source: Readonly<Record<string, unknown>>): string | undefined {
        const rawCodeBlock = source["codeBlock"]
        if (typeof rawCodeBlock !== "string") {
            return undefined
        }

        const normalizedCodeBlock = rawCodeBlock.trim()
        if (normalizedCodeBlock.length === 0) {
            return undefined
        }

        return normalizedCodeBlock
    }

    /**
     * Counts suggestions by normalized severity.
     *
     * @param suggestions Source suggestions.
     * @returns Severity distribution map.
     */
    private countBySeverity(suggestions: readonly ISuggestionDTO[]): Readonly<Record<string, number>> {
        const distribution: Record<string, number> = {}

        for (const suggestion of suggestions) {
            const key = suggestion.severity.trim().toUpperCase()
            const currentValue = distribution[key]
            distribution[key] = currentValue === undefined ? 1 : currentValue + 1
        }

        return distribution
    }

    /**
     * Resolves accumulated token usage from external context.
     *
     * @param externalContext External context payload.
     * @returns Token usage summary.
     */
    private resolveTokenUsage(
        externalContext: Readonly<Record<string, unknown>> | null,
    ): ITokenUsageSummary {
        const summary: ITokenUsageSummary = {
            input: 0,
            output: 0,
            total: 0,
        }
        if (externalContext === null) {
            return summary
        }

        const sources = [
            externalContext["tokenUsage"],
            externalContext["ccrTokenUsage"],
            externalContext["fileTokenUsage"],
        ]
        for (const source of sources) {
            this.addTokenUsage(summary, source)
        }

        const byStage = externalContext["tokenUsageByStage"]
        if (Array.isArray(byStage)) {
            for (const stageUsage of byStage) {
                this.addTokenUsage(summary, stageUsage)
            }
        }

        return summary
    }

    /**
     * Adds one token usage entry to summary when shape is valid.
     *
     * @param summary Mutable summary accumulator.
     * @param source Token usage source payload.
     */
    private addTokenUsage(summary: ITokenUsageSummary, source: unknown): void {
        if (source === null || typeof source !== "object" || Array.isArray(source)) {
            return
        }

        const record = source as Readonly<Record<string, unknown>>
        const input = record["input"]
        const output = record["output"]
        const total = record["total"]
        if (typeof input !== "number" || typeof output !== "number" || typeof total !== "number") {
            return
        }

        summary.input += input
        summary.output += output
        summary.total += total
    }

    /**
     * Calculates weighted risk score from stage aggregation metrics.
     *
     * @param suggestions Aggregated suggestions.
     * @param fileCount File count in review.
     * @param severityDistribution Severity distribution.
     * @param externalContext External context payload.
     * @returns Risk score value object.
     */
    private calculateRiskScore(
        suggestions: readonly ISuggestionDTO[],
        fileCount: number,
        severityDistribution: Readonly<Record<string, number>>,
        externalContext: Readonly<Record<string, unknown>> | null,
    ): RiskScore {
        const criticalCount = this.readDistributionValue(severityDistribution, CRITICAL_SEVERITY)
        const highCount = this.readDistributionValue(severityDistribution, HIGH_SEVERITY)
        const mediumCount = this.readDistributionValue(severityDistribution, MEDIUM_SEVERITY)
        const lowCount = this.readDistributionValue(severityDistribution, LOW_SEVERITY)
        const issuesFactor = clampToFactorRange(suggestions.length * ISSUE_FACTOR_STEP)
        const sizeFactor = clampToFactorRange(fileCount * FILE_FACTOR_STEP)
        const complexityFactor = clampToFactorRange(
            criticalCount * CRITICAL_COMPLEXITY_WEIGHT +
                highCount * HIGH_COMPLEXITY_WEIGHT +
                mediumCount * MEDIUM_COMPLEXITY_WEIGHT +
                lowCount * LOW_COMPLEXITY_WEIGHT,
        )
        const hotspotsFactor = clampToFactorRange(
            this.countUniqueFiles(suggestions) * HOTSPOT_FACTOR_STEP,
        )
        const historyFactor = clampToFactorRange(
            this.resolveOperationalIncidents(externalContext) * INCIDENT_FACTOR_STEP,
        )

        return RiskScore.calculate({
            issues: issuesFactor,
            size: sizeFactor,
            complexity: complexityFactor,
            hotspots: hotspotsFactor,
            history: historyFactor,
        })
    }

    /**
     * Reads one severity bucket value.
     *
     * @param distribution Severity distribution.
     * @param key Severity key.
     * @returns Bucket value.
     */
    private readDistributionValue(distribution: Readonly<Record<string, number>>, key: string): number {
        const value = distribution[key]
        if (typeof value !== "number") {
            return 0
        }

        return value
    }

    /**
     * Counts unique files referenced by suggestions.
     *
     * @param suggestions Source suggestions.
     * @returns Unique file count.
     */
    private countUniqueFiles(suggestions: readonly ISuggestionDTO[]): number {
        const files = new Set<string>()
        for (const suggestion of suggestions) {
            files.add(suggestion.filePath)
        }

        return files.size
    }

    /**
     * Resolves operational incidents from file review stats.
     *
     * @param externalContext External context payload.
     * @returns Incident count.
     */
    private resolveOperationalIncidents(externalContext: Readonly<Record<string, unknown>> | null): number {
        if (externalContext === null) {
            return 0
        }

        const stats = externalContext["fileReviewStats"]
        if (stats === null || typeof stats !== "object" || Array.isArray(stats)) {
            return 0
        }

        const record = stats as Readonly<Record<string, unknown>>
        const timedOutFiles = record["timedOutFiles"]
        const failedFiles = record["failedFiles"]
        const timedOutCount = typeof timedOutFiles === "number" ? timedOutFiles : 0
        const failedCount = typeof failedFiles === "number" ? failedFiles : 0

        return timedOutCount + failedCount
    }

    /**
     * Merges computed metrics with existing state metrics payload.
     *
     * @param current Existing metrics payload.
     * @param metrics Computed metrics payload.
     * @returns Merged metrics payload.
     */
    private mergeMetrics(
        current: Readonly<Record<string, unknown>> | null,
        metrics: Readonly<Record<string, unknown>>,
    ): Readonly<Record<string, unknown>> {
        if (current === null) {
            return {
                ...metrics,
            }
        }

        return {
            ...current,
            ...metrics,
        }
    }

    /**
     * Creates normalized stage error payload.
     *
     * @param runId Pipeline run id.
     * @param definitionVersion Pinned definition version.
     * @param message Error message.
     * @param recoverable Recoverable flag.
     * @param originalError Optional wrapped error.
     * @returns Stage error.
     */
    private createStageError(
        runId: string,
        definitionVersion: string,
        message: string,
        recoverable: boolean,
        originalError?: Error,
    ): StageError {
        return new StageError({
            runId,
            definitionVersion,
            stageId: this.stageId,
            attempt: INITIAL_STAGE_ATTEMPT,
            recoverable,
            message,
            originalError,
        })
    }
}

/**
 * Clamps numeric value to risk factor range.
 *
 * @param value Raw factor value.
 * @returns Value in inclusive range 0..100.
 */
function clampToFactorRange(value: number): number {
    if (value < 0) {
        return 0
    }

    if (value > MAX_FACTOR_SCORE) {
        return MAX_FACTOR_SCORE
    }

    return value
}
