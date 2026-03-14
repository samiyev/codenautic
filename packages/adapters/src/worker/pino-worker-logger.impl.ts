import type {ILogger} from "@codenautic/core"

import pino, {type LevelWithSilent, type LoggerOptions} from "pino"

/**
 * Default field name used for correlation ID in structured logs.
 */
export const DEFAULT_WORKER_CORRELATION_ID_FIELD = "correlationId"

/**
 * Task context fields that can be attached to worker logs.
 */
export interface IWorkerTaskLogContext {
    /**
     * Optional task identifier.
     */
    readonly taskId?: string

    /**
     * Optional logical task type.
     */
    readonly taskType?: string

    /**
     * Optional queue name.
     */
    readonly queueName?: string
}

/**
 * Minimal Pino-compatible logger contract used by worker logger.
 */
export interface IWorkerPinoLoggerLike {
    /**
     * Writes info log.
     *
     * @param context Structured context.
     * @param message Optional message.
     */
    info(context: Record<string, unknown>, message?: string): void

    /**
     * Writes warning log.
     *
     * @param context Structured context.
     * @param message Optional message.
     */
    warn(context: Record<string, unknown>, message?: string): void

    /**
     * Writes error log.
     *
     * @param context Structured context.
     * @param message Optional message.
     */
    error(context: Record<string, unknown>, message?: string): void

    /**
     * Writes debug log.
     *
     * @param context Structured context.
     * @param message Optional message.
     */
    debug(context: Record<string, unknown>, message?: string): void

    /**
     * Creates child logger with bound context.
     *
     * @param context Bound context.
     * @returns Child logger.
     */
    child(context: Record<string, unknown>): IWorkerPinoLoggerLike
}

/**
 * Constructor options for WorkerPinoLogger.
 */
export interface IWorkerPinoLoggerOptions {
    /**
     * Optional prebuilt Pino logger for tests/custom wiring.
     */
    readonly pinoLogger?: IWorkerPinoLoggerLike

    /**
     * Pino log level.
     */
    readonly level?: LevelWithSilent

    /**
     * Structured field name for correlation ID.
     */
    readonly correlationIdField?: string
}

/**
 * Pino-backed ILogger implementation for worker infrastructure.
 */
export class WorkerPinoLogger implements ILogger {
    private readonly pinoLogger: IWorkerPinoLoggerLike
    private readonly correlationIdField: string

    /**
     * Creates worker logger.
     *
     * @param options Logger options.
     */
    public constructor(options: IWorkerPinoLoggerOptions) {
        this.pinoLogger =
            options.pinoLogger ?? createDefaultPinoLogger(options.level)
        this.correlationIdField = normalizeNonEmptyString(
            options.correlationIdField ?? DEFAULT_WORKER_CORRELATION_ID_FIELD,
            "correlationIdField",
        )
    }

    /**
     * Writes informational worker log.
     *
     * @param message Message text.
     * @param context Optional structured context.
     */
    public info(message: string, context?: Record<string, unknown>): Promise<void> {
        return this.runLog(
            () => {
                this.log("info", message, context)
            },
        )
    }

    /**
     * Writes warning worker log.
     *
     * @param message Message text.
     * @param context Optional structured context.
     */
    public warn(message: string, context?: Record<string, unknown>): Promise<void> {
        return this.runLog(
            () => {
                this.log("warn", message, context)
            },
        )
    }

    /**
     * Writes error worker log.
     *
     * @param message Message text.
     * @param context Optional structured context.
     */
    public error(message: string, context?: Record<string, unknown>): Promise<void> {
        return this.runLog(
            () => {
                this.log("error", message, context)
            },
        )
    }

    /**
     * Writes debug worker log.
     *
     * @param message Message text.
     * @param context Optional structured context.
     */
    public debug(message: string, context?: Record<string, unknown>): Promise<void> {
        return this.runLog(
            () => {
                this.log("debug", message, context)
            },
        )
    }

    /**
     * Creates child logger with bound context.
     *
     * @param context Bound context.
     * @returns Child worker logger.
     */
    public child(context: Record<string, unknown>): WorkerPinoLogger {
        const normalizedContext = normalizeContext(context, "context")
        return new WorkerPinoLogger({
            pinoLogger: this.pinoLogger.child(normalizedContext),
            correlationIdField: this.correlationIdField,
        })
    }

