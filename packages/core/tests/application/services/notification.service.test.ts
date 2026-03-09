import {describe, expect, test} from "bun:test"

import type {INotificationPayload} from "../../../src/application/dto/notifications/notification-payload.dto"
import {NotificationService} from "../../../src/application/services/notification.service"
import type {INotificationProvider} from "../../../src/application/ports/outbound/notification/notification-provider.port"
import {
    NOTIFICATION_CHANNEL,
    NOTIFICATION_EVENT,
    NOTIFICATION_URGENCY,
    type NotificationChannel,
} from "../../../src/domain/value-objects/notification-channel.value-object"

class TestNotificationProvider implements INotificationProvider {
    private readonly channelValue: NotificationChannel
    private readonly sendHistory: INotificationPayload[]

    public constructor(channel: NotificationChannel) {
        this.channelValue = channel
        this.sendHistory = []
    }

    public get channel(): NotificationChannel {
        return this.channelValue
    }

    public get history(): readonly INotificationPayload[] {
        return this.sendHistory
    }

    public send(payload: INotificationPayload): Promise<void> {
        this.sendHistory.push(payload)
        return Promise.resolve()
    }
}

function createPayload(
    channel: NotificationChannel,
): INotificationPayload {
    return {
        channel,
        event: NOTIFICATION_EVENT.REVIEW_COMPLETED,
        recipients: ["alice", "bob", "alice"],
        title: `Title for ${channel}`,
        body: `Body for ${channel}`,
        metadata: {source: "unit-test"},
        urgency: NOTIFICATION_URGENCY.NORMAL,
    }
}

describe("NotificationService", () => {
    test("dispatches payload to configured provider", async () => {
        const slack = new TestNotificationProvider(NOTIFICATION_CHANNEL.SLACK)
        const service = new NotificationService({
            providers: [slack],
        })

        await service.send(createPayload(NOTIFICATION_CHANNEL.SLACK))

        expect(slack.history).toHaveLength(1)
        expect(slack.history[0]?.channel).toBe(NOTIFICATION_CHANNEL.SLACK)
        expect(slack.history[0]?.recipients).toEqual(["alice", "bob"])
    })

    test("sends batch payloads sequentially by order", async () => {
        const slack = new TestNotificationProvider(NOTIFICATION_CHANNEL.SLACK)
        const teams = new TestNotificationProvider(NOTIFICATION_CHANNEL.TEAMS)
        const service = new NotificationService({
            providers: [slack, teams],
        })

        await service.sendBatch([
            createPayload(NOTIFICATION_CHANNEL.TEAMS),
            createPayload(NOTIFICATION_CHANNEL.SLACK),
        ])

        expect(teams.history).toHaveLength(1)
        expect(slack.history).toHaveLength(1)
        expect(teams.history[0]?.title).toBe("Title for TEAMS")
        expect(slack.history[0]?.title).toBe("Title for SLACK")
    })

    test("uses fallback provider when target channel is absent", async () => {
        const webhook = new TestNotificationProvider(NOTIFICATION_CHANNEL.WEBHOOK)
        const service = new NotificationService({
            providers: [webhook],
            fallbackChannel: NOTIFICATION_CHANNEL.WEBHOOK,
        })

        await service.send(createPayload(NOTIFICATION_CHANNEL.TEAMS))

        expect(webhook.history).toHaveLength(1)
        expect(webhook.history[0]?.channel).toBe(NOTIFICATION_CHANNEL.TEAMS)
    })

    test("throws when provider is missing and fallback unavailable", () => {
        const service = new NotificationService({
            providers: [],
            fallbackChannel: NOTIFICATION_CHANNEL.WEBHOOK,
        })

        expect(service.send(createPayload(NOTIFICATION_CHANNEL.TEAMS))).rejects.toThrow(
            "No notification provider for channel: TEAMS",
        )
    })

    test("rejects payload with invalid recipients", () => {
        const service = new NotificationService({
            providers: [new TestNotificationProvider(NOTIFICATION_CHANNEL.WEBHOOK)],
        })

        const invalid = {
            channel: NOTIFICATION_CHANNEL.WEBHOOK,
            event: NOTIFICATION_EVENT.REVIEW_COMPLETED,
            recipients: [],
            title: "t",
            body: "b",
            urgency: NOTIFICATION_URGENCY.LOW,
        } as INotificationPayload

        expect(service.send(invalid)).rejects.toThrow("At least one recipient is required")
    })

    test("normalizes optional dedupe key before dispatch", async () => {
        const slack = new TestNotificationProvider(NOTIFICATION_CHANNEL.SLACK)
        const service = new NotificationService({
            providers: [slack],
        })

        await service.send({
            ...createPayload(NOTIFICATION_CHANNEL.SLACK),
            dedupeKey: "  review:1  ",
        })

        expect(slack.history[0]?.dedupeKey).toBe("review:1")
    })

    test("rejects empty dedupe key", () => {
        const service = new NotificationService({
            providers: [new TestNotificationProvider(NOTIFICATION_CHANNEL.WEBHOOK)],
        })

        expect(
            service.send({
                ...createPayload(NOTIFICATION_CHANNEL.WEBHOOK),
                dedupeKey: "   ",
            }),
        ).rejects.toThrow("dedupeKey cannot be empty")
    })
})
