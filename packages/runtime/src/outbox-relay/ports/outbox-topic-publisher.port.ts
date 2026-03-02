import type {IOutboxPublishMetadata} from "../outbox-relay.types"

/**
 * Publisher contract for outbox relay target topic.
 */
export interface IOutboxTopicPublisher {
    /**
     * Publishes payload to messaging topic.
     *
     * @param topic Target topic name.
     * @param payload Serialized event payload.
     * @param metadata Outbox metadata used for tracing/idempotency.
     * @returns Promise resolved after publish.
     */
    publish(
        topic: string,
        payload: Record<string, unknown>,
        metadata: IOutboxPublishMetadata,
    ): Promise<void>
}
