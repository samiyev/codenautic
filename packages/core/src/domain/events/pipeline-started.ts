import {BaseDomainEvent, type DomainEventPayload} from "./base-domain-event"

/**
 * Pipeline start lifecycle payload.
 */
export interface IPipelineStartedPayload extends DomainEventPayload {
    runId: string
    definitionVersion: string
    startedStageId: string
}

/**
 * Event emitted when pipeline run starts.
 */
export class PipelineStarted extends BaseDomainEvent<IPipelineStartedPayload> {
    /**
     * Creates PipelineStarted event.
     *
     * @param aggregateId Aggregate identifier.
     * @param payload Event payload.
     * @param occurredAt Optional event timestamp.
     */
    public constructor(
        aggregateId: string,
        payload: IPipelineStartedPayload,
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
        return "PipelineStarted"
    }
}
