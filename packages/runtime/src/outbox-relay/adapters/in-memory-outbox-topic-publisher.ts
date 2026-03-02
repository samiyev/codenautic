import type {IOutboxTopicPublisher} from "../ports/outbox-topic-publisher.port"
import type {IOutboxPublishMetadata} from "../outbox-relay.types"

/**
 * Published outbox message snapshot.
 */
export interface IPublishedOutboxMessage {
    topic: string
    payload: Record<string, unknown>
    metadata: IOutboxPublishMetadata
}

/**
 * In-memory topic publisher with optional scripted failures.
 */
export class InMemoryOutboxTopicPublisher implements IOutboxTopicPublisher {
    public readonly publishedMessages: IPublishedOutboxMessage[]
    private readonly scriptedFailures: readonly (Error | null)[]
    private failureCursor: number

    /**
     * Creates publisher instance.
     *
     * @param scriptedFailures Optional per-attempt failure script.
     */
    public constructor(scriptedFailures: readonly (Error | null)[] = []) {
        this.publishedMessages = []
        this.scriptedFailures = scriptedFailures
        this.failureCursor = 0
    }

    /**
     * Publishes message to in-memory list.
     *
     * @param topic Target topic.
     * @param payload Message payload.
     * @param metadata Outbox publish metadata.
     * @returns Promise resolved after publish.
     */
    public publish(
        topic: string,
        payload: Record<string, unknown>,
        metadata: IOutboxPublishMetadata,
    ): Promise<void> {
        const scriptedFailure = this.scriptedFailures[this.failureCursor]
        if (scriptedFailure !== undefined) {
            this.failureCursor += 1
            if (scriptedFailure !== null) {
                throw scriptedFailure
            }
        }

        this.publishedMessages.push({
            topic,
            payload: {...payload},
            metadata: {
                messageId: metadata.messageId,
            },
        })

        return Promise.resolve()
    }
}
