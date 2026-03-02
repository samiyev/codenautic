import {BaseDomainEvent, type DomainEventPayload} from "./base-domain-event"

/**
 * Pipeline failure lifecycle payload.
 */
export interface IPipelineFailedPayload extends DomainEventPayload {
    runId: string
    definitionVersion: string
    failedStageId: string
    terminal: boolean
    reason: string
}

/**
 * Event emitted when pipeline run fails.
 */
export class PipelineFailed extends BaseDomainEvent<IPipelineFailedPayload> {
    /**
     * Creates PipelineFailed event.
     *
     * @param aggregateId Aggregate identifier.
     * @param payload Event payload.
     * @param occurredAt Optional event timestamp.
     */
    public constructor(aggregateId: string, payload: IPipelineFailedPayload, occurredAt?: Date) {
        super(aggregateId, payload, occurredAt)
    }

    /**
     * Resolves event name.
     *
     * @returns Event name literal.
     */
    protected resolveEventName(): string {
        return "PipelineFailed"
    }
}
