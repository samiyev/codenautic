import {BaseDomainEvent, type DomainEventPayload} from "./base-domain-event"

/**
 * Stage start lifecycle payload.
 */
export interface IStageStartedPayload extends DomainEventPayload {
    runId: string
    definitionVersion: string
    stageId: string
    attempt: number
}

/**
 * Event emitted when stage execution starts.
 */
export class StageStarted extends BaseDomainEvent<IStageStartedPayload> {
    /**
     * Creates StageStarted event.
     *
     * @param aggregateId Aggregate identifier.
     * @param payload Event payload.
     * @param occurredAt Optional event timestamp.
     */
    public constructor(aggregateId: string, payload: IStageStartedPayload, occurredAt?: Date) {
        super(aggregateId, payload, occurredAt)
    }

    /**
     * Resolves event name.
     *
     * @returns Event name literal.
     */
    protected resolveEventName(): string {
        return "StageStarted"
    }
}
