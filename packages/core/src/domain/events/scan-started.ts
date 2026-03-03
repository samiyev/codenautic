import {BaseDomainEvent, type DomainEventPayload} from "./base-domain-event"

/**
 * Scan start lifecycle payload.
 */
export interface IScanStartedPayload extends DomainEventPayload {
    readonly repositoryId: string
    readonly scanId: string
    readonly triggeredBy: string
}

/**
 * Event emitted when scan started.
 */
export class ScanStarted extends BaseDomainEvent<IScanStartedPayload> {
    /**
     * Creates ScanStarted event.
     *
     * @param aggregateId Repository aggregate identifier.
     * @param payload Event payload.
     * @param occurredAt Event timestamp.
     */
    public constructor(aggregateId: string, payload: IScanStartedPayload, occurredAt?: Date) {
        super(aggregateId, payload, occurredAt)
    }

    /**
     * Resolves event name.
     *
     * @returns Event name literal.
     */
    protected resolveEventName(): string {
        return "ScanStarted"
    }
}
