import {BaseDomainEvent, type DomainEventPayload} from "./base-domain-event"

/**
 * Payload for RuleActivated event.
 */
export interface IRuleActivatedPayload extends DomainEventPayload {
    readonly ruleId: string
    readonly ruleName: string
}

/**
 * Domain event raised when custom rule is activated.
 */
export class RuleActivated extends BaseDomainEvent<IRuleActivatedPayload> {
    /**
     * Creates RuleActivated event.
     *
     * @param aggregateId Rule aggregate id.
     * @param payload Event payload.
     * @param occurredAt Event creation time.
     */
    public constructor(aggregateId: string, payload: IRuleActivatedPayload, occurredAt?: Date) {
        super("RuleActivated", aggregateId, payload, occurredAt)
    }
}
