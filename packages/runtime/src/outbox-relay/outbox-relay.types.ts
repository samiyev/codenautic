/**
 * Persisted outbox record statuses.
 */
export const OUTBOX_RECORD_STATUS = {
    PENDING: "pending",
    SENT: "sent",
    FAILED: "failed",
} as const

/**
 * Persisted outbox record status value.
 */
export type OutboxRecordStatus = (typeof OUTBOX_RECORD_STATUS)[keyof typeof OUTBOX_RECORD_STATUS]

/**
 * Result statuses for outbox relay consumer execution.
 */
export const OUTBOX_RELAY_RESULT_STATUS = {
    SENT: "sent",
    FAILED: "failed",
    ALREADY_SENT: "already_sent",
    MISSING: "missing",
} as const

/**
 * Result status value for outbox relay execution.
 */
export type OutboxRelayResultStatus =
    (typeof OUTBOX_RELAY_RESULT_STATUS)[keyof typeof OUTBOX_RELAY_RESULT_STATUS]

/**
 * Outbox record persisted in runtime store.
 */
export interface IOutboxRecord {
    id: string
    topic: string
    payload: Record<string, unknown>
    status: OutboxRecordStatus
    attempts: number
    lastError: string | null
    sentAt: Date | null
}

/**
 * Metadata passed to topic publisher.
 */
export interface IOutboxPublishMetadata {
    messageId: string
}

/**
 * Retry policy for outbox relay consumer.
 */
export interface IOutboxRelayRetryPolicy {
    maxAttempts: number
}

/**
 * Consumer processing result.
 */
export interface IOutboxRelayResult {
    messageId: string
    status: OutboxRelayResultStatus
    attempts: number
    errorMessage?: string
}

/**
 * Default retry policy for outbox relay.
 */
export const DEFAULT_OUTBOX_RELAY_RETRY_POLICY: IOutboxRelayRetryPolicy = {
    maxAttempts: 3,
}
