import {describe, expect, test} from "bun:test"

import {
    INBOX_DEDUP_STATUS,
    MESSAGING_ADAPTER_ERROR_CODE,
    OUTBOX_WRITE_STATUS,
    InboxDeduplicatorAdapter,
    OutboxWriterAdapter,
} from "../../src/messaging"

describe("OutboxWriterAdapter", () => {
    test("stores new outbox message with deterministic timestamp", () => {
        const fixedDate = new Date("2026-03-02T12:00:00.000Z")
        const writer = new OutboxWriterAdapter(() => fixedDate)

        const result = writer.write({
            messageKey: "msg-001",
            topic: "review.started",
            payload: {
                reviewId: "rev-1",
            },
        })

        expect(result.isOk).toBe(true)
        if (result.isFail) {
            throw new Error("Expected successful outbox write")
        }

        expect(result.value.status).toBe(OUTBOX_WRITE_STATUS.STORED)
        expect(result.value.record).toEqual({
            messageKey: "msg-001",
            topic: "review.started",
            payload: {
                reviewId: "rev-1",
            },
            createdAt: new Date("2026-03-02T12:00:00.000Z"),
        })
    })

    test("returns duplicate status and keeps original record on repeated write", () => {
        let callCount = 0
        const writer = new OutboxWriterAdapter(() => {
            callCount += 1
            return new Date(`2026-03-02T12:00:0${callCount}.000Z`)
        })

        const first = writer.write({
            messageKey: "msg-002",
            topic: "review.completed",
            payload: {
                reviewId: "rev-2",
            },
        })
        const second = writer.write({
            messageKey: "msg-002",
            topic: "review.completed.changed",
            payload: {
                reviewId: "rev-2b",
            },
        })

        expect(first.isOk).toBe(true)
        expect(second.isOk).toBe(true)
        if (first.isFail || second.isFail) {
            throw new Error("Expected successful outbox writes")
        }

        expect(first.value.status).toBe(OUTBOX_WRITE_STATUS.STORED)
        expect(second.value.status).toBe(OUTBOX_WRITE_STATUS.DUPLICATE)
        expect(second.value.record).toEqual(first.value.record)
        expect(callCount).toBe(1)
    })

    test("normalizes key and topic by trimming spaces", () => {
        const writer = new OutboxWriterAdapter(() => new Date("2026-03-02T12:00:00.000Z"))

        const result = writer.write({
            messageKey: "  msg-003  ",
            topic: "  review.failed  ",
            payload: {
                reviewId: "rev-3",
            },
        })

        expect(result.isOk).toBe(true)
        if (result.isFail) {
            throw new Error("Expected successful outbox write")
        }

        expect(result.value.record.messageKey).toBe("msg-003")
        expect(result.value.record.topic).toBe("review.failed")
    })

    test("uses default clock function when custom clock is not provided", () => {
        const writer = new OutboxWriterAdapter()

        const result = writer.write({
            messageKey: "msg-default-clock",
            topic: "review.started",
            payload: {
                reviewId: "rev-default",
            },
        })

        expect(result.isOk).toBe(true)
        if (result.isFail) {
            throw new Error("Expected successful outbox write")
        }

        expect(result.value.record.createdAt instanceof Date).toBe(true)
    })

    test("returns invalid message error for invalid request fields", () => {
        const writer = new OutboxWriterAdapter()

        const emptyKey = writer.write({
            messageKey: " ",
            topic: "review.started",
            payload: {
                reviewId: "rev-4",
            },
        })
        const emptyTopic = writer.write({
            messageKey: "msg-004",
            topic: " ",
            payload: {
                reviewId: "rev-4",
            },
        })
        const arrayPayload = writer.write({
            messageKey: "msg-005",
            topic: "review.started",
            payload: ["invalid"] as unknown as Readonly<Record<string, unknown>>,
        })
        const nullPayload = writer.write({
            messageKey: "msg-006",
            topic: "review.started",
            payload: null as unknown as Readonly<Record<string, unknown>>,
        })

        expect(emptyKey.isFail).toBe(true)
        expect(emptyTopic.isFail).toBe(true)
        expect(arrayPayload.isFail).toBe(true)
        expect(nullPayload.isFail).toBe(true)
        if (emptyKey.isOk || emptyTopic.isOk || arrayPayload.isOk || nullPayload.isOk) {
            throw new Error("Expected invalid write failures")
        }

        expect(emptyKey.error.code).toBe(MESSAGING_ADAPTER_ERROR_CODE.INVALID_MESSAGE)
        expect(emptyTopic.error.code).toBe(MESSAGING_ADAPTER_ERROR_CODE.INVALID_MESSAGE)
        expect(arrayPayload.error.code).toBe(MESSAGING_ADAPTER_ERROR_CODE.INVALID_MESSAGE)
        expect(nullPayload.error.code).toBe(MESSAGING_ADAPTER_ERROR_CODE.INVALID_MESSAGE)
    })
})

