import {
    LANGCHAIN_CALLBACK_HANDLER_ERROR_CODE,
    LangChainCallbackHandlerError,
} from "./langchain-callback-handler.error"

const DEFAULT_MAX_ATTEMPTS = 1
const DEFAULT_RETRY_BACKOFF_MS = 0
const DEFAULT_IDEMPOTENCY_TTL_MS = 300_000

/**
 * Supported LangChain callback event types.
 */
export const LANGCHAIN_CALLBACK_EVENT_TYPE = {
    CHAIN_START: "CHAIN_START",
    CHAIN_END: "CHAIN_END",
    CHAIN_ERROR: "CHAIN_ERROR",
    LLM_START: "LLM_START",
    LLM_END: "LLM_END",
    LLM_ERROR: "LLM_ERROR",
    LLM_TOKEN: "LLM_TOKEN",
} as const

/**
 * LangChain callback event type literal.
 */
export type LangChainCallbackEventType =
    (typeof LANGCHAIN_CALLBACK_EVENT_TYPE)[keyof typeof LANGCHAIN_CALLBACK_EVENT_TYPE]

/**
 * Normalized callback event payload dispatched to sinks.
 */
export interface ILangChainCallbackEvent {
    /**
     * Event type.
     */
    readonly type: LangChainCallbackEventType

    /**
     * Stable run identifier.
     */
    readonly runId: string

    /**
     * Optional parent run identifier.
     */
    readonly parentRunId?: string

    /**
     * Human-readable callback event name.
     */
    readonly name: string

    /**
     * Event timestamp.
     */
    readonly timestamp: string

    /**
     * Arbitrary event payload.
     */
    readonly payload: Readonly<Record<string, unknown>>
}

/**
 * Raw dispatch input accepted by callback handler.
 */
export interface ILangChainCallbackDispatchInput {
    /**
     * Event type.
     */
    readonly type: LangChainCallbackEventType

    /**
     * Stable run identifier.
     */
    readonly runId: string

    /**
     * Human-readable callback event name.
     */
    readonly name: string

    /**
     * Optional parent run identifier.
     */
    readonly parentRunId?: string

    /**
     * Arbitrary event payload.
     */
    readonly payload?: Readonly<Record<string, unknown>>

    /**
     * Optional idempotency key for dedupe and cache.
     */
    readonly idempotencyKey?: string
}

/**
 * Generic callback input shape.
 */
export interface ILangChainCallbackRunInput {
    /**
     * Stable run identifier.
     */
    readonly runId: string

    /**
     * Human-readable callback event name.
     */
    readonly name: string

    /**
     * Optional parent run identifier.
     */
    readonly parentRunId?: string

    /**
     * Optional callback payload.
     */
    readonly payload?: Readonly<Record<string, unknown>>

    /**
     * Optional idempotency key for dedupe and cache.
     */
    readonly idempotencyKey?: string
}

/**
 * Callback input shape for error events.
 */
export interface ILangChainCallbackErrorInput extends ILangChainCallbackRunInput {
    /**
     * Source error payload.
     */
    readonly error: unknown
}

/**
 * Callback input for token events.
 */
export interface ILangChainCallbackTokenInput extends ILangChainCallbackRunInput {
    /**
     * Streamed token value.
     */
    readonly token: string
}

/**
 * Sink contract that receives normalized callback events.
 */
export interface ILangChainCallbackSink {
    /**
     * Handles one normalized callback event.
     *
     * @param event Normalized event.
     */
    handle(event: ILangChainCallbackEvent): Promise<void> | void
}

/**
 * Runtime options for callback handler.
 */
export interface ILangChainCallbackHandlerOptions {
    /**
     * Callback sinks.
     */
    readonly sinks: readonly ILangChainCallbackSink[]

    /**
     * Maximum number of dispatch attempts.
     */
    readonly maxAttempts?: number

    /**
     * Retry backoff in milliseconds.
     */
    readonly retryBackoffMs?: number

    /**
     * Idempotency cache TTL in milliseconds.
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
 * Callback handler contract.
 */
export interface ILangChainCallbackHandler {
    /**
     * Dispatches one callback event.
     *
     * @param input Dispatch input.
     */
    dispatch(input: ILangChainCallbackDispatchInput): Promise<void>

    /**
     * Dispatches CHAIN_START event.
     *
     * @param input Callback input.
     */
    handleChainStart(input: ILangChainCallbackRunInput): Promise<void>

    /**
     * Dispatches CHAIN_END event.
     *
     * @param input Callback input.
     */
    handleChainEnd(input: ILangChainCallbackRunInput): Promise<void>

    /**
     * Dispatches CHAIN_ERROR event.
     *
     * @param input Callback input.
     */
    handleChainError(input: ILangChainCallbackErrorInput): Promise<void>

