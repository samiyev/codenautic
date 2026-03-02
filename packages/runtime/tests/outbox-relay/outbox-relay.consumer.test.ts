import {describe, expect, test} from "bun:test"

import {InMemoryRuntimeLogger} from "../../src/review-worker/adapters/in-memory-runtime-logger"
import {InMemoryOutboxRelayRepository} from "../../src/outbox-relay/adapters/in-memory-outbox-relay-repository"
import {InMemoryOutboxTopicPublisher} from "../../src/outbox-relay/adapters/in-memory-outbox-topic-publisher"
import {OutboxRelayConsumer} from "../../src/outbox-relay/outbox-relay.consumer"
import {
    OUTBOX_RECORD_STATUS,
    OUTBOX_RELAY_RESULT_STATUS,
    type IOutboxRecord,
} from "../../src/outbox-relay/outbox-relay.types"

function createOutboxRecord(overrides: Partial<IOutboxRecord> = {}): IOutboxRecord {
    return {
        id: "msg-1",
        topic: "review.events",
        payload: {reviewId: "review-1"},
        status: OUTBOX_RECORD_STATUS.PENDING,
        attempts: 0,
        lastError: null,
        sentAt: null,
        ...overrides,
    }
}

describe("OutboxRelayConsumer", () => {
    test("returns missing when message does not exist", async () => {
        const repository = new InMemoryOutboxRelayRepository([])
        const publisher = new InMemoryOutboxTopicPublisher()
        const logger = new InMemoryRuntimeLogger()
        const consumer = new OutboxRelayConsumer(repository, publisher, logger, {maxAttempts: 3})

        const result = await consumer.consume("missing-id")

        expect(result.status).toBe(OUTBOX_RELAY_RESULT_STATUS.MISSING)
        expect(result.attempts).toBe(0)
        expect(publisher.publishedMessages).toHaveLength(0)
    })

    test("retries and eventually marks message as sent", async () => {
        const repository = new InMemoryOutboxRelayRepository([
            createOutboxRecord({
                id: "msg-retry-success",
            }),
        ])
        const publisher = new InMemoryOutboxTopicPublisher([new Error("temporary"), null])
        const logger = new InMemoryRuntimeLogger()
        const consumer = new OutboxRelayConsumer(repository, publisher, logger, {maxAttempts: 3})

        const result = await consumer.consume("msg-retry-success")

        expect(result.status).toBe(OUTBOX_RELAY_RESULT_STATUS.SENT)
        expect(result.attempts).toBe(2)
        const stored = await repository.findById("msg-retry-success")
        expect(stored?.status).toBe(OUTBOX_RECORD_STATUS.SENT)
        expect(stored?.attempts).toBe(2)
        expect(stored?.lastError).toBeNull()
        expect(publisher.publishedMessages).toHaveLength(1)
    })

    test("marks message as failed after retries are exhausted", async () => {
        const repository = new InMemoryOutboxRelayRepository([
            createOutboxRecord({
                id: "msg-fail",
            }),
        ])
        const publisher = new InMemoryOutboxTopicPublisher([
            new Error("boom"),
            new Error("boom"),
            new Error("boom"),
        ])
        const logger = new InMemoryRuntimeLogger()
        const consumer = new OutboxRelayConsumer(repository, publisher, logger, {maxAttempts: 3})

        const result = await consumer.consume("msg-fail")

        expect(result.status).toBe(OUTBOX_RELAY_RESULT_STATUS.FAILED)
        expect(result.attempts).toBe(3)
        expect(result.errorMessage).toBe("boom")
        const stored = await repository.findById("msg-fail")
        expect(stored?.status).toBe(OUTBOX_RECORD_STATUS.FAILED)
        expect(stored?.attempts).toBe(3)
        expect(stored?.lastError).toBe("boom")
        expect(publisher.publishedMessages).toHaveLength(0)
    })

    test("returns already_sent for idempotent repeated consume", async () => {
        const repository = new InMemoryOutboxRelayRepository([
            createOutboxRecord({
                id: "msg-sent",
                status: OUTBOX_RECORD_STATUS.SENT,
                attempts: 1,
                sentAt: new Date("2026-03-02T10:10:00.000Z"),
            }),
        ])
        const publisher = new InMemoryOutboxTopicPublisher()
        const logger = new InMemoryRuntimeLogger()
        const consumer = new OutboxRelayConsumer(repository, publisher, logger, {maxAttempts: 3})

        const result = await consumer.consume("msg-sent")

        expect(result.status).toBe(OUTBOX_RELAY_RESULT_STATUS.ALREADY_SENT)
        expect(result.attempts).toBe(1)
        expect(publisher.publishedMessages).toHaveLength(0)
    })

    test("returns failed without publishing when record already failed", async () => {
        const repository = new InMemoryOutboxRelayRepository([
            createOutboxRecord({
                id: "msg-already-failed",
                status: OUTBOX_RECORD_STATUS.FAILED,
                attempts: 3,
                lastError: "dead-lettered",
            }),
        ])
        const publisher = new InMemoryOutboxTopicPublisher()
        const logger = new InMemoryRuntimeLogger()
        const consumer = new OutboxRelayConsumer(repository, publisher, logger, {maxAttempts: 3})

        const result = await consumer.consume("msg-already-failed")

        expect(result.status).toBe(OUTBOX_RELAY_RESULT_STATUS.FAILED)
        expect(result.attempts).toBe(3)
        expect(result.errorMessage).toBe("dead-lettered")
        expect(publisher.publishedMessages).toHaveLength(0)
    })

    test("marks pending record as failed when attempts already reached retry limit", async () => {
        const repository = new InMemoryOutboxRelayRepository([
            createOutboxRecord({
                id: "msg-retry-limit",
                status: OUTBOX_RECORD_STATUS.PENDING,
                attempts: 3,
            }),
        ])
        const publisher = new InMemoryOutboxTopicPublisher()
        const logger = new InMemoryRuntimeLogger()
        const consumer = new OutboxRelayConsumer(repository, publisher, logger, {maxAttempts: 3})

        const result = await consumer.consume("msg-retry-limit")

        expect(result.status).toBe(OUTBOX_RELAY_RESULT_STATUS.FAILED)
        expect(result.attempts).toBe(3)
        expect(result.errorMessage).toBe("retry limit reached")
        const stored = await repository.findById("msg-retry-limit")
        expect(stored?.status).toBe(OUTBOX_RECORD_STATUS.FAILED)
        expect(stored?.lastError).toBe("retry limit reached")
        expect(publisher.publishedMessages).toHaveLength(0)
    })

    test("throws when retry policy is invalid", () => {
        const repository = new InMemoryOutboxRelayRepository([])
        const publisher = new InMemoryOutboxTopicPublisher()
        const logger = new InMemoryRuntimeLogger()

        expect(() => {
            return new OutboxRelayConsumer(repository, publisher, logger, {maxAttempts: 0})
        }).toThrow("maxAttempts must be a positive integer")
    })
})
