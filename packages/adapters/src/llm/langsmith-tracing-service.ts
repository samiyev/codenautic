import {
    LANGCHAIN_CALLBACK_EVENT_TYPE,
    type ILangChainCallbackEvent,
    type ILangChainCallbackSink,
    type LangChainCallbackEventType,
} from "./langchain-callback-handler"
import type {
    ILangSmithTraceCompleteInput,
    ILangSmithTraceStartInput,
} from "./langsmith-tracer"
import {
    LANGSMITH_TRACING_SERVICE_ERROR_CODE,
    LangSmithTracingServiceError,
} from "./langsmith-tracing-service.error"

const DEFAULT_MAX_ATTEMPTS = 1
const DEFAULT_RETRY_BACKOFF_MS = 0
const DEFAULT_IDEMPOTENCY_TTL_MS = 300_000

/**
 * LangSmith tracing client contract used by service.
 */
export interface ILangSmithTracingClient {
    /**
     * Starts one trace run.
     *
     * @param input Start-run input.
     * @returns Started run identifier.
     */
    startRun(input: ILangSmithTraceStartInput): Promise<string>

    /**
     * Completes one trace run.
     *
     * @param runId Run identifier.
     * @param input Complete-run input.
     */
    completeRun(runId: string, input: ILangSmithTraceCompleteInput): Promise<void>

    /**
     * Marks one trace run as failed.
     *
     * @param runId Run identifier.
     * @param error Error payload.
     * @param metadata Optional metadata payload.
     */
    failRun(
        runId: string,
        error: unknown,
        metadata?: Readonly<Record<string, unknown>>,
    ): Promise<void>
}

/**
 * Runtime options for LangSmith tracing service.
 */
export interface ILangSmithTracingServiceOptions {
    /**
     * Tracing client.
     */
    readonly tracer: ILangSmithTracingClient

    /**
     * Maximum attempts for start/complete/fail operations.
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
     * Optional default metadata merged into every trace event.
     */
    readonly defaultMetadata?: Readonly<Record<string, unknown>>

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
 * LangSmith tracing integration service contract.
 */
export interface ILangSmithTracingService extends ILangChainCallbackSink {
    /**
     * Handles normalized callback event.
     *
     * @param event Callback event.
     */
    handle(event: ILangChainCallbackEvent): Promise<void>
}

interface INormalizedTraceEvent {
    readonly type: LangChainCallbackEventType
    readonly runId: string
    readonly parentRunId?: string
    readonly name: string
    readonly payload: Readonly<Record<string, unknown>>
}

/**
 * Bridges LangChain callback events into LangSmith trace lifecycle.
 */
export class LangSmithTracingService implements ILangSmithTracingService {
    private readonly tracer: ILangSmithTracingClient
    private readonly maxAttempts: number
    private readonly retryBackoffMs: number
    private readonly idempotencyTtlMs: number
    private readonly defaultMetadata: Readonly<Record<string, unknown>>
    private readonly sleep: (delayMs: number) => Promise<void>
    private readonly now: () => Date
    private readonly activeRunByCallbackRunId = new Map<string, string>()
    private readonly tokenBufferByCallbackRunId = new Map<string, string[]>()
    private readonly inFlightEventByKey = new Map<string, Promise<void>>()
    private readonly processedEventExpiryByKey = new Map<string, number>()

    /**
     * Creates LangSmith tracing service.
     *
     * @param options Service options.
     */
    public constructor(options: ILangSmithTracingServiceOptions) {
        this.tracer = validateTracer(options.tracer)
        this.maxAttempts = validatePositiveInteger(
            options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
            LANGSMITH_TRACING_SERVICE_ERROR_CODE.INVALID_MAX_ATTEMPTS,
        )
        this.retryBackoffMs = validateNonNegativeInteger(
            options.retryBackoffMs ?? DEFAULT_RETRY_BACKOFF_MS,
            LANGSMITH_TRACING_SERVICE_ERROR_CODE.INVALID_RETRY_BACKOFF_MS,
        )
        this.idempotencyTtlMs = validatePositiveInteger(
            options.idempotencyTtlMs ?? DEFAULT_IDEMPOTENCY_TTL_MS,
            LANGSMITH_TRACING_SERVICE_ERROR_CODE.INVALID_IDEMPOTENCY_TTL_MS,
        )
        this.defaultMetadata = options.defaultMetadata ?? {}
        this.sleep = options.sleep ?? sleepForMilliseconds
        this.now = options.now ?? (() => new Date())
    }

