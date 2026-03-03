import {UniqueId} from "./unique-id.value-object"
import {
    isNotificationChannel,
    isNotificationEvent,
    type NotificationChannel,
    type NotificationEvent,
} from "./notification-channel.value-object"

/**
 * Per-channel notification preferences.
 */
export interface INotificationChannelPreference {
    /**
     * Notification channel.
     */
    readonly channel: NotificationChannel

    /**
     * Whether channel is enabled.
     */
    readonly enabled: boolean

    /**
     * Events allowed for this channel.
     */
    readonly events: readonly NotificationEvent[]
}

/**
 * Input for creating notification preferences.
 */
export interface INotificationPreferencesInput {
    /**
     * Target user id.
     */
    readonly userId: string | UniqueId

    /**
     * Optional per-channel preferences.
     */
    readonly channels?: readonly INotificationChannelPreference[]
}

/**
 * Persistence payload for notification preferences.
 */
export interface INotificationPreferencesProps {
    /**
     * Target user id as serialized identifier.
     */
    readonly userId: string

    /**
     * Normalized per-channel settings.
     */
    readonly channels: readonly INotificationChannelPreference[]
}

/**
 * Immutable value object for notification channel preferences.
 */
export class NotificationPreferences {
    private readonly userIdValue: UniqueId
    private readonly channelsValue: readonly INotificationChannelPreference[]

    /**
     * Creates notification preferences object.
     *
     * @param props Normalized props.
     */
    private constructor(props: INotificationPreferencesProps) {
        this.userIdValue = UniqueId.create(props.userId)
        this.channelsValue = props.channels
        Object.freeze(this)
    }

    /**
     * Creates immutable notification preferences.
     *
     * @param input Input shape.
     * @returns Preferences object.
     */
    public static create(input: INotificationPreferencesInput): NotificationPreferences {
        const userId = normalizeUserId(input.userId)
        const channels = normalizeChannels(input.channels)

        return new NotificationPreferences({
            userId: userId.value,
            channels,
        })
    }

    /**
     * Identifier of profile user.
     *
     * @returns Immutable user identifier.
     */
    public get userId(): UniqueId {
        return this.userIdValue
    }

    /**
     * Normalized channel settings.
     *
     * @returns Cloned array of channel preferences.
     */
    public get channels(): readonly INotificationChannelPreference[] {
        return this.channelsValue.map((item) => {
            return {
                channel: item.channel,
                enabled: item.enabled,
                events: [...item.events],
            }
        })
    }

    /**
     * Checks if channel enabled in preferences.
     *
     * @param channel Channel to check.
     * @returns True when channel exists and enabled.
     */
    public isChannelEnabled(channel: NotificationChannel): boolean {
        const config = this.channelsValue.find((item) => item.channel === channel)
        return config !== undefined && config.enabled
    }

    /**
     * Checks whether channel can receive event.
     *
     * @param channel Channel.
     * @param event Event.
     * @returns True when enabled and event is configured.
     */
    public canReceive(channel: NotificationChannel, event: NotificationEvent): boolean {
        const config = this.channelsValue.find((item) => item.channel === channel)
        return config !== undefined && config.enabled && config.events.includes(event)
    }

    /**
     * Serialize to plain object.
     *
     * @returns Persistence payload.
     */
    public toJSON(): INotificationPreferencesProps {
        return {
            userId: this.userIdValue.value,
            channels: this.channels,
        }
    }
}

/**
 * Normalizes user identifier.
 *
 * @param value User identifier.
 * @returns Normalized unique id.
 */
function normalizeUserId(value: string | UniqueId): UniqueId {
    if (value instanceof UniqueId) {
        return value
    }

    const normalized = value.trim()
    if (normalized.length === 0) {
        throw new Error("Notification preferences userId cannot be empty")
    }

    return UniqueId.create(normalized)
}

/**
 * Normalizes raw channel settings and fills missing channels.
 *
 * @param channels Input channel settings.
 * @returns Ordered normalized list.
 */
function normalizeChannels(
    channels: readonly INotificationChannelPreference[] | undefined,
): readonly INotificationChannelPreference[] {
    if (channels === undefined || channels.length === 0) {
        return []
    }

    const normalized: INotificationChannelPreference[] = []
    const uniqueChannels = new Set<string>()

    for (const channel of channels) {
        const rawChannel = normalizeString(channel.channel)
        if (isNotificationChannel(rawChannel) === false) {
            throw new Error(`Unsupported notification channel: ${channel.channel}`)
        }

        if (uniqueChannels.has(rawChannel)) {
            throw new Error(`Duplicate notification channel config: ${rawChannel}`)
        }

        const events = normalizeEvents(channel.events)
        normalized.push({
            channel: rawChannel,
            enabled: channel.enabled,
            events,
        })
        uniqueChannels.add(rawChannel)
    }

    return normalized
}

/**
 * Validates and normalizes event list.
 *
 * @param events Raw events.
 * @returns Deduplicated events list.
 */
function normalizeEvents(
    events: readonly string[],
): readonly NotificationEvent[] {
    const uniqueEvents = new Set<string>()
    for (const rawEvent of events) {
        if (isNotificationEvent(rawEvent) === false) {
            throw new Error(`Unsupported notification event: ${rawEvent}`)
        }

        uniqueEvents.add(rawEvent)
    }

    return [...uniqueEvents] as readonly NotificationEvent[]
}

/**
 * Trims and validates string value (currently used for channels).
 *
 * @param value Value to normalize.
 * @returns Trimmed value.
 */
function normalizeString(value: string): string {
    const normalized = value.trim()
    if (normalized.length === 0) {
        throw new Error("Notification channel cannot be empty")
    }

    return normalized
}
