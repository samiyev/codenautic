import {Container, createToken} from "@codenautic/core"

import {InMemoryRuntimeLogger} from "../review-worker/adapters/in-memory-runtime-logger"
import type {IRuntimeLogger} from "../review-worker/ports/runtime-logger.port"
import {InMemoryOutboxRelayRepository} from "./adapters/in-memory-outbox-relay-repository"
import {InMemoryOutboxTopicPublisher} from "./adapters/in-memory-outbox-topic-publisher"
import {OutboxRelayConsumer} from "./outbox-relay.consumer"
import type {IOutboxRelayRepository} from "./ports/outbox-relay-repository.port"
import type {IOutboxTopicPublisher} from "./ports/outbox-topic-publisher.port"
import {
    DEFAULT_OUTBOX_RELAY_RETRY_POLICY,
    type IOutboxRelayRetryPolicy,
} from "./outbox-relay.types"

/**
 * Runtime outbox-relay tokens.
 */
export const OUTBOX_RELAY_TOKENS = {
    Logger: createToken<IRuntimeLogger>("runtime.outbox-relay.logger"),
    Repository: createToken<IOutboxRelayRepository>("runtime.outbox-relay.repository"),
    Publisher: createToken<IOutboxTopicPublisher>("runtime.outbox-relay.publisher"),
    RetryPolicy: createToken<IOutboxRelayRetryPolicy>("runtime.outbox-relay.retry-policy"),
    OutboxRelayConsumer: createToken<OutboxRelayConsumer>("runtime.outbox-relay.consumer"),
} as const

/**
 * Optional dependency overrides for outbox-relay composition root.
 */
export interface IOutboxRelayContainerOverrides {
    repository?: IOutboxRelayRepository
    publisher?: IOutboxTopicPublisher
    logger?: IRuntimeLogger
    retryPolicy?: IOutboxRelayRetryPolicy
}

/**
 * Creates outbox-relay composition root.
 *
 * @param overrides Optional dependency overrides.
 * @returns Configured runtime container.
 */
export function createOutboxRelayContainer(
    overrides: IOutboxRelayContainerOverrides = {},
): Container {
    const container = new Container()

    container.bindSingleton(OUTBOX_RELAY_TOKENS.Logger, () => {
        return overrides.logger ?? new InMemoryRuntimeLogger({process: "outbox-relay"})
    })

    container.bindSingleton(OUTBOX_RELAY_TOKENS.Repository, () => {
        return overrides.repository ?? new InMemoryOutboxRelayRepository()
    })

    container.bindSingleton(OUTBOX_RELAY_TOKENS.Publisher, () => {
        return overrides.publisher ?? new InMemoryOutboxTopicPublisher()
    })

    container.bindSingleton(OUTBOX_RELAY_TOKENS.RetryPolicy, () => {
        return overrides.retryPolicy ?? DEFAULT_OUTBOX_RELAY_RETRY_POLICY
    })

    container.bindSingleton(OUTBOX_RELAY_TOKENS.OutboxRelayConsumer, () => {
        const repository = container.resolve(OUTBOX_RELAY_TOKENS.Repository)
        const publisher = container.resolve(OUTBOX_RELAY_TOKENS.Publisher)
        const logger = container.resolve(OUTBOX_RELAY_TOKENS.Logger)
        const retryPolicy = container.resolve(OUTBOX_RELAY_TOKENS.RetryPolicy)

        return new OutboxRelayConsumer(repository, publisher, logger, retryPolicy)
    })

    return container
}