    /**
     * Handles normalized callback event.
     *
     * @param event Callback event.
     */
    public async handle(event: ILangChainCallbackEvent): Promise<void> {
        const normalized = normalizeTraceEvent(event)
        if (normalized.type === LANGCHAIN_CALLBACK_EVENT_TYPE.LLM_TOKEN) {
            this.handleTokenEvent(normalized)
            return
        }

        await this.handleIdempotentEvent(normalized)
    }

    /**
     * Handles non-token event with idempotency dedupe and in-flight coalescing.
     *
     * @param event Normalized trace event.
     */
    private async handleIdempotentEvent(event: INormalizedTraceEvent): Promise<void> {
        const nowMs = this.now().getTime()
        this.evictExpiredEventKeys(nowMs)

        const dedupeKey = createTraceEventDedupeKey(event)
        if (this.processedEventExpiryByKey.has(dedupeKey)) {
            return
        }

        const inFlight = this.inFlightEventByKey.get(dedupeKey)
        if (inFlight !== undefined) {
            await inFlight
            return
        }

        const handlingPromise = this.handleEventWithRetry(event)
            .then((): void => {
                this.processedEventExpiryByKey.set(dedupeKey, nowMs + this.idempotencyTtlMs)
            })
            .finally((): void => {
                this.inFlightEventByKey.delete(dedupeKey)
            })
        this.inFlightEventByKey.set(dedupeKey, handlingPromise)
        await handlingPromise
    }

