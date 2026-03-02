import {createToken} from "@codenautic/core"

import {InboxDeduplicatorAdapter} from "./inbox/inbox-deduplicator.adapter"
import {OutboxWriterAdapter} from "./outbox/outbox-writer.adapter"

/**
 * Messaging domain IoC tokens.
 */
export const MESSAGING_TOKENS = {
    OutboxWriter: createToken<OutboxWriterAdapter>("adapters.messaging.outbox-writer"),
    InboxDeduplicator: createToken<InboxDeduplicatorAdapter>(
        "adapters.messaging.inbox-deduplicator",
    ),
} as const
