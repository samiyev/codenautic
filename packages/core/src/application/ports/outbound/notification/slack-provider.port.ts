import type {IWebhookEventDTO} from "../../../dto/common/webhook-event.dto"
import type {ISlackEventEnvelopeDTO} from "../../../dto/notifications/slack-event-envelope.dto"

import type {INotificationProvider} from "./notification-provider.port"

/**
 * Slack-specific notification provider contract.
 */
export interface ISlackProvider extends INotificationProvider {
    /**
     * Verifies Slack request signature against configured signing secret.
     *
     * @param event Webhook event DTO.
     * @param rawBody Optional raw request body used for signature base string.
     * @returns True when signature is valid and timestamp is inside tolerance window.
     */
    verifyEventSignature(event: IWebhookEventDTO, rawBody?: string): boolean

    /**
     * Parses generic webhook DTO into normalized Slack Events API envelope.
     *
     * @param event Webhook event DTO.
     * @returns Normalized Slack event envelope.
     */
    parseEventEnvelope(event: IWebhookEventDTO): ISlackEventEnvelopeDTO

    /**
     * Resolves Slack URL verification challenge payload when present.
     *
     * @param envelope Normalized Slack envelope.
     * @returns Challenge string or null for non-challenge envelopes.
     */
    resolveUrlVerificationChallenge(envelope: ISlackEventEnvelopeDTO): string | null
}
