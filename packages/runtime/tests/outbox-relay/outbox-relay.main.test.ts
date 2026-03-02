import {describe, expect, test} from "bun:test"

import {InMemoryRuntimeLogger} from "../../src/review-worker/adapters/in-memory-runtime-logger"
import {InMemoryOutboxRelayRepository} from "../../src/outbox-relay/adapters/in-memory-outbox-relay-repository"
import {InMemoryOutboxTopicPublisher} from "../../src/outbox-relay/adapters/in-memory-outbox-topic-publisher"
import {runOutboxRelayOnce, startOutboxRelayConsumer} from "../../src/outbox-relay/main"
import {
    OUTBOX_RECORD_STATUS,
    OUTBOX_RELAY_RESULT_STATUS,
    type IOutboxRecord,
} from "../../src/outbox-relay/outbox-relay.types"

function createOutboxRecord(overrides: Partial<IOutboxRecord> = {}): IOutboxRecord {
    return {
        id: "msg-main",
        topic: "review.events",
        payload: {reviewId: "review-3"},
        status: OUTBOX_RECORD_STATUS.PENDING,
        attempts: 0,
        lastError: null,
        sentAt: null,
        ...overrides,
    }
}

describe("outbox-relay main", () => {
    test("starts consumer process", async () => {
        await startOutboxRelayConsumer()
        expect(true).toBe(true)
    })

    test("runs outbox relay once with provided overrides", async () => {
        const repository = new InMemoryOutboxRelayRepository([
            createOutboxRecord({
                id: "msg-main-run-once",
            }),
        ])
        const publisher = new InMemoryOutboxTopicPublisher()
        const logger = new InMemoryRuntimeLogger()

        const result = await runOutboxRelayOnce("msg-main-run-once", {
            repository,
            publisher,
            logger,
            retryPolicy: {maxAttempts: 3},
        })

        expect(result.status).toBe(OUTBOX_RELAY_RESULT_STATUS.SENT)
        expect(publisher.publishedMessages).toHaveLength(1)
    })
})
