import {describe, expect, test} from "bun:test"

import {
    SLACK_EVENT_ENVELOPE_TYPE,
    type ISlackEventEnvelopeDTO,
} from "../../../../src/application/dto/notifications/slack-event-envelope.dto"

describe("ISlackEventEnvelopeDTO", () => {
    test("supports url verification challenge payload", () => {
        const envelope: ISlackEventEnvelopeDTO = {
            type: SLACK_EVENT_ENVELOPE_TYPE.URL_VERIFICATION,
            challenge: "challenge-token",
            token: "legacy-token",
        }

        expect(envelope.type).toBe("url_verification")
        expect(envelope.challenge).toBe("challenge-token")
    })

    test("supports normalized event callback payload", () => {
        const envelope: ISlackEventEnvelopeDTO = {
            type: SLACK_EVENT_ENVELOPE_TYPE.EVENT_CALLBACK,
            teamId: "T123",
            apiAppId: "A123",
            eventId: "Ev123",
            eventTime: 1_773_013_200,
            authedUsers: ["U123"],
            event: {
                type: "app_mention",
                channel: "C123",
                user: "U123",
                text: "hello bot",
                eventTs: "1773013200.000100",
            },
        }

        expect(envelope.eventId).toBe("Ev123")
        expect(envelope.event?.type).toBe("app_mention")
        expect(envelope.authedUsers).toEqual(["U123"])
    })
})