describe("InboxDeduplicatorAdapter", () => {
    test("accepts first message and marks second as duplicate", () => {
        const deduplicator = new InboxDeduplicatorAdapter()

        const first = deduplicator.register("msg-100")
        const second = deduplicator.register("msg-100")

        expect(first.isOk).toBe(true)
        expect(second.isOk).toBe(true)
        if (first.isFail || second.isFail) {
            throw new Error("Expected successful dedup checks")
        }

        expect(first.value).toEqual({
            status: INBOX_DEDUP_STATUS.ACCEPTED,
            messageKey: "msg-100",
            accepted: true,
        })
        expect(second.value).toEqual({
            status: INBOX_DEDUP_STATUS.DUPLICATE,
            messageKey: "msg-100",
            accepted: false,
        })
    })

    test("returns invalid message error for empty key", () => {
        const deduplicator = new InboxDeduplicatorAdapter()

        const result = deduplicator.register(" ")

        expect(result.isFail).toBe(true)
        if (result.isOk) {
            throw new Error("Expected invalid message key failure")
        }

        expect(result.error.code).toBe(MESSAGING_ADAPTER_ERROR_CODE.INVALID_MESSAGE)
    })

    test("supports idempotent retry flow with outbox and inbox adapters", () => {
        const writer = new OutboxWriterAdapter(() => new Date("2026-03-02T12:15:00.000Z"))
        const deduplicator = new InboxDeduplicatorAdapter()

        const firstWrite = writer.write({
            messageKey: "msg-retry-1",
            topic: "review.completed",
            payload: {
                reviewId: "rev-90",
                attempt: 1,
            },
        })
        const firstConsume = deduplicator.register("msg-retry-1")
        const retryWrite = writer.write({
            messageKey: "msg-retry-1",
            topic: "review.completed",
            payload: {
                reviewId: "rev-90",
                attempt: 2,
            },
        })
        const retryConsume = deduplicator.register("msg-retry-1")

        expect(firstWrite.isOk).toBe(true)
        expect(firstConsume.isOk).toBe(true)
        expect(retryWrite.isOk).toBe(true)
        expect(retryConsume.isOk).toBe(true)
        if (
            firstWrite.isFail ||
            firstConsume.isFail ||
            retryWrite.isFail ||
            retryConsume.isFail
        ) {
            throw new Error("Expected successful idempotency flow")
        }

        expect(firstWrite.value.status).toBe(OUTBOX_WRITE_STATUS.STORED)
        expect(firstConsume.value.status).toBe(INBOX_DEDUP_STATUS.ACCEPTED)
        expect(retryWrite.value.status).toBe(OUTBOX_WRITE_STATUS.DUPLICATE)
        expect(retryConsume.value.status).toBe(INBOX_DEDUP_STATUS.DUPLICATE)
        expect(retryWrite.value.record.payload).toEqual({
            reviewId: "rev-90",
            attempt: 1,
        })
    })
})
