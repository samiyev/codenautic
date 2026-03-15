import {type ILogger} from "@codenautic/core"

import {
    LANGCHAIN_CALLBACK_EVENT_TYPE,
    type ILangChainCallbackEvent,
    type ILangChainCallbackSink,
} from "./langchain-callback-handler"
import {
    LLM_CALL_LOGGER_ERROR_CODE,
    LlmCallLoggerError,
} from "./llm-call-logger.error"

const DEFAULT_MAX_ATTEMPTS = 1
const DEFAULT_RETRY_BACKOFF_MS = 0
const DEFAULT_IDEMPOTENCY_TTL_MS = 300_000
const LLM_CALL_LOG_MESSAGE = "LLM call event"

/**
 * Supported structured LLM call log kinds.
 */
export const LLM_CALL_LOG_EVENT_KIND = {
    REQUEST: "REQUEST",
    RESPONSE: "RESPONSE",
    ERROR: "ERROR",
    TOKEN: "TOKEN",
} as const

/**
 * LLM call log event kind literal.
 */
export type LlmCallLogEventKind =
    (typeof LLM_CALL_LOG_EVENT_KIND)[keyof typeof LLM_CALL_LOG_EVENT_KIND]

/**
 * Input payload for one LLM call log event.
 */
export interface ILlmCallLogInput {
    /**
     * Log event kind.
     */
    readonly kind: LlmCallLogEventKind

    /**
     * Stable run identifier.
     */
    readonly runId: string

    /**
     * Human-readable event name.
     */
    readonly name: string

    /**
     * Structured payload.
     */
    readonly payload?: Readonly<Record<string, unknown>>

    /**
     * Optional idempotency key for non-token dedupe.
     */
    readonly idempotencyKey?: string
}

/**
 * Runtime options for LLM call logger.
 */
export interface ILlmCallLoggerOptions {
    /**
     * Structured logger implementation.
     */
    readonly logger: ILogger

    /**
     * Maximum attempts for write operations.
     */
    readonly maxAttempts?: number

    /**
     * Retry backoff in milliseconds.
     */
    readonly retryBackoffMs?: number

    /**
     * Idempotency TTL in milliseconds for non-token events.
     */
    readonly idempotencyTtlMs?: number

    /**
     * Optional sleep implementation for retry backoff.
     */
    readonly sleep?: (delayMs: number) => Promise<void>

    /**
     * Optional deterministic clock.
     */
    readonly now?: () => Date
}

/**
 * LLM call logger contract.
 */
export interface ILlmCallLogger extends ILangChainCallbackSink {
    /**
     * Logs one structured LLM call event.
     *
     * @param input Structured log input.
     */
    log(input: ILlmCallLogInput): Promise<void>

    /**
     * Handles one normalized LangChain callback event.
     *
     * @param event Callback event.
     */
    handle(event: ILangChainCallbackEvent): Promise<void>
}

interface INormalizedLogInput {
    readonly kind: LlmCallLogEventKind
    readonly runId: string
    readonly name: string
    readonly payload: Readonly<Record<string, unknown>>
    readonly idempotencyKey?: string
}

/**
 * Structured LLM call logger with retry and idempotency safeguards.
 */
export class LlmCallLogger implements ILlmCallLogger {
    private readonly logger: ILogger
    private readonly maxAttempts: number
    private readonly retryBackoffMs: number
    private readonly idempotencyTtlMs: number
    private readonly sleep: (delayMs: number) => Promise<void>
    private readonly now: () => Date
    private readonly inFlightByKey = new Map<string, Promise<void>>()
    private readonly processedExpiryByKey = new Map<string, number>()

    /**
     * Creates LLM call logger.
     *
     * @param options Logger options.
     */
    public constructor(options: ILlmCallLoggerOptions) {
        this.logger = validateLogger(options.logger)
        this.maxAttempts = validatePositiveInteger(
            options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
            LLM_CALL_LOGGER_ERROR_CODE.INVALID_MAX_ATTEMPTS,
        )
        this.retryBackoffMs = validateNonNegativeInteger(
            options.retryBackoffMs ?? DEFAULT_RETRY_BACKOFF_MS,
            LLM_CALL_LOGGER_ERROR_CODE.INVALID_RETRY_BACKOFF_MS,
        )
        this.idempotencyTtlMs = validatePositiveInteger(
            options.idempotencyTtlMs ?? DEFAULT_IDEMPOTENCY_TTL_MS,
            LLM_CALL_LOGGER_ERROR_CODE.INVALID_IDEMPOTENCY_TTL_MS,
        )
        this.sleep = options.sleep ?? sleepForMilliseconds
        this.now = options.now ?? (() => new Date())
    }

    /**
     * Logs one structured LLM call event.
     *
     * @param input Structured log input.
     */
    public async log(input: ILlmCallLogInput): Promise<void> {
        const normalized = normalizeLogInput(input)
        if (normalized.kind === LLM_CALL_LOG_EVENT_KIND.TOKEN) {
            await this.writeWithRetry(normalized)
            return
        }

        await this.logIdempotent(normalized)
    }

