import {describe, expect, test} from "bun:test"

import {InboxMessage, UniqueId, type IInboxRepository} from "@codenautic/core"

import {InboxDeduplicationImpl} from "../../src/messaging"

/**
 * In-memory inbox repository for deduplication tests.
 */
class InMemoryInboxRepository implements IInboxRepository {
    private readonly byId: Map<string, InboxMessage>
    private readonly byMessageId: Map<string, InboxMessage>

    /**
     * Creates repository instance.
     */
    public constructor() {
        this.byId = new Map<string, InboxMessage>()
        this.byMessageId = new Map<string, InboxMessage>()
    }

    /**
     * Finds message by internal identifier.
     *
     * @param id Entity identifier.
     * @returns Message or null.
     */
    public findById(id: UniqueId): Promise<InboxMessage | null> {
        return Promise.resolve(this.byId.get(id.value) ?? null)
    }

    /**
     * Saves inbox message.
     *
     * @param message Inbox message.
     */
    public save(message: InboxMessage): Promise<void> {
        this.byId.set(message.id.value, message)
        this.byMessageId.set(message.messageId, message)
        return Promise.resolve()
    }

    /**
     * Finds inbox message by external message id.
     *
     * @param messageId External message id.
     * @returns Message or null.
     */
    public findByMessageId(messageId: string): Promise<InboxMessage | null> {
        return Promise.resolve(this.byMessageId.get(messageId) ?? null)
    }

    /**
     * Marks message as processed.
     *
     * @param id Message identifier.
     */
    public markProcessed(id: string | UniqueId): Promise<void> {
        const resolvedId = id instanceof UniqueId ? id.value : id
        const message = this.byId.get(resolvedId)
        if (message !== undefined) {
            message.markProcessed(new Date("2026-03-14T18:00:00.000Z"))
        }

        return Promise.resolve()
    }
}

describe("InboxDeduplicationImpl", () => {
    test("stores first message and marks repeated message as duplicate", async () => {
        const repository = new InMemoryInboxRepository()
        const deduplication = new InboxDeduplicationImpl({
            inboxRepository: repository,
            now: () => new Date("2026-03-14T18:00:00.000Z"),
        })

        const first = await deduplication.process({
            messageId: "msg-1",
            consumerId: "worker-a",
            eventType: "review.completed",
        })
        const second = await deduplication.process({
            messageId: "msg-1",
            consumerId: "worker-a",
            eventType: "review.completed",
        })

        expect(first.isDuplicate).toBe(false)
        expect(second.isDuplicate).toBe(true)
        expect(second.record.id).toBe(first.record.id)
        expect(second.record.deduplicationKey).toBe("worker-a:msg-1")
    })

    test("keeps message scopes isolated by consumerId", async () => {
        const repository = new InMemoryInboxRepository()
        const deduplication = new InboxDeduplicationImpl({
            inboxRepository: repository,
        })

        const firstConsumer = await deduplication.process({
            messageId: "msg-2",
            consumerId: "worker-a",
            eventType: "review.completed",
        })
        const secondConsumer = await deduplication.process({
            messageId: "msg-2",
            consumerId: "worker-b",
            eventType: "review.completed",
        })

        expect(firstConsumer.isDuplicate).toBe(false)
        expect(secondConsumer.isDuplicate).toBe(false)
        expect(firstConsumer.record.deduplicationKey).toBe("worker-a:msg-2")
        expect(secondConsumer.record.deduplicationKey).toBe("worker-b:msg-2")
    })

    test("supports duplicate pre-check API", async () => {
        const repository = new InMemoryInboxRepository()
        const deduplication = new InboxDeduplicationImpl({
            inboxRepository: repository,
        })

        expect(await deduplication.isDuplicate("msg-3", "worker-a")).toBe(false)
        await deduplication.process({
            messageId: "msg-3",
            consumerId: "worker-a",
            eventType: "review.failed",
        })
        expect(await deduplication.isDuplicate("msg-3", "worker-a")).toBe(true)
    })

    test("validates deduplication input fields", async () => {
        const repository = new InMemoryInboxRepository()
        const deduplication = new InboxDeduplicationImpl({
            inboxRepository: repository,
        })

        let consumerError: unknown
        try {
            await deduplication.process({
                messageId: "msg-4",
                consumerId: " ",
                eventType: "review.completed",
            })
        } catch (error) {
            consumerError = error
        }
        expect(consumerError).toBeInstanceOf(Error)
        if (!(consumerError instanceof Error)) {
            throw new Error("Expected consumerId validation error")
        }
        expect(consumerError.message).toBe("consumerId cannot be empty")

        let messageError: unknown
        try {
            await deduplication.isDuplicate(" ", "worker-a")
        } catch (error) {
            messageError = error
        }
        expect(messageError).toBeInstanceOf(Error)
        if (!(messageError instanceof Error)) {
            throw new Error("Expected messageId validation error")
        }
        expect(messageError.message).toBe("messageKey cannot be empty")
    })
})
