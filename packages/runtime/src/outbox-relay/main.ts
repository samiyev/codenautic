import {type IOutboxRelayResult} from "./outbox-relay.types"
import {
    OUTBOX_RELAY_TOKENS,
    type IOutboxRelayContainerOverrides,
    createOutboxRelayContainer,
} from "./outbox-relay.container"

/**
 * Starts outbox-relay process.
 *
 * @returns Promise resolved when process is initialized.
 */
export async function startOutboxRelayConsumer(): Promise<void> {
    const container = createOutboxRelayContainer()
    const logger = container.resolve(OUTBOX_RELAY_TOKENS.Logger)

    await logger.info("outbox-relay started")
}

/**
 * Runs outbox-relay once for message id.
 *
 * @param messageId Outbox message identifier.
 * @param overrides Optional dependency overrides.
 * @returns Relay execution result.
 */
export async function runOutboxRelayOnce(
    messageId: string,
    overrides: IOutboxRelayContainerOverrides = {},
): Promise<IOutboxRelayResult> {
    const container = createOutboxRelayContainer(overrides)
    const consumer = container.resolve(OUTBOX_RELAY_TOKENS.OutboxRelayConsumer)

    return consumer.consume(messageId)
}
