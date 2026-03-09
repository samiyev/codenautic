/**
 * Platform-agnostic webhook payload for signature verification.
 */
export interface IWebhookEventDTO {
    /**
     * Upstream event type label.
     */
    readonly eventType: string

    /**
     * Decoded webhook body payload.
     */
    readonly payload: unknown

    /**
     * Raw upstream signature header value.
     */
    readonly signature: string

    /**
     * External platform identifier.
     */
    readonly platform: string

    /**
     * Upstream request timestamp.
     */
    readonly timestamp: Date
}
