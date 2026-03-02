import type {IOutboxRelayRepository} from "../ports/outbox-relay-repository.port"
import {
    OUTBOX_RECORD_STATUS,
    type IOutboxRecord,
} from "../outbox-relay.types"

/**
 * In-memory outbox repository for runtime bootstrap and tests.
 */
export class InMemoryOutboxRelayRepository implements IOutboxRelayRepository {
    private readonly store: Map<string, IOutboxRecord>

    /**
     * Creates repository with optional initial records.
     *
     * @param initialRecords Initial outbox records.
     */
    public constructor(initialRecords: readonly IOutboxRecord[] = []) {
        this.store = new Map(
            initialRecords.map((record) => {
                return [record.id, cloneRecord(record)]
            }),
        )
    }

    /**
     * Finds outbox record by id.
     *
     * @param messageId Outbox message identifier.
     * @returns Cloned outbox record or null.
     */
    public findById(messageId: string): Promise<IOutboxRecord | null> {
        const stored = this.store.get(messageId)
        if (stored === undefined) {
            return Promise.resolve(null)
        }

        return Promise.resolve(cloneRecord(stored))
    }

    /**
     * Marks record as sent.
     *
     * @param messageId Outbox message identifier.
     * @param attempts Total attempts.
     * @param sentAt Sent timestamp.
     * @returns Promise resolved after update.
     */
    public markSent(messageId: string, attempts: number, sentAt: Date): Promise<void> {
        this.updateOrThrow(messageId, (record) => {
            record.status = OUTBOX_RECORD_STATUS.SENT
            record.attempts = attempts
            record.lastError = null
            record.sentAt = new Date(sentAt)
        })

        return Promise.resolve()
    }

    /**
     * Marks retry metadata while keeping pending status.
     *
     * @param messageId Outbox message identifier.
     * @param attempts Total attempts.
     * @param errorMessage Retry error text.
     * @returns Promise resolved after update.
     */
    public markPendingRetry(messageId: string, attempts: number, errorMessage: string): Promise<void> {
        this.updateOrThrow(messageId, (record) => {
            record.status = OUTBOX_RECORD_STATUS.PENDING
            record.attempts = attempts
            record.lastError = errorMessage
            record.sentAt = null
        })

        return Promise.resolve()
    }

    /**
     * Marks record as failed.
     *
     * @param messageId Outbox message identifier.
     * @param attempts Total attempts.
     * @param errorMessage Terminal error text.
     * @returns Promise resolved after update.
     */
    public markFailed(messageId: string, attempts: number, errorMessage: string): Promise<void> {
        this.updateOrThrow(messageId, (record) => {
            record.status = OUTBOX_RECORD_STATUS.FAILED
            record.attempts = attempts
            record.lastError = errorMessage
            record.sentAt = null
        })

        return Promise.resolve()
    }

    /**
     * Updates stored record or throws when record is missing.
     *
     * @param messageId Outbox message identifier.
     * @param update Mutator callback.
     * @throws Error When record does not exist.
     */
    private updateOrThrow(messageId: string, update: (record: IOutboxRecord) => void): void {
        const stored = this.store.get(messageId)
        if (stored === undefined) {
            throw new Error(`Outbox record '${messageId}' does not exist`)
        }

        const draft = cloneRecord(stored)
        update(draft)
        this.store.set(messageId, draft)
    }
}

/**
 * Clones outbox record to avoid accidental shared mutation.
 *
 * @param record Source outbox record.
 * @returns Cloned outbox record.
 */
function cloneRecord(record: IOutboxRecord): IOutboxRecord {
    return {
        id: record.id,
        topic: record.topic,
        payload: {...record.payload},
        status: record.status,
        attempts: record.attempts,
        lastError: record.lastError,
        sentAt: record.sentAt === null ? null : new Date(record.sentAt),
    }
}
