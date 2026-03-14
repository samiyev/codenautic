import {createToken} from "@codenautic/core"

import type {InboxDeduplicator} from "./inbox-deduplicator.adapter"
import type {OutboxWriter} from "./outbox-writer.adapter"

/**
 * DI tokens for messaging adapter domain.
 */
export const MESSAGING_TOKENS = {
    InboxDeduplicator: createToken<InboxDeduplicator>("adapters.messaging.inbox-deduplicator"),
    OutboxWriter: createToken<OutboxWriter>("adapters.messaging.outbox-writer"),
} as const

