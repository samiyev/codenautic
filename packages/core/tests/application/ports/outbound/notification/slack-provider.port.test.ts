import {describe, expect, test} from "bun:test"

import {
    NOTIFICATION_CHANNEL,
    NOTIFICATION_EVENT,
    NOTIFICATION_URGENCY,
    SLACK_EVENT_ENVELOPE_TYPE,
    type INotificationPayload,
    type ISlackEventEnvelopeDTO,
    type ISlackProvider,
    type IWebhookEventDTO,
} from "../../../../../src"

class InMemorySlackProvider implements ISlackProvider {
    public readonly channel = NOTIFICATION_CHANNEL.SLACK

    private readonly historyValue: INotificationPayload[]

    public constructor() {
        this.historyValue = []
    }

    public get history(): readonly INotificationPayload[] {
        return this.historyValue
    }

    public send(payload: INotificationPayload): Promise<void> {
        this.historyValue.push(payload)
        return Promise.resolve()
    }

    public verifyEventSignature(event: IWebhookEventDTO): boolean {
        return event.signature === "v0=valid"
    }

    public parseEventEnvelope(event: IWebhookEventDTO): ISlackEventEnvelopeDTO {
        const payload = event.payload as {
            readonly type?: string
            readonly challenge?: string
        }

        return {
            type: payload.type ?? SLACK_EVENT_ENVELOPE_TYPE.EVENT_CALLBACK,
            challenge: payload.challenge,
        }
    }

    public resolveUrlVerificationChallenge(envelope: ISlackEventEnvelopeDTO): string | null {
        if (envelope.type !== SLACK_EVENT_ENVELOPE_TYPE.URL_VERIFICATION) {
            return null
        }

        return envelope.challenge ?? null
    }
}

describe("ISlackProvider contract", () => {
    test("supports idempotent notification send payload shape", async () => {
        const provider = new InMemorySlackProvider()
        const payload: INotificationPayload = {
            channel: NOTIFICATION_CHANNEL.SLACK,
            event: NOTIFICATION_EVENT.REVIEW_COMPLETED,
            recipients: ["C123"],
            title: "Review completed",
            body: "Merge request is ready",
            dedupeKey: "review:123",
            urgency: NOTIFICATION_URGENCY.NORMAL,
        }

        await provider.send(payload)

        expect(provider.history[0]?.dedupeKey).toBe("review:123")
        expect(provider.history[0]?.channel).toBe(NOTIFICATION_CHANNEL.SLACK)
    })

    test("supports Slack signature verification and challenge resolution", () => {
        const provider = new InMemorySlackProvider()
        const event: IWebhookEventDTO = {
            eventType: "event_callback",
            payload: {
                type: SLACK_EVENT_ENVELOPE_TYPE.URL_VERIFICATION,
                challenge: "abc123",
            },
            signature: "v0=valid",
            platform: "slack",
            timestamp: new Date("2026-03-09T09:10:00.000Z"),
        }

        const envelope = provider.parseEventEnvelope(event)

        expect(provider.verifyEventSignature(event)).toBe(true)
        expect(provider.resolveUrlVerificationChallenge(envelope)).toBe("abc123")
    })
})
