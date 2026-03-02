import {describe, expect, test} from "bun:test"

import {
    BaseDomainEvent,
    type DomainEventPayload,
} from "../../../src/domain/events/base-domain-event"

interface IStubEventPayload extends DomainEventPayload {
    value: number
}

class StubDomainEvent extends BaseDomainEvent<IStubEventPayload> {
    protected resolveEventName(): string {
        return "StubDomainEventOccurred"
    }
}

describe("BaseDomainEvent", () => {
    test("generates unique event identifiers for each instance", () => {
        const first = new StubDomainEvent("aggregate-1", {value: 1})
        const second = new StubDomainEvent("aggregate-1", {value: 1})

        expect(first.eventId).not.toBe(second.eventId)
    })

    test("sets occurredAt automatically when omitted", () => {
        const event = new StubDomainEvent("aggregate-1", {value: 1})

        expect(event.occurredAt instanceof Date).toBe(true)
    })

    test("uses aggregateId from constructor and event name from subclass", () => {
        const event = new StubDomainEvent("aggregate-42", {value: 2})

        expect(event.aggregateId).toBe("aggregate-42")
        expect(event.eventName).toBe("StubDomainEventOccurred")
    })
})
