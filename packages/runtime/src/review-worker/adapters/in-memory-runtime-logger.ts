import type {IRuntimeLogger} from "../ports/runtime-logger.port"

/**
 * Log entry stored by in-memory logger.
 */
export interface IRuntimeLogEntry {
    level: "info" | "warn" | "error" | "debug"
    message: string
    context: Record<string, unknown>
}

/**
 * In-memory logger implementation for runtime bootstrap and tests.
 */
export class InMemoryRuntimeLogger implements IRuntimeLogger {
    public readonly entries: IRuntimeLogEntry[]
    private readonly baseContext: Record<string, unknown>

    /**
     * Creates in-memory logger.
     *
     * @param baseContext Context attached to each entry.
     * @param entries Shared entries storage.
     */
    public constructor(
        baseContext: Record<string, unknown> = {},
        entries: IRuntimeLogEntry[] = [],
    ) {
        this.baseContext = {...baseContext}
        this.entries = entries
    }

    /**
     * Writes info log entry.
     *
     * @param message Log message.
     * @param context Optional context.
     * @returns Promise resolved after write.
     */
    public info(message: string, context?: Record<string, unknown>): Promise<void> {
        return this.write("info", message, context)
    }

    /**
     * Writes warn log entry.
     *
     * @param message Log message.
     * @param context Optional context.
     * @returns Promise resolved after write.
     */
    public warn(message: string, context?: Record<string, unknown>): Promise<void> {
        return this.write("warn", message, context)
    }

    /**
     * Writes error log entry.
     *
     * @param message Log message.
     * @param context Optional context.
     * @returns Promise resolved after write.
     */
    public error(message: string, context?: Record<string, unknown>): Promise<void> {
        return this.write("error", message, context)
    }

    /**
     * Writes debug log entry.
     *
     * @param message Log message.
     * @param context Optional context.
     * @returns Promise resolved after write.
     */
    public debug(message: string, context?: Record<string, unknown>): Promise<void> {
        return this.write("debug", message, context)
    }

    /**
     * Creates child logger sharing same entries storage.
     *
     * @param context Child context.
     * @returns Child logger.
     */
    public child(context: Record<string, unknown>): IRuntimeLogger {
        return new InMemoryRuntimeLogger({...this.baseContext, ...context}, this.entries)
    }

    /**
     * Writes structured entry.
     *
     * @param level Log level.
     * @param message Log message.
     * @param context Optional context.
     * @returns Promise resolved after write.
     */
    private write(
        level: IRuntimeLogEntry["level"],
        message: string,
        context?: Record<string, unknown>,
    ): Promise<void> {
        const normalizedContext = context ?? {}
        this.entries.push({
            level,
            message,
            context: {...this.baseContext, ...normalizedContext},
        })

        return Promise.resolve()
    }
}
