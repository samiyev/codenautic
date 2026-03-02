import type {
    IPendingDomainEventEnvelope,
} from "../../types/review/pending-domain-event.contract"
import type {
    IPipelineStageUseCase,
    IStageCommand,
    IStageTransition,
} from "../../types/review/pipeline-stage.contract"
import {StageError} from "../../../domain/errors/stage.error"
import {Result} from "../../../shared/result"
import {INITIAL_STAGE_ATTEMPT, mergeExternalContext} from "./pipeline-stage-state.utils"

/**
 * Constructor dependencies for update-metrics stage.
 */
export interface IUpdateMetricsStageDependencies {
    now?: () => Date
}

/**
 * Stage 19 use case. Persists final metrics and appends MetricsCalculated event envelope.
 */
export class UpdateMetricsStageUseCase implements IPipelineStageUseCase {
    public readonly stageId: string
    public readonly stageName: string

    private readonly nowProvider: () => Date

    /**
     * Creates update-metrics stage use case.
     *
     * @param dependencies Stage dependencies.
     */
    public constructor(dependencies: IUpdateMetricsStageDependencies = {}) {
        this.stageId = "update-metrics"
        this.stageName = "Update Metrics"
        this.nowProvider = dependencies.now ?? (() => new Date())
    }

    /**
     * Updates metrics payload and appends serializable metrics event envelope.
     *
     * @param input Stage command payload.
     * @returns Updated stage transition or stage error.
     */
    public execute(input: IStageCommand): Promise<Result<IStageTransition, StageError>> {
        try {
            const now = this.nowProvider()
            const tokenUsage = this.resolveTokenUsage(input.state.metrics)
            const duration = this.resolveDuration(input.state.externalContext, now)
            const issueCount = this.resolveIssueCount(input.state.metrics)
            const riskScore = this.resolveRiskScore(input.state.metrics)
            const costEstimate = this.calculateCostEstimate(tokenUsage.total, input.state.config)
            const nextMetrics = {
                ...(input.state.metrics ?? {}),
                duration,
                issueCount,
                riskScore,
                tokenUsage,
                costEstimate,
                metricsUpdatedAt: now.toISOString(),
            }
            const pendingEvents = this.resolvePendingEvents(input.state.externalContext)
            const metricsEvent = this.createMetricsCalculatedEnvelope(
                input.state.runId,
                tokenUsage,
                costEstimate,
                duration,
                now,
            )

            return Promise.resolve(
                Result.ok<IStageTransition, StageError>({
                    state: input.state.with({
                        metrics: nextMetrics,
                        externalContext: mergeExternalContext(input.state.externalContext, {
                            pendingDomainEvents: [...pendingEvents, metricsEvent],
                        }),
                    }),
                    metadata: {
                        checkpointHint: "metrics:updated",
                    },
                }),
            )
        } catch (error: unknown) {
            return Promise.resolve(
                Result.fail<IStageTransition, StageError>(
                    this.createStageError(
                        input.state.runId,
                        input.state.definitionVersion,
                        "Failed to update metrics stage payload",
                        true,
                        error instanceof Error ? error : undefined,
                    ),
                ),
            )
        }
    }

    /**
     * Resolves issue count from metrics payload.
     *
     * @param metrics Metrics payload.
     * @returns Issue count.
     */
    private resolveIssueCount(metrics: Readonly<Record<string, unknown>> | null): number {
        if (metrics === null) {
            return 0
        }

        const issueCount = metrics["issueCount"]
        if (typeof issueCount !== "number") {
            return 0
        }

        return issueCount
    }

    /**
     * Resolves risk score from metrics payload.
     *
     * @param metrics Metrics payload.
     * @returns Risk score value.
     */
    private resolveRiskScore(metrics: Readonly<Record<string, unknown>> | null): number {
        if (metrics === null) {
            return 0
        }

        const riskScore = metrics["riskScore"]
        if (typeof riskScore !== "number") {
            return 0
        }

        return riskScore
    }

    /**
     * Resolves summary token usage from metrics payload.
     *
     * @param metrics Metrics payload.
     * @returns Token usage summary.
     */
    private resolveTokenUsage(
        metrics: Readonly<Record<string, unknown>> | null,
    ): {input: number; output: number; total: number} {
        if (metrics === null) {
            return {
                input: 0,
                output: 0,
                total: 0,
            }
        }

        const tokenUsage = metrics["tokenUsage"]
        if (tokenUsage === null || typeof tokenUsage !== "object" || Array.isArray(tokenUsage)) {
            return {
                input: 0,
                output: 0,
                total: 0,
            }
        }

        const input = (tokenUsage as Readonly<Record<string, unknown>>)["input"]
        const output = (tokenUsage as Readonly<Record<string, unknown>>)["output"]
        const total = (tokenUsage as Readonly<Record<string, unknown>>)["total"]

        return {
            input: typeof input === "number" ? input : 0,
            output: typeof output === "number" ? output : 0,
            total: typeof total === "number" ? total : 0,
        }
    }