    /**
     * Dispatches LLM_START event.
     *
     * @param input Callback input.
     */
    handleLlmStart(input: ILangChainCallbackRunInput): Promise<void>

    /**
     * Dispatches LLM_END event.
     *
     * @param input Callback input.
     */
    handleLlmEnd(input: ILangChainCallbackRunInput): Promise<void>

    /**
     * Dispatches LLM_ERROR event.
     *
     * @param input Callback input.
     */
    handleLlmError(input: ILangChainCallbackErrorInput): Promise<void>

    /**
     * Dispatches LLM_TOKEN event.
     *
     * @param input Callback input.
     */
    handleLlmToken(input: ILangChainCallbackTokenInput): Promise<void>
}

interface IResolvedDispatchInput {
    readonly event: ILangChainCallbackEvent
    readonly idempotencyKey?: string
}

/**
 * LangChain callback integration helper with retry and idempotent dispatch.
 */
export class LangChainCallbackHandler implements ILangChainCallbackHandler {
    private readonly sinks: readonly ILangChainCallbackSink[]
    private readonly maxAttempts: number
    private readonly retryBackoffMs: number
    private readonly idempotencyTtlMs: number
    private readonly sleep: (delayMs: number) => Promise<void>
    private readonly now: () => Date
    private readonly inFlightDispatchByKey = new Map<string, Promise<void>>()
    private readonly processedDispatchExpiryByKey = new Map<string, number>()

    /**
     * Creates callback handler.
     *
     * @param options Handler options.
     */
    public constructor(options: ILangChainCallbackHandlerOptions) {
        this.sinks = validateSinks(options.sinks)
        this.maxAttempts = validatePositiveInteger(
            options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
            LANGCHAIN_CALLBACK_HANDLER_ERROR_CODE.INVALID_MAX_ATTEMPTS,
        )
        this.retryBackoffMs = validateNonNegativeInteger(
            options.retryBackoffMs ?? DEFAULT_RETRY_BACKOFF_MS,
            LANGCHAIN_CALLBACK_HANDLER_ERROR_CODE.INVALID_RETRY_BACKOFF_MS,
        )
        this.idempotencyTtlMs = validatePositiveInteger(
            options.idempotencyTtlMs ?? DEFAULT_IDEMPOTENCY_TTL_MS,
            LANGCHAIN_CALLBACK_HANDLER_ERROR_CODE.INVALID_IDEMPOTENCY_TTL_MS,
        )
        this.sleep = options.sleep ?? sleepForMilliseconds
        this.now = options.now ?? (() => new Date())
    }

    /**
     * Dispatches one callback event.
     *
     * @param input Dispatch input.
     */
    public async dispatch(input: ILangChainCallbackDispatchInput): Promise<void> {
        const normalized = normalizeDispatchInput(input, this.now)
        if (normalized.idempotencyKey === undefined) {
            await this.dispatchWithRetry(normalized.event)
            return
        }

        await this.dispatchIdempotent(normalized)
    }

    /**
     * Dispatches CHAIN_START event.
     *
     * @param input Callback input.
     */
    public async handleChainStart(input: ILangChainCallbackRunInput): Promise<void> {
        await this.dispatch({
            type: LANGCHAIN_CALLBACK_EVENT_TYPE.CHAIN_START,
            runId: input.runId,
            parentRunId: input.parentRunId,
            name: input.name,
            payload: input.payload,
            idempotencyKey: input.idempotencyKey,
        })
    }

    /**
     * Dispatches CHAIN_END event.
     *
     * @param input Callback input.
     */
    public async handleChainEnd(input: ILangChainCallbackRunInput): Promise<void> {
        await this.dispatch({
            type: LANGCHAIN_CALLBACK_EVENT_TYPE.CHAIN_END,
            runId: input.runId,
            parentRunId: input.parentRunId,
            name: input.name,
            payload: input.payload,
            idempotencyKey: input.idempotencyKey,
        })
    }

    /**
     * Dispatches CHAIN_ERROR event.
     *
     * @param input Callback input.
     */
    public async handleChainError(input: ILangChainCallbackErrorInput): Promise<void> {
        await this.dispatch({
            type: LANGCHAIN_CALLBACK_EVENT_TYPE.CHAIN_ERROR,
            runId: input.runId,
            parentRunId: input.parentRunId,
            name: input.name,
            payload: mergeErrorPayload(input.payload, input.error),
            idempotencyKey: input.idempotencyKey,
        })
    }

    /**
     * Dispatches LLM_START event.
     *
     * @param input Callback input.
     */
    public async handleLlmStart(input: ILangChainCallbackRunInput): Promise<void> {
        await this.dispatch({
            type: LANGCHAIN_CALLBACK_EVENT_TYPE.LLM_START,
            runId: input.runId,
            parentRunId: input.parentRunId,
            name: input.name,
            payload: input.payload,
            idempotencyKey: input.idempotencyKey,
        })
    }

