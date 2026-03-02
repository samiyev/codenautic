export {
    INBOX_DEDUP_STATUS,
    OUTBOX_WRITE_STATUS,
    type IInboxDeduplicationResult,
    type IOutboxMessageRecord,
    type IOutboxWriteRequest,
    type IOutboxWriteResult,
    type InboxDedupStatus,
    type OutboxWriteStatus,
} from "./contracts/message.contract"
export {
    MESSAGING_ADAPTER_ERROR_CODE,
    MessagingAdapterError,
    type MessagingAdapterErrorCode,
} from "./errors/messaging-adapter.error"
export {OutboxWriterAdapter} from "./outbox/outbox-writer.adapter"
export {InboxDeduplicatorAdapter} from "./inbox/inbox-deduplicator.adapter"
export {MESSAGING_TOKENS} from "./messaging.tokens"
export {
    registerMessagingModule,
    type IMessagingModuleOverrides,
} from "./register-messaging.module"
