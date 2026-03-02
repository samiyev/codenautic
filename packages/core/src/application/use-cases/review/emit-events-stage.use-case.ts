import type {IDomainEventBus} from "../../ports/outbound/common/domain-event-bus.port"
import type {IPendingDomainEventEnvelope} from "../../types/review/pending-domain-event.contract"
import type {
    IPipelineStageUseCase,
    IStageCommand,
    IStageTransition,
} from "../../types/review/pipeline-stage.contract"
import {BaseDomainEvent, type DomainEventPayload} from "../../../domain/events/base-domain-event"
import {MetricsCalculated} from "../../../domain/events/metrics-calculated"
import {StageError} from "../../../domain/errors/stage.error"
import {Result} from "../../../shared/result"
import {INITIAL_STAGE_ATTEMPT, mergeExternalContext} from "./pipeline-stage-state.utils"

/**
 * Constructor dependencies for emit-events stage.
 */
export interface IEmitEventsStageDependencies {
    domainEventBus: IDomainEventBus
}

interface IMetricsPayloadProjection {
    readonly reviewId: string
    readonly inputTokens: number
    readonly outputTokens: number
    readonly totalTokens: number
    readonly costEstimate: number
    readonly duration: number
}

/**
 * Stage 20 use case. Publishes queued domain events and clears queue.
 */
export class EmitEventsStageUseCase implements IPipelineStageUseCase {
    public readonly stageId: string
    public readonly stageName: string

    private readonly domainEventBus: IDomainEventBus

    /**
     * Creates emit-events stage use case.
     *
     * @param dependencies Stage dependencies.
     */
    public constructor(dependencies: IEmitEventsStageDependencies) {
        this.stageId = "emit-events"
        this.stageName = "Emit Events"
        this.domainEventBus = dependencies.domainEventBus
    }

    /**
     * Publishes queued domain events and clears pending queue on success.
     *
     * @param input Stage command payload.
     * @returns Updated stage transition or stage error.
     */
    public async execute(input: IStageCommand): Promise<Result<IStageTransition, StageError>> {
        const pendingEvents = this.resolvePendingEvents(input.state.externalContext)
        if (pendingEvents.length === 0) {
            return Result.ok<IStageTransition, StageError>({
                state: input.state,
                metadata: {
                    checkpointHint: "events:skipped-empty",
                    notes: "No pending domain events to publish",
                },
            })
        }

        const mappedEvents = this.mapPendingEvents(pendingEvents)
        if (mappedEvents.publishable.length === 0) {
            return Result.ok<IStageTransition, StageError>({
                state: input.state.with({
                    externalContext: mergeExternalContext(input.state.externalContext, {
                        pendingDomainEvents: [],
                        publishedDomainEvents: {
                            count: 0,
                            skipped: mappedEvents.skippedCount,
                        },
                    }),
                }),
                metadata: {
                    checkpointHint: "events:skipped-unknown",
                    notes: `${mappedEvents.skippedCount} pending events skipped due to unknown schema`,
                },
            })
        }

        try {
            await this.domainEventBus.publish(mappedEvents.publishable)

            return Result.ok<IStageTransition, StageError>({
                state: input.state.with({
                    externalContext: mergeExternalContext(input.state.externalContext, {
                        pendingDomainEvents: [],
                        publishedDomainEvents: {
                            count: mappedEvents.publishable.length,
                            skipped: mappedEvents.skippedCount,
                        },
                    }),
                }),
                metadata: {
                    checkpointHint: "events:published",
                    notes:
                        mappedEvents.skippedCount > 0
                            ? `${mappedEvents.skippedCount} pending events skipped due to unknown schema`
                            : undefined,
                },
            })
        } catch (error: unknown) {
            return Result.fail<IStageTransition, StageError>(
                this.createStageError(
                    input.state.runId,
                    input.state.definitionVersion,
                    "Failed to publish queued domain events",
                    true,
                    error instanceof Error ? error : undefined,
                ),
            )
        }
    }

