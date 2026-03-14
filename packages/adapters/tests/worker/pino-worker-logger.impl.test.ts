import {describe, expect, test} from "bun:test"

import {
    WorkerPinoLogger,
    type IWorkerPinoLoggerLike,
} from "../../src/worker"

/**
 * Captured log entry.
 */
interface ICapturedLogEntry {
    /**
     * Log level.
     */
    readonly level: "info" | "warn" | "error" | "debug"

    /**
     * Serialized log payload.
     */
    readonly context: Record<string, unknown>

    /**
     * Log message.
     */
    readonly message: string
}

/**
 * Capturing Pino-compatible logger.
 */
class CapturingPinoLogger implements IWorkerPinoLoggerLike {
    private readonly entries: ICapturedLogEntry[]
    private readonly bindings: Record<string, unknown>

    /**
     * Creates capturing logger.
     *
     * @param entries Shared log sink.
     * @param bindings Bound structured context.
     */
    public constructor(
        entries: ICapturedLogEntry[],
        bindings: Record<string, unknown> = {},
    ) {
        this.entries = entries
        this.bindings = bindings
    }

    /**
     * Captures info-level log.
     *
     * @param context Structured context.
     * @param message Log message.
     */
    public info(context: Record<string, unknown>, message?: string): void {
        this.push("info", context, message)
    }

    /**
     * Captures warn-level log.
     *
     * @param context Structured context.
     * @param message Log message.
     */
    public warn(context: Record<string, unknown>, message?: string): void {
        this.push("warn", context, message)
    }

    /**
     * Captures error-level log.
     *
     * @param context Structured context.
     * @param message Log message.
     */
    public error(context: Record<string, unknown>, message?: string): void {
        this.push("error", context, message)
    }

    /**
     * Captures debug-level log.
     *
     * @param context Structured context.
     * @param message Log message.
     */
    public debug(context: Record<string, unknown>, message?: string): void {
        this.push("debug", context, message)
    }

    /**
     * Creates child logger inheriting context bindings.
     *
     * @param bindings Child bindings.
     * @returns Capturing child logger.
     */
    public child(bindings: Record<string, unknown>): IWorkerPinoLoggerLike {
        return new CapturingPinoLogger(this.entries, {
            ...this.bindings,
            ...bindings,
        })
    }

    /**
     * Pushes one log entry to sink.
     *
     * @param level Log level.
     * @param context Log context.
     * @param message Log message.
     */
    private push(
        level: ICapturedLogEntry["level"],
        context: Record<string, unknown>,
        message?: string,
    ): void {
        this.entries.push({
            level,
            context: {
                ...this.bindings,
                ...context,
            },
            message: message ?? "",
        })
    }
}

describe("WorkerPinoLogger", () => {
    test("writes structured JSON-like log entries for all levels", async () => {
        const entries: ICapturedLogEntry[] = []
        const logger = new WorkerPinoLogger({
            pinoLogger: new CapturingPinoLogger(entries),
        })

        await logger.info("job started", {
            jobId: "job-1",
        })
        await logger.warn("job delayed", {
            retryInMs: 200,
        })
        await logger.error("job failed", {
            reason: "network",
        })
        await logger.debug("job context", {
            queue: "review-jobs",
        })

        expect(entries).toEqual([
            {
                level: "info",
                context: {
                    jobId: "job-1",
                },
                message: "job started",
            },
            {
                level: "warn",
                context: {
                    retryInMs: 200,
                },
                message: "job delayed",
            },
            {
                level: "error",
                context: {
                    reason: "network",
                },
                message: "job failed",
            },
            {
                level: "debug",
                context: {
                    queue: "review-jobs",
                },
                message: "job context",
            },
        ])
    })

    test("propagates child bindings with correlation id and task context", async () => {
        const entries: ICapturedLogEntry[] = []
        const logger = new WorkerPinoLogger({
            pinoLogger: new CapturingPinoLogger(entries),
            correlationIdField: "traceId",
        })

        const childLogger = logger.child({
            queueName: "review-jobs",
        })
        const taskLogger = childLogger
            .withCorrelationId("corr-123")
            .withTaskContext({
                taskId: "task-1",
                taskType: "scan",
            })

        await taskLogger.info("processing task", {
            attempt: 2,
        })

        expect(entries).toEqual([
            {
                level: "info",
                context: {
                    queueName: "review-jobs",
                    traceId: "corr-123",
                    taskId: "task-1",
                    taskType: "scan",
                    attempt: 2,
                },
                message: "processing task",
            },
        ])
    })

    test("validates correlation and task context values", async () => {
        expect(
            () =>
                new WorkerPinoLogger({
                    correlationIdField: " ",
                }),
        ).toThrow("correlationIdField must be a non-empty string")

        const logger = new WorkerPinoLogger({})
        await expectRejectMessage(
            logger.info(" ", {
                taskId: "task-1",
            }),
            "message must be a non-empty string",
        )
        expect(() => logger.withCorrelationId(" ")).toThrow(
            "correlationId must be a non-empty string",
        )
        expect(() => logger.withTaskContext({})).toThrow(
            "taskContext must include at least one non-empty field",
        )
    })
})

/**
 * Asserts that promise rejects with expected message.
 *
 * @param promise Promise expected to reject.
 * @param message Expected message.
 */
async function expectRejectMessage(
    promise: Promise<unknown>,
    message: string,
): Promise<void> {
    try {
        await promise
        throw new Error("Expected promise rejection")
    } catch (error: unknown) {
        if (error instanceof Error) {
            expect(error.message).toBe(message)
            return
        }

        throw error
    }
}
