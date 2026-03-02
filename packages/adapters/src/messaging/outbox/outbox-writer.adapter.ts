import {Result} from "@codenautic/core"

import {
    OUTBOX_WRITE_STATUS,
    type IOutboxMessageRecord,
    type IOutboxWriteRequest,
    type IOutboxWriteResult,
} from "../contracts/message.contract"
import {MESSAGING_ADAPTER_ERROR_CODE, MessagingAdapterError} from "../errors/messaging-adapter.error"

/**
 * In-memory outbox writer with idempotency by message key.
 */
export class OutboxWriterAdapter {
    private readonly storage: Map<string, IOutboxMessageRecord>
    private readonly now: () => Date

    /**
     * Creates outbox writer adapter.
     *
     * @param now Clock function used for deterministic tests.
     */
    public constructor(now: () => Date = () => new Date()) {
        this.storage = new Map<string, IOutboxMessageRecord>()
        this.now = now
    }

    /**
     * Stores outbox message idempotently by message key.
     *
     * @param request Outbox write request.
     * @returns Stored or duplicate result.
     */
    public write(request: IOutboxWriteRequest): Result<IOutboxWriteResult, MessagingAdapterError> {
        const key = normalizeNonEmptyString(request.messageKey)
        const topic = normalizeNonEmptyString(request.topic)
        if (key === undefined || topic === undefined) {
            return Result.fail(createInvalidMessageError("messageKey and topic must be non-empty strings"))
        }

        if (isPayloadObject(request.payload) === false) {
            return Result.fail(createInvalidMessageError("payload must be a plain object"))
        }

        const existingRecord = this.storage.get(key)
        if (existingRecord !== undefined) {
            return Result.ok({
                status: OUTBOX_WRITE_STATUS.DUPLICATE,
                record: cloneRecord(existingRecord),
            })
        }

        const createdRecord: IOutboxMessageRecord = {
            messageKey: key,
            topic,
            payload: clonePayload(request.payload),
            createdAt: this.now(),
        }
        this.storage.set(key, createdRecord)

        return Result.ok({
            status: OUTBOX_WRITE_STATUS.STORED,
            record: cloneRecord(createdRecord),
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
 * Validates payload shape as plain object.
 *
 * @param payload Unknown payload.
 * @returns True when payload is plain object.
 */
function isPayloadObject(payload: unknown): payload is Readonly<Record<string, unknown>> {
    if (typeof payload !== "object" || payload === null) {
        return false
    }

    return Array.isArray(payload) === false
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

/**
 * Creates immutable copy of payload object.
 *
 * @param payload Source payload.
 * @returns Cloned payload object.
 */
function clonePayload(payload: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
    return Object.freeze({...payload})
}

/**
 * Creates deep-safe record clone with copied Date and payload.
 *
 * @param record Source outbox record.
 * @returns Cloned outbox record.
 */
function cloneRecord(record: IOutboxMessageRecord): IOutboxMessageRecord {
    return {
        messageKey: record.messageKey,
        topic: record.topic,
        payload: clonePayload(record.payload),
        createdAt: new Date(record.createdAt),
    }
}