    /**
     * Handles one normalized LangChain callback event.
     *
     * @param event Callback event.
     */
    public async handle(event: ILangChainCallbackEvent): Promise<void> {
        const mapped = mapCallbackEventToLogInput(event)
        if (mapped === undefined) {
            return
        }

        await this.log(mapped)
    }

    /**
     * Logs non-token events with idempotency dedupe and in-flight coalescing.
     *
     * @param input Normalized log input.
     */
    private async logIdempotent(input: INormalizedLogInput): Promise<void> {
        const nowMs = this.now().getTime()
        this.evictExpiredIdempotencyKeys(nowMs)

        const idempotencyKey = input.idempotencyKey ?? createEventFingerprint(input)
        const dedupeKey = `${input.kind}|${input.runId}|${input.name}|${idempotencyKey}`
        if (this.processedExpiryByKey.has(dedupeKey)) {
            return
        }

        const inFlight = this.inFlightByKey.get(dedupeKey)
        if (inFlight !== undefined) {
            await inFlight
            return
        }

        const loggingPromise = this.writeWithRetry(input)
            .then((): void => {
                this.processedExpiryByKey.set(dedupeKey, nowMs + this.idempotencyTtlMs)
            })
            .finally((): void => {
                this.inFlightByKey.delete(dedupeKey)
            })
        this.inFlightByKey.set(dedupeKey, loggingPromise)
        await loggingPromise
    }

    /**
     * Writes one log event with bounded retry policy.
     *
     * @param input Normalized log input.
     */
    private async writeWithRetry(input: INormalizedLogInput): Promise<void> {
        for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
            try {
                await this.writeLog(input)
                return
            } catch (error) {
                if (attempt === this.maxAttempts) {
                    throw new LlmCallLoggerError(
                        LLM_CALL_LOGGER_ERROR_CODE.LOGGING_FAILED,
                        {
                            kind: input.kind,
                            runId: input.runId,
                            name: input.name,
                            attempt,
                            causeMessage: resolveCauseMessage(error),
                        },
                    )
                }

                if (this.retryBackoffMs > 0) {
                    await this.sleep(this.retryBackoffMs)
                }
            }
        }
    }

    /**
     * Writes one structured event to logger with level-based routing.
     *
     * @param input Normalized log input.
     */
    private async writeLog(input: INormalizedLogInput): Promise<void> {
        const context: Record<string, unknown> = {
            kind: input.kind,
            runId: input.runId,
            name: input.name,
            loggedAt: this.now().toISOString(),
            payload: input.payload,
        }

        if (input.kind === LLM_CALL_LOG_EVENT_KIND.ERROR) {
            await this.logger.error(LLM_CALL_LOG_MESSAGE, context)
            return
        }

        await this.logger.info(LLM_CALL_LOG_MESSAGE, context)
    }

    /**
     * Removes expired idempotency entries.
     *
     * @param nowMs Current timestamp.
     */
    private evictExpiredIdempotencyKeys(nowMs: number): void {
        for (const [key, expiresAtMs] of this.processedExpiryByKey.entries()) {
            if (expiresAtMs <= nowMs) {
                this.processedExpiryByKey.delete(key)
            }
        }
    }
}

/**
 * Validates logger contract.
 *
 * @param logger Logger candidate.
 * @returns Validated logger.
 */
function validateLogger(logger: ILogger): ILogger {
    if (isLogger(logger) === false) {
        throw new LlmCallLoggerError(LLM_CALL_LOGGER_ERROR_CODE.INVALID_LOGGER)
    }
    return logger
}

/**
 * Type guard for ILogger contract.
 *
 * @param logger Unknown logger candidate.
 * @returns True when value matches ILogger contract.
 */
function isLogger(logger: unknown): logger is ILogger {
    if (typeof logger !== "object" || logger === null) {
        return false
    }

    return hasFunction(logger, "info")
        && hasFunction(logger, "warn")
        && hasFunction(logger, "error")
        && hasFunction(logger, "debug")
        && hasFunction(logger, "child")
}

/**
 * Returns whether object contains function property by name.
 *
 * @param value Candidate object.
 * @param propertyName Property name.
 * @returns True when property exists and is function.
 */
function hasFunction(value: object, propertyName: string): boolean {
    if (propertyName in value === false) {
        return false
    }

    const candidate = (value as Record<string, unknown>)[propertyName]
    return typeof candidate === "function"
}

/**
 * Validates positive integer value.
 *
 * @param value Candidate value.
 * @param code Error code.
 * @returns Validated integer.
 */
function validatePositiveInteger(value: number, code: LlmCallLoggerError["code"]): number {
    if (Number.isInteger(value) === false || value <= 0) {
        throw new LlmCallLoggerError(code)
    }
    return value
}

/**
 * Validates non-negative integer value.
 *
 * @param value Candidate value.
 * @param code Error code.
 * @returns Validated integer.
 */
function validateNonNegativeInteger(value: number, code: LlmCallLoggerError["code"]): number {
    if (Number.isInteger(value) === false || value < 0) {
        throw new LlmCallLoggerError(code)
    }
    return value
}

