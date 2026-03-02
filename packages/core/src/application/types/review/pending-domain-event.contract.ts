/**
 * Serializable domain event envelope persisted in pipeline external context.
 */
export interface IPendingDomainEventEnvelope {
    readonly eventName: string
    readonly aggregateId: string
    readonly occurredAt: string
    readonly payload: Readonly<Record<string, unknown>>
}
