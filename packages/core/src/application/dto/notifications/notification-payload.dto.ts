import type {
    NotificationChannel,
    NotificationEvent,
    NotificationUrgency,
} from "../../../domain/value-objects/notification-channel.value-object"

/**
 * Data required for notification dispatch.
 */
export interface INotificationPayload {
    /**
     * Target notification channel.
     */
    readonly channel: NotificationChannel

    /**
     * Notification event type.
     */
    readonly event: NotificationEvent

    /**
     * Recipient identifiers.
     */
    readonly recipients: readonly string[]

    /**
     * Notification title.
     */
    readonly title: string

    /**
     * Notification body.
     */
    readonly body: string

    /**
     * Optional metadata for downstream formatters/providers.
     */
    readonly metadata?: Readonly<Record<string, unknown>>

    /**
     * Optional stable deduplication key for idempotent delivery.
     */
    readonly dedupeKey?: string

    /**
     * Notification urgency.
     */
    readonly urgency: NotificationUrgency
}
