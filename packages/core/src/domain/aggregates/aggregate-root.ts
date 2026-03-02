import {Entity} from "../entities/entity"
import {BaseDomainEvent, type DomainEventPayload} from "../events/base-domain-event"
import {UniqueId} from "../value-objects/unique-id.value-object"

/**
 * Base aggregate root with domain events buffer.
 *
 * @template TProps Aggregate state type.
 */
export abstract class AggregateRoot<TProps> extends Entity<TProps> {
    private readonly domainEventsBuffer: BaseDomainEvent<DomainEventPayload>[]

    /**
     * Creates aggregate root.
     *
     * @param id Aggregate identifier.
     * @param props Aggregate state container.
     */
    public constructor(id: UniqueId, props: TProps) {
        super(id, props)
        this.domainEventsBuffer = []
    }

    /**
     * Queues domain event for later publishing.
     *
     * @param event Domain event.
     */
    protected addDomainEvent(event: BaseDomainEvent<DomainEventPayload>): void {
        this.domainEventsBuffer.push(event)
    }

    /**
     * Returns immutable snapshot of queued domain events.
     *
     * @returns Immutable snapshot of queued events.
     */
    public get domainEvents(): readonly BaseDomainEvent<DomainEventPayload>[] {
        return [...this.domainEventsBuffer]
    }

    /**
     * Returns and clears queued domain events.
     *
     * @returns Immutable snapshot of queued events before clearing.
     */
    public clearDomainEvents(): readonly BaseDomainEvent<DomainEventPayload>[] {
        const events = [...this.domainEventsBuffer]
        this.domainEventsBuffer.splice(0, this.domainEventsBuffer.length)
        return events
    }

    /**
     * Backward-compatible alias for event buffer draining.
     *
     * @returns Immutable snapshot of queued events before clearing.
     */
    public pullDomainEvents(): readonly BaseDomainEvent<DomainEventPayload>[] {
        return this.clearDomainEvents()
    }
}
