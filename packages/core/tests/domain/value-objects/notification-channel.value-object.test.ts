import {describe, expect, test} from "bun:test"

import {
    NOTIFICATION_CHANNEL,
    NOTIFICATION_EVENT,
    NOTIFICATION_URGENCY,
    isNotificationChannel,
    isNotificationEvent,
    isNotificationUrgency,
} from "../../../src/domain/value-objects/notification-channel.value-object"

describe("Notification channel value object", () => {
    test("recognizes known channels", () => {
        expect(isNotificationChannel(NOTIFICATION_CHANNEL.SLACK)).toBe(true)
        expect(isNotificationChannel(NOTIFICATION_CHANNEL.WEBHOOK)).toBe(true)
        expect(isNotificationChannel("push")).toBe(false)
    })

    test("recognizes known events", () => {
        expect(isNotificationEvent(NOTIFICATION_EVENT.REVIEW_COMPLETED)).toBe(true)
        expect(isNotificationEvent("UNKNOWN")).toBe(false)
    })

    test("recognizes known urgency levels", () => {
        expect(isNotificationUrgency(NOTIFICATION_URGENCY.HIGH)).toBe(true)
        expect(isNotificationUrgency("urgent")).toBe(false)
    })
})
