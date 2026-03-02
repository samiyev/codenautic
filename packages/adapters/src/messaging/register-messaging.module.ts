import {Container} from "@codenautic/core"

import {InboxDeduplicatorAdapter} from "./inbox/inbox-deduplicator.adapter"
import {MESSAGING_TOKENS} from "./messaging.tokens"
import {OutboxWriterAdapter} from "./outbox/outbox-writer.adapter"

/**
 * Optional dependency overrides for messaging module registration.
 */
export interface IMessagingModuleOverrides {
    outboxWriter?: OutboxWriterAdapter
    inboxDeduplicator?: InboxDeduplicatorAdapter
}

/**
 * Registers messaging adapter module into target container.
 *
 * @param container Target IoC container.
 * @param overrides Optional dependency overrides.
 * @returns Same container instance for chaining.
 */
export function registerMessagingModule(
    container: Container,
    overrides: IMessagingModuleOverrides = {},
): Container {
    container.bindSingleton(MESSAGING_TOKENS.OutboxWriter, () => {
        return overrides.outboxWriter ?? new OutboxWriterAdapter()
    })
    container.bindSingleton(MESSAGING_TOKENS.InboxDeduplicator, () => {
        return overrides.inboxDeduplicator ?? new InboxDeduplicatorAdapter()
    })

    return container
}
