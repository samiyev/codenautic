import type {INotificationPayload} from "../dto/notifications/notification-payload.dto"
import type {NotificationChannel} from "../../domain/value-objects/notification-channel.value-object"
import {
    NOTIFICATION_CHANNEL,
    type NotificationEvent,
    type NotificationUrgency,
    isNotificationChannel,
    isNotificationEvent,
    isNotificationUrgency,
} from "../../domain/value-objects/notification-channel.value-object"
import type {INotificationProvider} from "../ports/outbound/notification/notification-provider.port"
import type {INotificationService} from "../ports/outbound/notification/notification-service.port"

/**
 * Dependencies for notification service.
 */
export interface INotificationServiceDependencies {
    /**
     * Notification providers by channel.
     */
    readonly providers?: readonly INotificationProvider[]

    /**
     * Fallback channel for missing provider.
     */
    readonly fallbackChannel?: NotificationChannel
}

/**
 * Service that routes notification payloads to channel providers.
 */
export class NotificationService implements INotificationService {
    private readonly providersByChannel: Map<NotificationChannel, INotificationProvider>
    private readonly fallbackChannel: NotificationChannel

    /**
     * Creates notification service.
     *
     * @param dependencies Construction dependencies.
     */
    public constructor(dependencies: INotificationServiceDependencies = {}) {
        this.providersByChannel = new Map<NotificationChannel, INotificationProvider>()
        this.fallbackChannel = dependencies.fallbackChannel ?? NOTIFICATION_CHANNEL.WEBHOOK

        for (const provider of dependencies.providers ?? []) {
            if (this.providersByChannel.has(provider.channel)) {
                throw new Error(`Duplicate notification provider for channel: ${provider.channel}`)
            }

            this.providersByChannel.set(provider.channel, provider)
        }
    }

    /**
     * {@inheritdoc}
     */
    public async send(payload: INotificationPayload): Promise<void> {
        const normalizedPayload = normalizeNotificationPayload(payload)
        const provider = this.resolveProvider(normalizedPayload.channel)
        await provider.send(normalizedPayload)
    }

    /**
     * {@inheritdoc}
     */
    public async sendBatch(payloads: readonly INotificationPayload[]): Promise<void> {
        for (const payload of payloads) {
            await this.send(payload)
        }
    }

    /**
     * Resolve provider with deterministic fallback.
     *
     * @param channel Requested channel.
     * @returns Provider instance.
     */
    private resolveProvider(channel: NotificationChannel): INotificationProvider {
        const direct = this.providersByChannel.get(channel)
        if (direct !== undefined) {
            return direct
        }

        if (channel !== this.fallbackChannel) {
            const fallbackProvider = this.providersByChannel.get(this.fallbackChannel)
            if (fallbackProvider !== undefined) {
                return fallbackProvider
            }
        }

        throw new Error(`No notification provider for channel: ${channel}`)
    }
}

/**
 * Validate and normalize notification payload before sending.
 *
 * @param payload Raw payload.
 * @returns Normalized payload.
 */
function normalizeNotificationPayload(payload: INotificationPayload): INotificationPayload {
    const channel = validateChannel(payload.channel as string)
    const event = validateEvent(payload.event as string)
    const urgency = validateUrgency(payload.urgency as string)
    const recipients = normalizeRecipients(payload.recipients)
    const title = normalizeText(payload.title, "title")
    const body = normalizeText(payload.body, "body")
    const metadata = normalizeMetadata(payload.metadata)

    return {
        channel,
        event,
        recipients,
        title,
        body,
        metadata,
        urgency,
    }
}

/**
 * Validate channel value.
 *
 * @param channel Candidate channel.
 * @returns Notification channel.
 */
function validateChannel(channel: string): NotificationChannel {
    if (isNotificationChannel(channel) === false) {
        throw new Error(`Unsupported notification channel: ${channel}`)
    }

    return channel
}

/**
 * Validate event value.
 *
 * @param event Candidate event.
 * @returns Notification event.
 */
function validateEvent(event: string): NotificationEvent {
    if (isNotificationEvent(event) === false) {
        throw new Error(`Unsupported notification event: ${event}`)
    }

    return event
}

/**
 * Validate urgency value.
 *
 * @param urgency Candidate urgency.
 * @returns Notification urgency.
 */
function validateUrgency(urgency: string): NotificationUrgency {
    if (isNotificationUrgency(urgency) === false) {
        throw new Error(`Unsupported notification urgency: ${urgency}`)
    }

    return urgency
}

/**
 * Normalize non-empty recipients.
 *
 * @param recipients Raw recipients.
 * @returns Deduplicated normalized recipients.
 */
function normalizeRecipients(recipients: readonly string[]): readonly string[] {
    if (recipients.length === 0) {
        throw new Error("At least one recipient is required")
    }

    const normalized = new Set<string>()
    for (const rawRecipient of recipients) {
        if (typeof rawRecipient !== "string") {
            throw new Error("Recipient must be a string")
        }

        const recipient = rawRecipient.trim()
        if (recipient.length === 0) {
            throw new Error("Recipient cannot be empty")
        }

        normalized.add(recipient)
    }

    return [...normalized]
}

/**
 * Validates non-empty text fields.
 *
 * @param value Raw text.
 * @param fieldName Field name for error.
 * @returns Normalized text.
 */
function normalizeText(value: string, fieldName: "title" | "body"): string {
    if (typeof value !== "string") {
        throw new Error(`${fieldName} must be a string`)
    }

    const normalized = value.trim()
    if (normalized.length === 0) {
        throw new Error(`${fieldName} cannot be empty`)
    }

    return normalized
}

/**
 * Validates optional metadata payload.
 *
 * @param metadata Unknown metadata.
 * @returns Cloned metadata or undefined.
 */
function normalizeMetadata(
    metadata: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> | undefined {
    if (metadata === undefined) {
        return undefined
    }

    if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) {
        throw new Error("Metadata must be a plain object")
    }

    return {...metadata}
}
