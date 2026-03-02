import {BaseDomainEvent, type DomainEventPayload} from "./base-domain-event"

/**
 * Stage completion lifecycle payload.
 */
export interface IStageCompletedPayload extends DomainEventPayload {
    runId: string
    definitionVersion: string
    stageId: string
    attempt: number
    durationMs: number
}

/**
 * Event emitted when stage execution completes.
 */
export class StageCompleted extends BaseDomainEvent<IStageCompletedPayload> {
    /**
     * Creates StageCompleted event.
     *
     * @param aggregateId Aggregate identifier.
     * @param payload Event payload.
     * @param occurredAt Optional event timestamp.
     */
    public constructor(aggregateId: string, payload: IStageCompletedPayload, occurredAt?: Date) {
        super(aggregateId, payload, occurredAt)
    }

    /**
     * Resolves event name.
     *
     * @returns Event name literal.
     */
    protected resolveEventName(): string {
        return "StageCompleted"
    }
}
