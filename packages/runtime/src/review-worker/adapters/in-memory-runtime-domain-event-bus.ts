import {
    type BaseDomainEvent,
    type IDomainEventBus,
} from "@codenautic/core"

/**
 * In-memory domain event bus used by runtime bootstrap and integration tests.
 */
export class InMemoryRuntimeDomainEventBus implements IDomainEventBus {
    public readonly publishedEvents: BaseDomainEvent<Record<string, unknown>>[]

    /**
     * Creates empty in-memory event bus.
     */
    public constructor() {
        this.publishedEvents = []
    }

    /**
     * Publishes events into in-memory list.
     *
     * @param events Domain events.
     * @returns Promise resolved when publish is completed.
     */
    public publish(events: readonly BaseDomainEvent<Record<string, unknown>>[]): Promise<void> {
        this.publishedEvents.push(...events)
        return Promise.resolve()
    }
}
