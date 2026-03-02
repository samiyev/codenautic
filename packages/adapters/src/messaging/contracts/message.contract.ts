/**
 * Outbox write status values.
 */
export const OUTBOX_WRITE_STATUS = {
    STORED: "stored",
    DUPLICATE: "duplicate",
} as const

/**
 * Outbox write status type.
 */
export type OutboxWriteStatus = (typeof OUTBOX_WRITE_STATUS)[keyof typeof OUTBOX_WRITE_STATUS]

/**
 * Inbox deduplication status values.
 */
export const INBOX_DEDUP_STATUS = {
    ACCEPTED: "accepted",
    DUPLICATE: "duplicate",
} as const

/**
 * Inbox deduplication status type.
 */
export type InboxDedupStatus = (typeof INBOX_DEDUP_STATUS)[keyof typeof INBOX_DEDUP_STATUS]

/**
 * Outbox message record stored by adapter.
 */
export interface IOutboxMessageRecord {
    readonly messageKey: string
    readonly topic: string
    readonly payload: Readonly<Record<string, unknown>>
    readonly createdAt: Date
}

/**
 * Outbox write request DTO.
 */
export interface IOutboxWriteRequest {
    readonly messageKey: string
    readonly topic: string
    readonly payload: Readonly<Record<string, unknown>>
}

/**
 * Outbox write result DTO.
 */
export interface IOutboxWriteResult {
    readonly status: OutboxWriteStatus
    readonly record: IOutboxMessageRecord
}

/**
 * Inbox deduplication result DTO.
 */
export interface IInboxDeduplicationResult {
    readonly status: InboxDedupStatus
    readonly messageKey: string
    readonly accepted: boolean
}
