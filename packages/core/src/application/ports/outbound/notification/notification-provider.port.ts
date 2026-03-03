import type {INotificationPayload} from "../../../dto/notifications/notification-payload.dto"
import type {NotificationChannel} from "../../../../domain/value-objects/notification-channel.value-object"

/**
 * Contract for outbound notification provider by channel.
 */
export interface INotificationProvider {
    /**
     * Supported channel for this provider.
     */
    readonly channel: NotificationChannel

    /**
     * Sends notification payload.
     *
     * @param payload Notification payload.
     */
    send(payload: INotificationPayload): Promise<void>
}