    /**
     * Resolves review duration in milliseconds from context start timestamps.
     *
     * @param externalContext External context payload.
     * @param now Current timestamp.
     * @returns Duration in milliseconds.
     */
    private resolveDuration(
        externalContext: Readonly<Record<string, unknown>> | null,
        now: Date,
    ): number {
        const startAt = this.resolveStartTimestamp(externalContext)
        if (startAt === null) {
            return 0
        }

        const duration = now.getTime() - startAt.getTime()
        if (duration < 0) {
            return 0
        }

        return duration
    }

    /**
     * Resolves optional start timestamp from external context.
     *
     * @param externalContext External context payload.
     * @returns Parsed start timestamp or null.
     */
    private resolveStartTimestamp(externalContext: Readonly<Record<string, unknown>> | null): Date | null {
        if (externalContext === null) {
            return null
        }

        const candidates = [externalContext["pipelineStartedAt"], externalContext["startedAt"]]
        for (const candidate of candidates) {
            if (typeof candidate !== "string") {
                continue
            }

            const parsedDate = new Date(candidate)
            if (!Number.isNaN(parsedDate.getTime())) {
                return parsedDate
            }
        }

        return null
    }

    /**
     * Calculates cost estimate from token usage and config price.
     *
     * @param totalTokens Total token count.
     * @param config Config payload.
     * @returns Cost estimate.
     */
    private calculateCostEstimate(totalTokens: number, config: Readonly<Record<string, unknown>>): number {
        const tokenCostPerThousand = config["tokenCostPerThousand"]
        if (typeof tokenCostPerThousand !== "number") {
            return 0
        }

        return (totalTokens / 1000) * tokenCostPerThousand
    }

    /**
     * Resolves previously queued pending domain events.
     *
     * @param externalContext External context payload.
     * @returns Pending domain events list.
     */
    private resolvePendingEvents(
        externalContext: Readonly<Record<string, unknown>> | null,
    ): readonly IPendingDomainEventEnvelope[] {
        if (externalContext === null) {
            return []
        }

        const pendingEvents = externalContext["pendingDomainEvents"]
        if (!Array.isArray(pendingEvents)) {
            return []
        }

        const events: IPendingDomainEventEnvelope[] = []
        for (const pendingEvent of pendingEvents) {
            if (this.isPendingEventEnvelope(pendingEvent)) {
                events.push(pendingEvent)
            }
        }

        return events
    }

    /**
     * Creates serializable MetricsCalculated event envelope.
     *
     * @param reviewId Review identifier.
     * @param tokenUsage Token usage summary.
     * @param costEstimate Cost estimate.
     * @param duration Duration in milliseconds.
     * @param occurredAt Event timestamp.
     * @returns Event envelope.
     */
    private createMetricsCalculatedEnvelope(
        reviewId: string,
        tokenUsage: {input: number; output: number; total: number},
        costEstimate: number,
        duration: number,
        occurredAt: Date,
    ): IPendingDomainEventEnvelope {
        return {
            eventName: "MetricsCalculated",
            aggregateId: reviewId,
            occurredAt: occurredAt.toISOString(),
            payload: {
                reviewId,
                tokenUsage: {
                    inputTokens: tokenUsage.input,
                    outputTokens: tokenUsage.output,
                    totalTokens: tokenUsage.total,
                },
                costEstimate,
                duration,
            },
        }
    }

    /**
     * Validates serializable event envelope structure.
     *
     * @param value Candidate value.
     * @returns True when candidate is valid envelope.
     */
    private isPendingEventEnvelope(value: unknown): value is IPendingDomainEventEnvelope {
        if (value === null || typeof value !== "object" || Array.isArray(value)) {
            return false
        }

        const record = value as Readonly<Record<string, unknown>>
        return (
            typeof record["eventName"] === "string" &&
            typeof record["aggregateId"] === "string" &&
            typeof record["occurredAt"] === "string" &&
            record["payload"] !== null &&
            typeof record["payload"] === "object" &&
            !Array.isArray(record["payload"])
        )
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
