import {BaseDomainEvent, type DomainEventPayload} from "./base-domain-event"

/**
 * Pipeline completion lifecycle payload.
 */
export interface IPipelineCompletedPayload extends DomainEventPayload {
    runId: string
    definitionVersion: string
    totalDurationMs: number
    stageCount: number
}

/**
 * Event emitted when pipeline run is completed.
 */
export class PipelineCompleted extends BaseDomainEvent<IPipelineCompletedPayload> {
    /**
     * Creates PipelineCompleted event.
     *
     * @param aggregateId Aggregate identifier.
     * @param payload Event payload.
     * @param occurredAt Optional event timestamp.
     */
    public constructor(
        aggregateId: string,
        payload: IPipelineCompletedPayload,
        occurredAt?: Date,
    ) {
        super(aggregateId, payload, occurredAt)
    }

    /**
     * Resolves event name.
     *
     * @returns Event name literal.
     */
    protected resolveEventName(): string {
        return "PipelineCompleted"
    }
}