/**
 * Normalizes one structured log input.
 *
 * @param input Raw structured log input.
 * @returns Normalized structured log input.
 */
function normalizeLogInput(input: ILlmCallLogInput): INormalizedLogInput {
    const kind = normalizeEventKind(input.kind)
    const runId = normalizeRunId(input.runId)
    const name = normalizeEventName(input.name)
    const idempotencyKey = normalizeOptionalIdempotencyKey(input.idempotencyKey)

    return {
        kind,
        runId,
        name,
        payload: input.payload ?? {},
        idempotencyKey,
    }
}

/**
 * Validates event kind.
 *
 * @param value Event kind candidate.
 * @returns Validated event kind.
 */
function normalizeEventKind(value: string): LlmCallLogEventKind {
    if (
        value !== LLM_CALL_LOG_EVENT_KIND.REQUEST
        && value !== LLM_CALL_LOG_EVENT_KIND.RESPONSE
        && value !== LLM_CALL_LOG_EVENT_KIND.ERROR
        && value !== LLM_CALL_LOG_EVENT_KIND.TOKEN
    ) {
        throw new LlmCallLoggerError(LLM_CALL_LOGGER_ERROR_CODE.INVALID_EVENT_KIND, {
            kind: value,
        })
    }

    return value
}

/**
 * Validates run identifier.
 *
 * @param value Run identifier candidate.
 * @returns Validated run identifier.
 */
function normalizeRunId(value: string): string {
    const normalized = value.trim()
    if (normalized.length === 0) {
        throw new LlmCallLoggerError(LLM_CALL_LOGGER_ERROR_CODE.INVALID_RUN_ID, {
            runId: value,
        })
    }
    return normalized
}

/**
 * Validates event name.
 *
 * @param value Event name candidate.
 * @returns Validated event name.
 */
function normalizeEventName(value: string): string {
    const normalized = value.trim()
    if (normalized.length === 0) {
        throw new LlmCallLoggerError(LLM_CALL_LOGGER_ERROR_CODE.INVALID_EVENT_NAME, {
            name: value,
        })
    }
    return normalized
}

/**
 * Normalizes optional idempotency key.
 *
 * @param value Optional idempotency key.
 * @returns Normalized key or undefined.
 */
function normalizeOptionalIdempotencyKey(value?: string): string | undefined {
    if (value === undefined) {
        return undefined
    }

    const normalized = value.trim()
    if (normalized.length === 0) {
        return undefined
    }

    return normalized
}

/**
 * Maps callback event into structured log input or returns undefined.
 *
 * @param event Callback event.
 * @returns Structured log input or undefined.
 */
function mapCallbackEventToLogInput(event: ILangChainCallbackEvent): ILlmCallLogInput | undefined {
    if (event.type === LANGCHAIN_CALLBACK_EVENT_TYPE.LLM_START) {
        return {
            kind: LLM_CALL_LOG_EVENT_KIND.REQUEST,
            runId: event.runId,
            name: event.name,
            payload: event.payload,
        }
    }

    if (event.type === LANGCHAIN_CALLBACK_EVENT_TYPE.LLM_END) {
        return {
            kind: LLM_CALL_LOG_EVENT_KIND.RESPONSE,
            runId: event.runId,
            name: event.name,
            payload: event.payload,
        }
    }

    if (event.type === LANGCHAIN_CALLBACK_EVENT_TYPE.LLM_ERROR) {
        return {
            kind: LLM_CALL_LOG_EVENT_KIND.ERROR,
            runId: event.runId,
            name: event.name,
            payload: event.payload,
        }
    }

    if (event.type === LANGCHAIN_CALLBACK_EVENT_TYPE.LLM_TOKEN) {
        return {
            kind: LLM_CALL_LOG_EVENT_KIND.TOKEN,
            runId: event.runId,
            name: event.name,
            payload: event.payload,
        }
    }

    return undefined
}

/**
 * Creates deterministic fingerprint for non-token log events.
 *
 * @param input Normalized log input.
 * @returns Deterministic fingerprint.
 */
function createEventFingerprint(input: INormalizedLogInput): string {
    return safeStringify(input.payload)
}

/**
 * Safely stringifies payload for dedupe fingerprinting.
 *
 * @param payload Payload value.
 * @returns String fingerprint.
 */
function safeStringify(payload: Readonly<Record<string, unknown>>): string {
    try {
        return JSON.stringify(payload)
    } catch {
        return "<unserializable-payload>"
    }
}

/**
 * Sleeps for provided milliseconds.
 *
 * @param delayMs Delay milliseconds.
 * @returns Promise resolved after delay.
 */
function sleepForMilliseconds(delayMs: number): Promise<void> {
    if (delayMs === 0) {
        return Promise.resolve()
    }
    return new Promise((resolve): void => {
        setTimeout(resolve, delayMs)
    })
}

/**
 * Resolves safe cause message from unknown error.
 *
 * @param error Unknown error payload.
 * @returns Cause message or undefined.
 */
function resolveCauseMessage(error: unknown): string | undefined {
    if (error instanceof Error) {
        return error.message
    }
    if (typeof error === "string") {
        return error
    }
    return undefined
}
