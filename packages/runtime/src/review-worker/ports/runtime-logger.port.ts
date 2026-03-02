/**
 * Structured logger contract for runtime workers.
 */
export interface IRuntimeLogger {
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
     * @param context Context fields bound to child.
     * @returns Child logger.
     */
    child(context: Record<string, unknown>): IRuntimeLogger
}
