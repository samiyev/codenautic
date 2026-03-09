import {describe, expect, test} from "bun:test"

import type {IWebhookEventDTO} from "../../../../src/application/dto/common/webhook-event.dto"

describe("common IWebhookEventDTO", () => {
    test("supports platform-agnostic webhook payloads", () => {
        const event: IWebhookEventDTO = {
            eventType: "event_callback",
            payload: {
                type: "url_verification",
                challenge: "abc123",
            },
            signature: "v0=abc",
            platform: "slack",
            timestamp: new Date("2026-03-09T09:00:00.000Z"),
        }

        expect(event.eventType).toBe("event_callback")
        expect(event.platform).toBe("slack")
        expect(event.timestamp.toISOString()).toBe("2026-03-09T09:00:00.000Z")
    })
})
