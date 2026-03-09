/**
 * Supported normalized Slack Events API envelope types.
 */
export const SLACK_EVENT_ENVELOPE_TYPE = {
    URL_VERIFICATION: "url_verification",
    EVENT_CALLBACK: "event_callback",
} as const

/**
 * Slack Events API envelope type.
 */
export type SlackEventEnvelopeType =
    (typeof SLACK_EVENT_ENVELOPE_TYPE)[keyof typeof SLACK_EVENT_ENVELOPE_TYPE]

/**
 * Normalized Slack inner event payload.
 */
export interface ISlackEventBodyDTO {
    /**
     * Slack event type.
     */
    readonly type: string

    /**
     * Optional Slack subtype for message-like events.
     */
    readonly subtype?: string

    /**
     * Optional Slack channel identifier.
     */
    readonly channel?: string

    /**
     * Optional Slack user identifier.
     */
    readonly user?: string

    /**
     * Optional event text body.
     */
    readonly text?: string

    /**
     * Optional event timestamp.
     */
    readonly eventTs?: string

    /**
     * Optional message timestamp.
     */
    readonly ts?: string

    /**
     * Optional thread timestamp.
     */
    readonly threadTs?: string

    /**
     * Optional bot identifier when event was produced by a bot.
     */
    readonly botId?: string

    /**
     * Preserves additional Slack event fields without widening contracts to `any`.
     */
    readonly [key: string]: unknown
}

/**
 * Normalized Slack Events API outer envelope.
 */
export interface ISlackEventEnvelopeDTO {
    /**
     * Slack envelope type.
     */
    readonly type: string

    /**
     * Optional verification token.
     */
    readonly token?: string

    /**
     * Optional URL verification challenge.
     */
    readonly challenge?: string

    /**
     * Optional Slack team identifier.
     */
    readonly teamId?: string

    /**
     * Optional Slack app identifier.
     */
    readonly apiAppId?: string

    /**
     * Optional Slack event id used for deduplication.
     */
    readonly eventId?: string

    /**
     * Optional Unix epoch event time.
     */
    readonly eventTime?: number

    /**
     * Optional normalized inner event payload.
     */
    readonly event?: ISlackEventBodyDTO

    /**
     * Optional authenticated user list.
     */
    readonly authedUsers?: readonly string[]

    /**
     * Optional raw authorizations payload.
     */
    readonly authorizations?: readonly Readonly<Record<string, unknown>>[]
}
