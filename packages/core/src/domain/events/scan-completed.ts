import {BaseDomainEvent, type DomainEventPayload} from "./base-domain-event"

/**
 * Scan completion lifecycle payload.
 */
export interface IScanCompletedPayload extends DomainEventPayload {
    readonly repositoryId: string
    readonly scanId: string
    readonly totalFiles: number
    readonly totalNodes: number
    readonly duration: number
}

/**
 * Event emitted when scan completed.
 */
export class ScanCompleted extends BaseDomainEvent<IScanCompletedPayload> {
    /**
     * Creates ScanCompleted event.
     *
     * @param aggregateId Repository aggregate identifier.
     * @param payload Event payload.
     * @param occurredAt Event timestamp.
     */
    public constructor(aggregateId: string, payload: IScanCompletedPayload, occurredAt?: Date) {
        super(aggregateId, payload, occurredAt)
    }

    /**
     * Resolves event name.
     *
     * @returns Event name literal.
     */
    protected resolveEventName(): string {
        return "ScanCompleted"
    }
}
