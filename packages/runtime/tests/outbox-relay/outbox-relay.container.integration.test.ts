import {describe, expect, test} from "bun:test"

import {InMemoryRuntimeLogger} from "../../src/review-worker/adapters/in-memory-runtime-logger"
import {InMemoryOutboxRelayRepository} from "../../src/outbox-relay/adapters/in-memory-outbox-relay-repository"
import {InMemoryOutboxTopicPublisher} from "../../src/outbox-relay/adapters/in-memory-outbox-topic-publisher"
import {
    OUTBOX_RELAY_TOKENS,
    createOutboxRelayContainer,
} from "../../src/outbox-relay/outbox-relay.container"
import {
    OUTBOX_RECORD_STATUS,
    OUTBOX_RELAY_RESULT_STATUS,
    type IOutboxRecord,
} from "../../src/outbox-relay/outbox-relay.types"

function createOutboxRecord(overrides: Partial<IOutboxRecord> = {}): IOutboxRecord {
    return {
        id: "msg-container",
        topic: "review.events",
        payload: {reviewId: "review-2"},
        status: OUTBOX_RECORD_STATUS.PENDING,
        attempts: 0,
        lastError: null,
        sentAt: null,
        ...overrides,
    }
}

describe("outbox-relay composition root", () => {
    test("wires OutboxRelayConsumer in container", () => {
        const container = createOutboxRelayContainer()

        expect(container.has(OUTBOX_RELAY_TOKENS.OutboxRelayConsumer)).toBe(true)
        const consumer = container.resolve(OUTBOX_RELAY_TOKENS.OutboxRelayConsumer)
        expect(consumer).toBeDefined()
    })

    test("preserves idempotency on repeated consume", async () => {
        const repository = new InMemoryOutboxRelayRepository([
            createOutboxRecord({
                id: "msg-idempotent",
            }),
        ])
        const publisher = new InMemoryOutboxTopicPublisher()
        const logger = new InMemoryRuntimeLogger()

        const container = createOutboxRelayContainer({
            repository,
            publisher,
            logger,
            retryPolicy: {maxAttempts: 3},
        })

        const consumer = container.resolve(OUTBOX_RELAY_TOKENS.OutboxRelayConsumer)
        const firstResult = await consumer.consume("msg-idempotent")
        const secondResult = await consumer.consume("msg-idempotent")

        expect(firstResult.status).toBe(OUTBOX_RELAY_RESULT_STATUS.SENT)
        expect(secondResult.status).toBe(OUTBOX_RELAY_RESULT_STATUS.ALREADY_SENT)
        expect(publisher.publishedMessages).toHaveLength(1)
    })
})