    /**
     * Creates child logger with bound correlation ID field.
     *
     * @param correlationId Correlation ID value.
     * @returns Child worker logger.
     */
    public withCorrelationId(correlationId: string): WorkerPinoLogger {
        const normalizedCorrelationId = normalizeNonEmptyString(
            correlationId,
            "correlationId",
        )
        return this.child({
            [this.correlationIdField]: normalizedCorrelationId,
        })
    }

    /**
     * Creates child logger with bound task context.
     *
     * @param taskContext Task context.
     * @returns Child worker logger.
     */
    public withTaskContext(taskContext: IWorkerTaskLogContext): WorkerPinoLogger {
        const normalizedTaskContext = normalizeTaskContext(taskContext)
        return this.child(normalizedTaskContext)
    }

    /**
     * Writes structured log entry with message.
     *
     * @param level Log level.
     * @param message Message text.
     * @param context Optional structured context.
     */
    private log(
        level: "info" | "warn" | "error" | "debug",
        message: string,
        context?: Record<string, unknown>,
    ): void {
        const normalizedMessage = normalizeNonEmptyString(message, "message")
        const normalizedContext =
            context === undefined ? {} : normalizeContext(context, "context")
        this.pinoLogger[level](normalizedContext, normalizedMessage)
    }

    /**
     * Executes one logging operation and converts sync failures to rejected Promise.
     *
     * @param action Logging action.
     * @returns Resolved promise on success, rejected on failure.
     */
    private runLog(action: () => void): Promise<void> {
        try {
            action()
            return Promise.resolve()
        } catch (error: unknown) {
            return Promise.reject(toError(error))
        }
    }
}

/**
 * Creates default Pino logger in structured JSON mode.
 *
 * @param level Log level.
 * @returns Pino-compatible logger.
 */
function createDefaultPinoLogger(level?: LevelWithSilent): IWorkerPinoLoggerLike {
    const options: LoggerOptions = {
        level: level ?? "info",
        messageKey: "message",
        base: undefined,
    }
    return pino(options)
}

/**
 * Validates worker task log context.
 *
 * @param taskContext Raw task context.
 * @returns Normalized task context.
 */
function normalizeTaskContext(
    taskContext: IWorkerTaskLogContext,
): Record<string, string> {
    const normalizedContext: Record<string, string> = {}
    if (taskContext.taskId !== undefined && taskContext.taskId.trim().length > 0) {
        normalizedContext.taskId = taskContext.taskId.trim()
    }
    if (taskContext.taskType !== undefined && taskContext.taskType.trim().length > 0) {
        normalizedContext.taskType = taskContext.taskType.trim()
    }
    if (taskContext.queueName !== undefined && taskContext.queueName.trim().length > 0) {
        normalizedContext.queueName = taskContext.queueName.trim()
    }

    if (Object.keys(normalizedContext).length === 0) {
        throw new Error("taskContext must include at least one non-empty field")
    }

    return normalizedContext
}

/**
 * Validates structured context object.
 *
 * @param context Raw context.
 * @param fieldName Field name for error message.
 * @returns Context as-is.
 */
function normalizeContext(
    context: Record<string, unknown>,
    fieldName: string,
): Record<string, unknown> {
    if (Object.keys(context).length === 0) {
        throw new Error(`${fieldName} must include at least one field`)
    }

    return context
}

/**
 * Validates non-empty text input.
 *
 * @param value Raw value.
 * @param fieldName Field name for error message.
 * @returns Trimmed string.
 */
function normalizeNonEmptyString(value: string, fieldName: string): string {
    const normalized = value.trim()
    if (normalized.length === 0) {
        throw new Error(`${fieldName} must be a non-empty string`)
    }

    return normalized
}

/**
 * Converts unknown value to Error instance.
 *
 * @param value Unknown error value.
 * @returns Error instance.
 */
function toError(value: unknown): Error {
    if (value instanceof Error) {
        return value
    }

    return new Error(String(value))
}
