import {describe, expect, test} from "bun:test"

import {
    NOTIFICATION_CHANNEL,
    NOTIFICATION_EVENT,
} from "../../../src/domain/value-objects/notification-channel.value-object"
import {
    NotificationPreferences,
} from "../../../src/domain/value-objects/notification-preferences.value-object"

describe("NotificationPreferences", () => {
    test("creates preferences for unique user id", () => {
        const preferences = NotificationPreferences.create({
            userId: " user-42 ",
            channels: [
                {
                    channel: NOTIFICATION_CHANNEL.SLACK,
                    enabled: true,
                    events: [NOTIFICATION_EVENT.REVIEW_COMPLETED],
                },
            ],
        })

        expect(preferences.userId.value).toBe("user-42")
        expect(preferences.channels).toHaveLength(1)
        expect(preferences.channels[0]?.channel).toBe(NOTIFICATION_CHANNEL.SLACK)
        expect(preferences.channels[0]?.events).toEqual([NOTIFICATION_EVENT.REVIEW_COMPLETED])
    })

    test("deduplicates events and reports channel checks", () => {
        const preferences = NotificationPreferences.create({
            userId: "user-55",
            channels: [
                {
                    channel: NOTIFICATION_CHANNEL.EMAIL,
                    enabled: true,
                    events: [
                        NOTIFICATION_EVENT.MENTION,
                        NOTIFICATION_EVENT.MENTION,
                        NOTIFICATION_EVENT.ISSUE_CRITICAL,
                    ],
                },
                {
                    channel: NOTIFICATION_CHANNEL.TEAMS,
                    enabled: false,
                    events: [NOTIFICATION_EVENT.REPORT_READY],
                },
            ],
        })

        expect(preferences.canReceive(NOTIFICATION_CHANNEL.EMAIL, NOTIFICATION_EVENT.MENTION)).toBe(true)
        expect(preferences.canReceive(NOTIFICATION_CHANNEL.EMAIL, NOTIFICATION_EVENT.REPORT_READY)).toBe(false)
        expect(preferences.isChannelEnabled(NOTIFICATION_CHANNEL.EMAIL)).toBe(true)
        expect(preferences.isChannelEnabled(NOTIFICATION_CHANNEL.TEAMS)).toBe(false)
        expect(preferences.channels[0]?.events).toEqual([
            NOTIFICATION_EVENT.MENTION,
            NOTIFICATION_EVENT.ISSUE_CRITICAL,
        ])
    })

    test("throws for duplicate channel config", () => {
        expect(() => {
            NotificationPreferences.create({
                userId: "user-99",
                channels: [
                    {
                        channel: NOTIFICATION_CHANNEL.WEBHOOK,
                        enabled: true,
                        events: [NOTIFICATION_EVENT.DRIFT_ALERT],
                    },
                    {
                        channel: NOTIFICATION_CHANNEL.WEBHOOK,
                        enabled: false,
                        events: [NOTIFICATION_EVENT.REVIEW_COMPLETED],
                    },
                ],
            })
        }).toThrow("Duplicate notification channel config: WEBHOOK")
    })

    test("serializes to persistence payload", () => {
        const preferences = NotificationPreferences.create({
            userId: "user-json",
            channels: [
                {
                    channel: NOTIFICATION_CHANNEL.WEBHOOK,
                    enabled: false,
                    events: [NOTIFICATION_EVENT.REVIEW_COMPLETED],
                },
            ],
        })

        expect(preferences.toJSON()).toEqual({
            userId: "user-json",
            channels: [
                {
                    channel: NOTIFICATION_CHANNEL.WEBHOOK,
                    enabled: false,
                    events: [NOTIFICATION_EVENT.REVIEW_COMPLETED],
                },
            ],
        })
    })
})