    /**
     * Handles trace event with bounded retry.
     *
     * @param event Normalized trace event.
     */
    private async handleEventWithRetry(event: INormalizedTraceEvent): Promise<void> {
        for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
            try {
                await this.handleEventOnce(event)
                return
            } catch (error) {
                if (attempt === this.maxAttempts) {
                    throw new LangSmithTracingServiceError(
                        LANGSMITH_TRACING_SERVICE_ERROR_CODE.EVENT_HANDLING_FAILED,
                        {
                            eventType: event.type,
                            runId: event.runId,
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
     * Handles one normalized non-token event.
     *
     * @param event Normalized trace event.
     */
    private async handleEventOnce(event: INormalizedTraceEvent): Promise<void> {
        if (isStartEvent(event.type)) {
            await this.handleStartEvent(event)
            return
        }
        if (isEndEvent(event.type)) {
            await this.handleEndEvent(event)
            return
        }
        if (isErrorEvent(event.type)) {
            await this.handleErrorEvent(event)
            return
        }

        throw new LangSmithTracingServiceError(
            LANGSMITH_TRACING_SERVICE_ERROR_CODE.INVALID_EVENT_TYPE,
            {
                eventType: event.type,
            },
        )
    }

    /**
     * Starts LangSmith run for callback run when needed.
     *
     * @param event Start callback event.
     */
    private async handleStartEvent(event: INormalizedTraceEvent): Promise<void> {
        if (this.activeRunByCallbackRunId.has(event.runId)) {
            return
        }

        const langSmithRunId = await this.tracer.startRun(
            buildStartInput(event, this.defaultMetadata),
        )
        this.activeRunByCallbackRunId.set(event.runId, langSmithRunId)
    }

    /**
     * Completes LangSmith run for callback run.
     *
     * @param event End callback event.
     */
    private async handleEndEvent(event: INormalizedTraceEvent): Promise<void> {
        const langSmithRunId = await this.ensureRun(event)
        await this.tracer.completeRun(langSmithRunId, {
            outputs: this.buildEndOutputs(event),
            metadata: buildMetadata(event, this.defaultMetadata),
        })
        this.cleanupRun(event.runId)
    }

    /**
     * Fails LangSmith run for callback run.
     *
     * @param event Error callback event.
     */
    private async handleErrorEvent(event: INormalizedTraceEvent): Promise<void> {
        const langSmithRunId = await this.ensureRun(event)
        await this.tracer.failRun(
            langSmithRunId,
            resolveErrorMessageFromPayload(event.payload),
            buildMetadata(event, this.defaultMetadata),
        )
        this.cleanupRun(event.runId)
    }

    /**
     * Ensures LangSmith run exists for callback run id.
     *
     * @param event Callback event.
     * @returns LangSmith run identifier.
     */
    private async ensureRun(event: INormalizedTraceEvent): Promise<string> {
        const existing = this.activeRunByCallbackRunId.get(event.runId)
        if (existing !== undefined) {
            return existing
        }

        const langSmithRunId = await this.tracer.startRun(
            buildStartInput(event, this.defaultMetadata),
        )
        this.activeRunByCallbackRunId.set(event.runId, langSmithRunId)
        return langSmithRunId
    }

    /**
     * Appends streaming token for callback run buffer.
     *
     * @param event Token callback event.
     */
    private handleTokenEvent(event: INormalizedTraceEvent): void {
        const token = event.payload["token"]
        if (typeof token !== "string" || token.length === 0) {
            return
        }

        const existing = this.tokenBufferByCallbackRunId.get(event.runId)
        if (existing === undefined) {
            this.tokenBufferByCallbackRunId.set(event.runId, [token])
            return
        }
        existing.push(token)
    }

    /**
     * Builds end outputs payload with optional buffered streamed text.
     *
     * @param event End callback event.
     * @returns Outputs payload.
     */
    private buildEndOutputs(event: INormalizedTraceEvent): Readonly<Record<string, unknown>> {
        const outputs: Record<string, unknown> = {
            eventType: event.type,
            payload: event.payload,
        }

        const tokens = this.tokenBufferByCallbackRunId.get(event.runId)
        if (tokens !== undefined && tokens.length > 0) {
            outputs["streamedText"] = tokens.join("")
        }

        return outputs
    }

    /**
     * Removes callback run state after terminal event.
     *
     * @param callbackRunId Callback run identifier.
     */
    private cleanupRun(callbackRunId: string): void {
        this.activeRunByCallbackRunId.delete(callbackRunId)
        this.tokenBufferByCallbackRunId.delete(callbackRunId)
    }

    /**
     * Removes expired idempotency entries.
     *
     * @param nowMs Current timestamp.
     */
    private evictExpiredEventKeys(nowMs: number): void {
        for (const [dedupeKey, expiresAtMs] of this.processedEventExpiryByKey.entries()) {
            if (expiresAtMs <= nowMs) {
                this.processedEventExpiryByKey.delete(dedupeKey)
            }
        }
    }
}

/**
 * Validates tracing client contract.
 *
 * @param tracer Tracing client candidate.
 * @returns Validated tracing client.
 */
function validateTracer(tracer: ILangSmithTracingClient): ILangSmithTracingClient {
    if (
        typeof tracer.startRun !== "function"
        || typeof tracer.completeRun !== "function"
        || typeof tracer.failRun !== "function"
    ) {
        throw new LangSmithTracingServiceError(
            LANGSMITH_TRACING_SERVICE_ERROR_CODE.INVALID_TRACER,
        )
    }

    return tracer
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
    code: LangSmithTracingServiceError["code"],
): number {
    if (Number.isInteger(value) === false || value <= 0) {
        throw new LangSmithTracingServiceError(code)
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
    code: LangSmithTracingServiceError["code"],
): number {
    if (Number.isInteger(value) === false || value < 0) {
        throw new LangSmithTracingServiceError(code)
    }
    return value
}

/**
 * Normalizes callback event for tracing.
 *
 * @param event Raw callback event.
 * @returns Normalized callback event.
 */
function normalizeTraceEvent(event: ILangChainCallbackEvent): INormalizedTraceEvent {
    const runId = event.runId.trim()
    if (runId.length === 0) {
        throw new LangSmithTracingServiceError(
            LANGSMITH_TRACING_SERVICE_ERROR_CODE.INVALID_RUN_ID,
            {
                runId: event.runId,
            },
        )
    }

    return {
        type: event.type,
        runId,
        parentRunId: event.parentRunId,
        name: event.name,
        payload: event.payload,
    }
}

/**
 * Returns whether callback event type is start lifecycle type.
 *
 * @param eventType Callback event type.
 * @returns True when start event.
 */
function isStartEvent(eventType: LangChainCallbackEventType): boolean {
    return eventType === LANGCHAIN_CALLBACK_EVENT_TYPE.CHAIN_START
        || eventType === LANGCHAIN_CALLBACK_EVENT_TYPE.LLM_START
}

/**
 * Returns whether callback event type is end lifecycle type.
 *
 * @param eventType Callback event type.
 * @returns True when end event.
 */
function isEndEvent(eventType: LangChainCallbackEventType): boolean {
    return eventType === LANGCHAIN_CALLBACK_EVENT_TYPE.CHAIN_END
        || eventType === LANGCHAIN_CALLBACK_EVENT_TYPE.LLM_END
}

/**
 * Returns whether callback event type is error lifecycle type.
 *
 * @param eventType Callback event type.
 * @returns True when error event.
 */
function isErrorEvent(eventType: LangChainCallbackEventType): boolean {
    return eventType === LANGCHAIN_CALLBACK_EVENT_TYPE.CHAIN_ERROR
        || eventType === LANGCHAIN_CALLBACK_EVENT_TYPE.LLM_ERROR
}

/**
 * Builds start-run payload from callback event.
 *
 * @param event Callback event.
 * @param defaultMetadata Default metadata map.
 * @returns Start-run payload.
 */
function buildStartInput(
    event: INormalizedTraceEvent,
    defaultMetadata: Readonly<Record<string, unknown>>,
): ILangSmithTraceStartInput {
    return {
        runName: event.name,
        inputs: {
            callbackRunId: event.runId,
            callbackEventType: event.type,
            callbackPayload: event.payload,
            callbackParentRunId: event.parentRunId,
        },
        metadata: buildMetadata(event, defaultMetadata),
    }
}

/**
 * Builds merged metadata payload for callback event.
 *
 * @param event Callback event.
 * @param defaultMetadata Default metadata map.
 * @returns Merged metadata map.
 */
function buildMetadata(
    event: INormalizedTraceEvent,
    defaultMetadata: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
    return {
        ...defaultMetadata,
        callbackRunId: event.runId,
        callbackEventType: event.type,
        callbackName: event.name,
        callbackParentRunId: event.parentRunId,
    }
}

/**
 * Resolves error string from callback payload.
 *
 * @param payload Callback payload.
 * @returns Error string.
 */
function resolveErrorMessageFromPayload(payload: Readonly<Record<string, unknown>>): string {
    const payloadError = payload["error"]
    if (typeof payloadError === "string" && payloadError.length > 0) {
        return payloadError
    }

    return "Unknown callback error"
}

/**
 * Creates deterministic dedupe key for callback event.
 *
 * @param event Callback event.
 * @returns Dedupe key.
 */
function createTraceEventDedupeKey(event: INormalizedTraceEvent): string {
    return [
        event.type,
        event.runId,
        event.name,
        safeStringify(event.payload),
    ].join("|")
}

/**
 * Safely stringifies callback payload.
 *
 * @param payload Callback payload.
 * @returns JSON representation or fallback marker.
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