    /**
     * Dispatches LLM_END event.
     *
     * @param input Callback input.
     */
    public async handleLlmEnd(input: ILangChainCallbackRunInput): Promise<void> {
        await this.dispatch({
            type: LANGCHAIN_CALLBACK_EVENT_TYPE.LLM_END,
            runId: input.runId,
            parentRunId: input.parentRunId,
            name: input.name,
            payload: input.payload,
            idempotencyKey: input.idempotencyKey,
        })
    }

    /**
     * Dispatches LLM_ERROR event.
     *
     * @param input Callback input.
     */
    public async handleLlmError(input: ILangChainCallbackErrorInput): Promise<void> {
        await this.dispatch({
            type: LANGCHAIN_CALLBACK_EVENT_TYPE.LLM_ERROR,
            runId: input.runId,
            parentRunId: input.parentRunId,
            name: input.name,
            payload: mergeErrorPayload(input.payload, input.error),
            idempotencyKey: input.idempotencyKey,
        })
    }

    /**
     * Dispatches LLM_TOKEN event.
     *
     * @param input Callback input.
     */
    public async handleLlmToken(input: ILangChainCallbackTokenInput): Promise<void> {
        await this.dispatch({
            type: LANGCHAIN_CALLBACK_EVENT_TYPE.LLM_TOKEN,
            runId: input.runId,
            parentRunId: input.parentRunId,
            name: input.name,
            payload: {
                ...(input.payload ?? {}),
                token: input.token,
            },
            idempotencyKey: input.idempotencyKey,
        })
    }

    /**
     * Dispatches idempotent event with in-flight dedupe and TTL cache.
     *
     * @param input Normalized dispatch input.
     */
    private async dispatchIdempotent(input: IResolvedDispatchInput): Promise<void> {
        const nowMs = this.now().getTime()
        this.evictExpiredIdempotencyKeys(nowMs)

        const idempotencyKey = input.idempotencyKey
        if (idempotencyKey === undefined) {
            await this.dispatchWithRetry(input.event)
            return
        }

        const dedupeKey = createDedupeKey(input.event, idempotencyKey)
        if (this.processedDispatchExpiryByKey.has(dedupeKey)) {
            return
        }

        const inFlight = this.inFlightDispatchByKey.get(dedupeKey)
        if (inFlight !== undefined) {
            await inFlight
            return
        }

        const dispatchPromise = this.dispatchWithRetry(input.event)
            .then((): void => {
                this.processedDispatchExpiryByKey.set(
                    dedupeKey,
                    nowMs + this.idempotencyTtlMs,
                )
            })
            .finally((): void => {
                this.inFlightDispatchByKey.delete(dedupeKey)
            })

        this.inFlightDispatchByKey.set(dedupeKey, dispatchPromise)
        await dispatchPromise
    }

