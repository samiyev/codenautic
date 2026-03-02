import type {IOutboxRecord} from "../outbox-relay.types"

/**
 * Repository contract for outbox relay state mutations.
 */
export interface IOutboxRelayRepository {
    /**
     * Finds outbox record by id.
     *
     * @param messageId Outbox message identifier.
     * @returns Outbox record or null.
     */
    findById(messageId: string): Promise<IOutboxRecord | null>

    /**
     * Marks outbox record as sent.
     *
     * @param messageId Outbox message identifier.
     * @param attempts Total publish attempts.
     * @param sentAt Sent timestamp.
     * @returns Promise resolved after persistence update.
     */
    markSent(messageId: string, attempts: number, sentAt: Date): Promise<void>

    /**
     * Stores retry metadata while keeping record pending.
     *
     * @param messageId Outbox message identifier.
     * @param attempts Attempts performed.
     * @param errorMessage Last retry error.
     * @returns Promise resolved after persistence update.
     */
    markPendingRetry(messageId: string, attempts: number, errorMessage: string): Promise<void>

    /**
     * Marks outbox record as failed.
     *
     * @param messageId Outbox message identifier.
     * @param attempts Attempts performed.
     * @param errorMessage Terminal failure reason.
     * @returns Promise resolved after persistence update.
     */
    markFailed(messageId: string, attempts: number, errorMessage: string): Promise<void>
}
