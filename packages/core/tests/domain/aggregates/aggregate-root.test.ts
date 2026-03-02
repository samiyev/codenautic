import {describe, expect, test} from "bun:test"

import {AggregateRoot} from "../../../src/domain/aggregates/aggregate-root"
import {Entity} from "../../../src/domain/entities/entity"
import {
    BaseDomainEvent,
    type DomainEventPayload,
} from "../../../src/domain/events/base-domain-event"
import {UniqueId} from "../../../src/domain/value-objects/unique-id.value-object"

interface IStubAggregateProps {
    name: string
}

interface IStubPayload extends DomainEventPayload {
    value: number
}

class StubAggregateRoot extends AggregateRoot<IStubAggregateProps> {
    public constructor(id: UniqueId, props: IStubAggregateProps) {
        super(id, props)
    }

    public recordEvent(event: BaseDomainEvent<IStubPayload>): void {
        this.addDomainEvent(event)
    }
}

describe("AggregateRoot", () => {
    test("inherits Entity base behavior", () => {
        const aggregate = new StubAggregateRoot(UniqueId.create("aggregate-1"), {name: "stub"})

        expect(aggregate instanceof Entity).toBe(true)
    })

    test("accumulates domain events and exposes snapshot copy", () => {
        const aggregate = new StubAggregateRoot(UniqueId.create("aggregate-1"), {name: "stub"})
        const first = new BaseDomainEvent<IStubPayload>("StubEventRaised", "aggregate-1", {value: 1})
        const second = new BaseDomainEvent<IStubPayload>("StubEventRaised", "aggregate-1", {value: 2})

        aggregate.recordEvent(first)
        aggregate.recordEvent(second)

        const firstSnapshot = aggregate.domainEvents
        expect(firstSnapshot).toHaveLength(2)

        const mutableSnapshot = [...firstSnapshot]
        mutableSnapshot.push(new BaseDomainEvent<IStubPayload>("Fake", "aggregate-1", {value: 3}))

        expect(mutableSnapshot).toHaveLength(3)
        expect(aggregate.domainEvents).toHaveLength(2)
    })

    test("clearDomainEvents returns events and then empties buffer", () => {
        const aggregate = new StubAggregateRoot(UniqueId.create("aggregate-1"), {name: "stub"})
        const event = new BaseDomainEvent<IStubPayload>("StubEventRaised", "aggregate-1", {value: 1})
        aggregate.recordEvent(event)

        const firstClear = aggregate.clearDomainEvents()
        const secondClear = aggregate.clearDomainEvents()

        expect(firstClear).toHaveLength(1)
        expect(secondClear).toHaveLength(0)
    })

    test("pullDomainEvents keeps backward-compatible behavior", () => {
        const aggregate = new StubAggregateRoot(UniqueId.create("aggregate-1"), {name: "stub"})
        aggregate.recordEvent(
            new BaseDomainEvent<IStubPayload>("StubEventRaised", "aggregate-1", {value: 1}),
        )

        const firstPull = aggregate.pullDomainEvents()
        const secondPull = aggregate.pullDomainEvents()

        expect(firstPull).toHaveLength(1)
        expect(secondPull).toHaveLength(0)
    })
})