    /**
     * Dispatches event with bounded retry policy.
     *
     * @param event Normalized callback event.
     */
    private async dispatchWithRetry(event: ILangChainCallbackEvent): Promise<void> {
        for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
            try {
                await this.dispatchToSinks(event)
                return
            } catch (error) {
                if (attempt === this.maxAttempts) {
                    throw new LangChainCallbackHandlerError(
                        LANGCHAIN_CALLBACK_HANDLER_ERROR_CODE.DISPATCH_FAILED,
                        {
                            eventType: event.type,
                            runId: event.runId,
                            name: event.name,
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
     * Dispatches normalized event to every configured sink.
     *
     * @param event Normalized callback event.
     */
    private async dispatchToSinks(event: ILangChainCallbackEvent): Promise<void> {
        for (const sink of this.sinks) {
            await sink.handle(event)
        }
    }

    /**
     * Removes expired idempotency entries.
     *
     * @param nowMs Current timestamp.
     */
    private evictExpiredIdempotencyKeys(nowMs: number): void {
        for (const [dedupeKey, expiresAtMs] of this.processedDispatchExpiryByKey.entries()) {
            if (expiresAtMs <= nowMs) {
                this.processedDispatchExpiryByKey.delete(dedupeKey)
            }
        }
    }
}

/**
 * Validates callback sinks list.
 *
 * @param sinks Sink list.
 * @returns Validated sink list.
 */
function validateSinks(sinks: readonly ILangChainCallbackSink[]): readonly ILangChainCallbackSink[] {
    if (sinks.length === 0) {
        throw new LangChainCallbackHandlerError(
            LANGCHAIN_CALLBACK_HANDLER_ERROR_CODE.INVALID_SINKS,
        )
    }

    for (const sink of sinks) {
        if (typeof sink.handle !== "function") {
            throw new LangChainCallbackHandlerError(
                LANGCHAIN_CALLBACK_HANDLER_ERROR_CODE.INVALID_SINKS,
            )
        }
    }

    return sinks
}

/**
 * Validates positive integer value.
 *
 * @param value Candidate value.
 * @param code Error code.
 * @returns Validated integer.
 */
function validatePositiveInteger(
    value: number,
    code: LangChainCallbackHandlerError["code"],
): number {
    if (Number.isInteger(value) === false || value <= 0) {
        throw new LangChainCallbackHandlerError(code)
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
function validateNonNegativeInteger(
    value: number,
    code: LangChainCallbackHandlerError["code"],
): number {
    if (Number.isInteger(value) === false || value < 0) {
        throw new LangChainCallbackHandlerError(code)
    }
    return value
}

/**
 * Normalizes dispatch input into normalized callback event payload.
 *
 * @param input Raw dispatch input.
 * @param now Clock function.
 * @returns Normalized dispatch payload.
 */
function normalizeDispatchInput(
    input: ILangChainCallbackDispatchInput,
    now: () => Date,
): IResolvedDispatchInput {
    const eventType = normalizeEventType(input.type)
    const runId = normalizeRunId(input.runId)
    const eventName = normalizeEventName(input.name)
    const parentRunId = normalizeOptionalParentRunId(input.parentRunId)
    const idempotencyKey = normalizeOptionalIdempotencyKey(input.idempotencyKey)

    return {
        event: {
            type: eventType,
            runId,
            parentRunId,
            name: eventName,
            timestamp: now().toISOString(),
            payload: input.payload ?? {},
        },
        idempotencyKey,
    }
}

/**
 * Validates callback event type.
 *
 * @param value Event type candidate.
 * @returns Validated event type.
 */
function normalizeEventType(value: string): LangChainCallbackEventType {
    if (
        value !== LANGCHAIN_CALLBACK_EVENT_TYPE.CHAIN_START
        && value !== LANGCHAIN_CALLBACK_EVENT_TYPE.CHAIN_END
        && value !== LANGCHAIN_CALLBACK_EVENT_TYPE.CHAIN_ERROR
        && value !== LANGCHAIN_CALLBACK_EVENT_TYPE.LLM_START
        && value !== LANGCHAIN_CALLBACK_EVENT_TYPE.LLM_END
        && value !== LANGCHAIN_CALLBACK_EVENT_TYPE.LLM_ERROR
        && value !== LANGCHAIN_CALLBACK_EVENT_TYPE.LLM_TOKEN
    ) {
        throw new LangChainCallbackHandlerError(
            LANGCHAIN_CALLBACK_HANDLER_ERROR_CODE.INVALID_EVENT_TYPE,
            {
                eventType: value,
            },
        )
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
        throw new LangChainCallbackHandlerError(
            LANGCHAIN_CALLBACK_HANDLER_ERROR_CODE.INVALID_RUN_ID,
            {
                runId: value,
            },
        )
    }
    return normalized
}

/**
 * Validates callback event name.
 *
 * @param value Event name candidate.
 * @returns Validated event name.
 */
function normalizeEventName(value: string): string {
    const normalized = value.trim()
    if (normalized.length === 0) {
        throw new LangChainCallbackHandlerError(
            LANGCHAIN_CALLBACK_HANDLER_ERROR_CODE.INVALID_EVENT_NAME,
            {
                name: value,
            },
        )
    }
    return normalized
}

/**
 * Normalizes optional parent run identifier.
 *
 * @param value Optional parent run identifier.
 * @returns Normalized parent identifier or undefined.
 */
function normalizeOptionalParentRunId(value?: string): string | undefined {
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
        throw new LangChainCallbackHandlerError(
            LANGCHAIN_CALLBACK_HANDLER_ERROR_CODE.INVALID_IDEMPOTENCY_KEY,
            {
                idempotencyKey: value,
            },
        )
    }

    return normalized
}

/**
 * Creates deterministic dedupe key for idempotent dispatching.
 *
 * @param event Normalized event.
 * @param idempotencyKey Normalized idempotency key.
 * @returns Dedupe key.
 */
function createDedupeKey(event: ILangChainCallbackEvent, idempotencyKey: string): string {
    return `${event.type}|${event.runId}|${event.name}|${idempotencyKey}`
}

/**
 * Merges optional payload with normalized error message.
 *
 * @param payload Optional source payload.
 * @param error Unknown error payload.
 * @returns Merged payload.
 */
function mergeErrorPayload(
    payload: Readonly<Record<string, unknown>> | undefined,
    error: unknown,
): Readonly<Record<string, unknown>> {
    return {
        ...(payload ?? {}),
        error: resolveCauseMessage(error) ?? "Unknown callback error",
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
