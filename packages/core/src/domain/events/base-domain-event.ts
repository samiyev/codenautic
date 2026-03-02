/**
 * Common contract for immutable domain events.
 *
 * @template TPayload Event payload type.
 */
export type DomainEventPayload = Record<string, unknown>

/**
 * Common contract for immutable domain events.
 *
 * @template TPayload Event payload type.
 */
export abstract class BaseDomainEvent<TPayload extends DomainEventPayload> {
    public readonly eventId: string
    public readonly eventName: string
    public readonly occurredAt: Date
    public readonly aggregateId: string
    public readonly payload: Readonly<TPayload>

    /**
     * Creates immutable event instance.
     *
     * @param aggregateId Aggregate identifier that produced event.
     * @param payload Serializable event payload.
     * @param occurredAt Event creation time.
     */
    public constructor(aggregateId: string, payload: TPayload, occurredAt: Date = new Date()) {
        this.eventId = crypto.randomUUID()
        this.eventName = this.resolveEventName()
        this.aggregateId = aggregateId
        this.payload = Object.freeze({...payload})
        this.occurredAt = new Date(occurredAt)
        Object.freeze(this)
    }

    /**
     * Resolves event name in past tense.
     *
     * @returns Event name literal.
     */
    protected abstract resolveEventName(): string
}
