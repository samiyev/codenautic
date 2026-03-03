/**
 * Supported notification channels.
 */
export const NOTIFICATION_CHANNEL = {
    SLACK: "SLACK",
    TEAMS: "TEAMS",
    EMAIL: "EMAIL",
    WEBHOOK: "WEBHOOK",
} as const

/**
 * Notification channel literal type.
 */
export type NotificationChannel =
    (typeof NOTIFICATION_CHANNEL)[keyof typeof NOTIFICATION_CHANNEL]

/**
 * Supported notification events.
 */
export const NOTIFICATION_EVENT = {
    REVIEW_COMPLETED: "REVIEW_COMPLETED",
    ISSUE_CRITICAL: "ISSUE_CRITICAL",
    MENTION: "MENTION",
    DRIFT_ALERT: "DRIFT_ALERT",
    REPORT_READY: "REPORT_READY",
} as const

/**
 * Notification event literal type.
 */
export type NotificationEvent = (typeof NOTIFICATION_EVENT)[keyof typeof NOTIFICATION_EVENT]

/**
 * Notification urgency levels.
 */
export const NOTIFICATION_URGENCY = {
    LOW: "low",
    NORMAL: "normal",
    HIGH: "high",
} as const

/**
 * Notification urgency level.
 */
export type NotificationUrgency = (typeof NOTIFICATION_URGENCY)[keyof typeof NOTIFICATION_URGENCY]

/**
 * Type guard for notification channels.
 *
 * @param value Candidate value.
 * @returns True when value is known notification channel.
 */
export function isNotificationChannel(value: string): value is NotificationChannel {
    return Object.values(NOTIFICATION_CHANNEL).includes(value as NotificationChannel)
}

/**
 * Type guard for notification events.
 *
 * @param value Candidate value.
 * @returns True when value is known notification event.
 */
export function isNotificationEvent(value: string): value is NotificationEvent {
    return Object.values(NOTIFICATION_EVENT).includes(value as NotificationEvent)
}

/**
 * Type guard for urgency values.
 *
 * @param value Candidate value.
 * @returns True when value is supported urgency.
 */
export function isNotificationUrgency(value: string): value is NotificationUrgency {
    return Object.values(NOTIFICATION_URGENCY).includes(value as NotificationUrgency)
}
