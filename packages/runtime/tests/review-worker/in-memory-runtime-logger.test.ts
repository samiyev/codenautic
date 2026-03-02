import {describe, expect, test} from "bun:test"

import {InMemoryRuntimeLogger} from "../../src/review-worker/adapters/in-memory-runtime-logger"

describe("InMemoryRuntimeLogger", () => {
    test("writes all levels and propagates child context", async () => {
        const logger = new InMemoryRuntimeLogger({process: "review-worker"})
        const child = logger.child({reviewId: "review-1"})

        await logger.info("started")
        await logger.warn("slow")
        await logger.error("failed")
        await child.debug("retried", {attempt: 2})

        expect(logger.entries).toHaveLength(4)
        expect(logger.entries[0]?.level).toBe("info")
        expect(logger.entries[1]?.level).toBe("warn")
        expect(logger.entries[2]?.level).toBe("error")
        expect(logger.entries[3]?.level).toBe("debug")
        expect(logger.entries[3]?.context).toMatchObject({
            process: "review-worker",
            reviewId: "review-1",
            attempt: 2,
        })
    })
})
