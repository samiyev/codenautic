/**
 * Structured logger contract used by application layer.
 */
export interface ILogger {
    /**
     * Writes informational message.
     *
     * @param message Human-readable message.
     * @param context Optional structured context.
     * @returns Promise resolved when log is handled.
     */
    info(message: string, context?: Record<string, unknown>): Promise<void>

    /**
     * Writes warning message.
     *
     * @param message Human-readable message.
     * @param context Optional structured context.
     * @returns Promise resolved when log is handled.
     */
    warn(message: string, context?: Record<string, unknown>): Promise<void>

    /**
     * Writes error message.
     *
     * @param message Human-readable message.
     * @param context Optional structured context.
     * @returns Promise resolved when log is handled.
     */
    error(message: string, context?: Record<string, unknown>): Promise<void>

    /**
     * Writes debug message.
     *
     * @param message Human-readable message.
     * @param context Optional structured context.
     * @returns Promise resolved when log is handled.
     */
    debug(message: string, context?: Record<string, unknown>): Promise<void>

    /**
     * Creates child logger with inherited context.
     *
     * @param context Bound context fields.
     * @returns Logger with bound context.
     */
    child(context: Record<string, unknown>): ILogger
}
