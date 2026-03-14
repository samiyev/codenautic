import {InboxMessage, UniqueId, type IInboxRepository} from "@codenautic/core"

import {normalizeEventType, normalizeMessageKey} from "./messaging-normalization"

/**
 * Input payload for inbox deduplication implementation.
 */
export interface IInboxDeduplicationInput {
    /**
     * External broker message identifier.
     */
    readonly messageId: string

    /**
     * Consumer identifier used for scoped deduplication.
     */
    readonly consumerId: string

    /**
     * Logical event type.
     */
    readonly eventType: string
}

/**
 * Stored deduplication record snapshot.
 */
export interface IInboxDeduplicationRecord {
    /**
     * Internal inbox entity identifier.
     */
    readonly id: string

    /**
     * Composite deduplication key (`consumerId:messageId`).
     */
    readonly deduplicationKey: string

    /**
     * Event type of first accepted message.
     */
    readonly eventType: string

    /**
     * Processing timestamp.
     */
    readonly processedAt: Date | null
}

/**
 * Result of deduplication process.
 */
export interface IInboxDeduplicationResult {
    /**
     * True when message was already processed before.
     */
    readonly isDuplicate: boolean

    /**
     * Stored deduplication record.
     */
    readonly record: IInboxDeduplicationRecord
}

/**
 * Constructor options for inbox deduplication implementation.
 */
export interface IInboxDeduplicationImplOptions {
    /**
     * Inbox repository implementation.
     */
    readonly inboxRepository: IInboxRepository

    /**
     * Optional deterministic clock for tests.
     */
    readonly now?: () => Date
}

/**
 * Repository-backed inbox deduplication implementation.
 */
export class InboxDeduplicationImpl {
    private readonly inboxRepository: IInboxRepository
    private readonly now: () => Date

    /**
     * Creates deduplication implementation.
     *
     * @param options Dependencies.
     */
    public constructor(options: IInboxDeduplicationImplOptions) {
        this.inboxRepository = options.inboxRepository
        this.now = options.now ?? (() => new Date())
    }

    /**
     * Checks if message is duplicate for specific consumer.
     *
     * @param messageId External message id.
     * @param consumerId Consumer identifier.
     * @returns True when message already exists.
     */
    public async isDuplicate(messageId: string, consumerId: string): Promise<boolean> {
        const deduplicationKey = composeDeduplicationKey(messageId, consumerId)
        const existing = await this.inboxRepository.findByMessageId(deduplicationKey)
        return existing !== null
    }

    /**
     * Processes message with consumer-scoped deduplication.
     *
     * @param input Deduplication payload.
     * @returns Deduplication result.
     */
    public async process(input: IInboxDeduplicationInput): Promise<IInboxDeduplicationResult> {
        const deduplicationKey = composeDeduplicationKey(input.messageId, input.consumerId)
        const existing = await this.inboxRepository.findByMessageId(deduplicationKey)
        if (existing !== null) {
            return {
                isDuplicate: true,
                record: toDeduplicationRecord(existing),
            }
        }

        const inboxMessage = new InboxMessage(
            UniqueId.create(`inbox:${deduplicationKey}`),
            {
                messageId: deduplicationKey,
                eventType: normalizeEventType(input.eventType),
            },
        )
        inboxMessage.markProcessed(this.now())
        await this.inboxRepository.save(inboxMessage)

        return {
            isDuplicate: false,
            record: toDeduplicationRecord(inboxMessage),
        }
    }
}

/**
 * Maps inbox entity to deduplication record snapshot.
 *
 * @param message Inbox message entity.
 * @returns Deduplication record.
 */
function toDeduplicationRecord(message: InboxMessage): IInboxDeduplicationRecord {
    const processedAt = message.processedAt

    return {
        id: message.id.value,
        deduplicationKey: message.messageId,
        eventType: message.eventType,
        processedAt: processedAt === null ? null : new Date(processedAt.getTime()),
    }
}

/**
 * Composes consumer-scoped deduplication key.
 *
 * @param messageId External message id.
 * @param consumerId Consumer identifier.
 * @returns Composite deduplication key.
 */
function composeDeduplicationKey(messageId: string, consumerId: string): string {
    const normalizedMessageId = normalizeMessageKey(messageId)
    const normalizedConsumerId = normalizeConsumerId(consumerId)
    return `${normalizedConsumerId}:${normalizedMessageId}`
}

/**
 * Normalizes consumer identifier.
 *
 * @param value Raw consumer id.
 * @returns Non-empty consumer id.
 */
function normalizeConsumerId(value: string): string {
    const normalized = value.trim()
    if (normalized.length === 0) {
        throw new Error("consumerId cannot be empty")
    }

    return normalized
}
