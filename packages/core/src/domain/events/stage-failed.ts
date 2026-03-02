import {BaseDomainEvent, type DomainEventPayload} from "./base-domain-event"

/**
 * Stage failure lifecycle payload.
 */
export interface IStageFailedPayload extends DomainEventPayload {
    runId: string
    definitionVersion: string
    stageId: string
    attempt: number
    recoverable: boolean
    errorCode: string
}

/**
 * Event emitted when stage execution fails.
 */
export class StageFailed extends BaseDomainEvent<IStageFailedPayload> {
    /**
     * Creates StageFailed event.
     *
     * @param aggregateId Aggregate identifier.
     * @param payload Event payload.
     * @param occurredAt Optional event timestamp.
     */
    public constructor(aggregateId: string, payload: IStageFailedPayload, occurredAt?: Date) {
        super(aggregateId, payload, occurredAt)
    }

    /**
     * Resolves event name.
     *
     * @returns Event name literal.
     */
    protected resolveEventName(): string {
        return "StageFailed"
    }
}
