import {Result} from "@codenautic/core"

import {
    INBOX_DEDUP_STATUS,
    type IInboxDeduplicationResult,
} from "../contracts/message.contract"
import {MESSAGING_ADAPTER_ERROR_CODE, MessagingAdapterError} from "../errors/messaging-adapter.error"

/**
 * In-memory inbox deduplicator with exactly-once semantics by message key.
 */
export class InboxDeduplicatorAdapter {
    private readonly processedKeys: Set<string>

    /**
     * Creates inbox deduplicator adapter.
     */
    public constructor() {
        this.processedKeys = new Set<string>()
    }

    /**
     * Registers message processing attempt by message key.
     *
     * @param messageKey Idempotency key of message.
     * @returns Accepted or duplicate deduplication result.
     */
    public register(messageKey: string): Result<IInboxDeduplicationResult, MessagingAdapterError> {
        const normalizedKey = normalizeNonEmptyString(messageKey)
        if (normalizedKey === undefined) {
            return Result.fail(createInvalidMessageError("messageKey must be a non-empty string"))
        }

        if (this.processedKeys.has(normalizedKey)) {
            return Result.ok({
                status: INBOX_DEDUP_STATUS.DUPLICATE,
                messageKey: normalizedKey,
                accepted: false,
            })
        }

        this.processedKeys.add(normalizedKey)
        return Result.ok({
            status: INBOX_DEDUP_STATUS.ACCEPTED,
            messageKey: normalizedKey,
            accepted: true,
        })
    }
}

/**
 * Creates invalid message validation error.
 *
 * @param message Error message.
 * @returns Messaging adapter validation error.
 */
function createInvalidMessageError(message: string): MessagingAdapterError {
    return new MessagingAdapterError({
        code: MESSAGING_ADAPTER_ERROR_CODE.INVALID_MESSAGE,
        message,
        retryable: false,
    })
}

/**
 * Normalizes unknown value into trimmed non-empty string.
 *
 * @param value Unknown value.
 * @returns Trimmed string when valid.
 */
function normalizeNonEmptyString(value: unknown): string | undefined {
    if (typeof value !== "string") {
        return undefined
    }

    const normalized = value.trim()
    if (normalized.length === 0) {
        return undefined
    }

    return normalized
}