    /**
     * Resolves pending event envelopes from external context payload.
     *
     * @param externalContext External context payload.
     * @returns Pending event envelopes.
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

        const envelopes: IPendingDomainEventEnvelope[] = []
        for (const pendingEvent of pendingEvents) {
            if (this.isPendingEventEnvelope(pendingEvent)) {
                envelopes.push(pendingEvent)
            }
        }

        return envelopes
    }

    /**
     * Maps pending envelopes into publishable domain events.
     *
     * @param pendingEvents Pending event envelopes.
     * @returns Publishable and skipped counts.
     */
    private mapPendingEvents(pendingEvents: readonly IPendingDomainEventEnvelope[]): {
        publishable: readonly BaseDomainEvent<DomainEventPayload>[]
        skippedCount: number
    } {
        const publishable: BaseDomainEvent<DomainEventPayload>[] = []
        let skippedCount = 0

        for (const pendingEvent of pendingEvents) {
            const event = this.mapPendingEvent(pendingEvent)
            if (event === null) {
                skippedCount += 1
                continue
            }

            publishable.push(event)
        }

        return {
            publishable,
            skippedCount,
        }
    }

    /**
     * Maps one pending envelope to domain event instance.
     *
     * @param pendingEvent Pending event envelope.
     * @returns Domain event instance or null when unsupported.
     */
    private mapPendingEvent(
        pendingEvent: IPendingDomainEventEnvelope,
    ): BaseDomainEvent<DomainEventPayload> | null {
        if (pendingEvent.eventName !== "MetricsCalculated") {
            return null
        }

        const metricsPayload = this.readMetricsPayload(pendingEvent.payload)
        if (metricsPayload === null) {
            return null
        }

        const occurredAt = this.parseOccurredAt(pendingEvent.occurredAt)
        if (occurredAt === null) {
            return null
        }

        return new MetricsCalculated(
            pendingEvent.aggregateId,
            {
                reviewId: metricsPayload.reviewId,
                tokenUsage: {
                    inputTokens: metricsPayload.inputTokens,
                    outputTokens: metricsPayload.outputTokens,
                    totalTokens: metricsPayload.totalTokens,
                },
                costEstimate: metricsPayload.costEstimate,
                duration: metricsPayload.duration,
            },
            occurredAt,
        )
    }

    /**
     * Reads normalized metrics payload projection from envelope payload.
     *
     * @param payload Raw envelope payload.
     * @returns Normalized payload projection or null.
     */
    private readMetricsPayload(
        payload: Readonly<Record<string, unknown>>,
    ): IMetricsPayloadProjection | null {
        const reviewId = payload["reviewId"]
        const tokenUsage = payload["tokenUsage"]
        const costEstimate = payload["costEstimate"]
        const duration = payload["duration"]
        if (
            typeof reviewId !== "string" ||
            typeof costEstimate !== "number" ||
            typeof duration !== "number" ||
            tokenUsage === null ||
            typeof tokenUsage !== "object" ||
            Array.isArray(tokenUsage)
        ) {
            return null
        }

        const inputTokens = (tokenUsage as Readonly<Record<string, unknown>>)["inputTokens"]
        const outputTokens = (tokenUsage as Readonly<Record<string, unknown>>)["outputTokens"]
        const totalTokens = (tokenUsage as Readonly<Record<string, unknown>>)["totalTokens"]
        if (
            typeof inputTokens !== "number" ||
            typeof outputTokens !== "number" ||
            typeof totalTokens !== "number"
        ) {
            return null
        }

        return {
            reviewId,
            inputTokens,
            outputTokens,
            totalTokens,
            costEstimate,
            duration,
        }
    }

    /**
     * Parses occurred-at timestamp from envelope field.
     *
     * @param occurredAtIso Timestamp string.
     * @returns Parsed date or null.
     */
    private parseOccurredAt(occurredAtIso: string): Date | null {
        const occurredAt = new Date(occurredAtIso)
        if (Number.isNaN(occurredAt.getTime())) {
            return null
        }

        return occurredAt
    }

    /**
     * Validates pending event envelope shape.
     *
     * @param value Candidate value.
     * @returns True when value is a valid pending envelope.
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
