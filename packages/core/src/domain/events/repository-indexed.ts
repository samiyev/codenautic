import {BaseDomainEvent, type DomainEventPayload} from "./base-domain-event"

/**
 * Repository indexed event payload.
 */
export interface IRepositoryIndexedPayload extends DomainEventPayload {
    readonly repositoryId: string
    readonly totalFiles: number
    readonly languages: readonly string[]
}

/**
 * Event emitted after repository index is ready.
 */
export class RepositoryIndexed extends BaseDomainEvent<IRepositoryIndexedPayload> {
    /**
     * Creates RepositoryIndexed event.
     *
     * @param aggregateId Repository aggregate identifier.
     * @param payload Event payload.
     * @param occurredAt Event timestamp.
     */
    public constructor(aggregateId: string, payload: IRepositoryIndexedPayload, occurredAt?: Date) {
        super(aggregateId, payload, occurredAt)
    }

    /**
     * Resolves event name.
     *
     * @returns Event name literal.
     */
    protected resolveEventName(): string {
        return "RepositoryIndexed"
    }
}
