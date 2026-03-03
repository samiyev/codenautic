import type {INotificationPayload} from "../../../dto/notifications/notification-payload.dto"

/**
 * Contract for outbound notification orchestration.
 */
export interface INotificationService {
    /**
     * Sends one notification payload.
     *
     * @param payload Notification payload.
     */
    send(payload: INotificationPayload): Promise<void>

    /**
     * Sends list of notification payloads.
     *
     * @param payloads Notification payloads.
     */
    sendBatch(payloads: readonly INotificationPayload[]): Promise<void>
}
