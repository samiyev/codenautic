import {describe, expect, test} from "bun:test"

import {
    AST_MEMORY_PRESSURE_MANAGER_ERROR_CODE,
    AST_MEMORY_PRESSURE_STATE,
    AstMemoryPressureManagerError,
    AstMemoryPressureManagerService,
} from "../../src/ast"

/**
 * Asserts typed memory pressure manager error for sync action.
 *
 * @param callback Action expected to throw.
 * @param code Expected error code.
 */
function expectAstMemoryPressureManagerError(
    callback: () => unknown,
    code:
        (typeof AST_MEMORY_PRESSURE_MANAGER_ERROR_CODE)[keyof typeof AST_MEMORY_PRESSURE_MANAGER_ERROR_CODE],
): void {
    try {
        callback()
    } catch (error) {
        expect(error).toBeInstanceOf(AstMemoryPressureManagerError)

        if (error instanceof AstMemoryPressureManagerError) {
            expect(error.code).toBe(code)
            return
        }
    }

    throw new Error("Expected AstMemoryPressureManagerError to be thrown")
}

/**
 * Asserts typed memory pressure manager error for async action.
 *
 * @param callback Async action expected to reject.
 * @param code Expected error code.
 * @returns Promise resolved when assertion passes.
 */
async function expectAstMemoryPressureManagerErrorAsync(
    callback: () => Promise<unknown>,
    code:
        (typeof AST_MEMORY_PRESSURE_MANAGER_ERROR_CODE)[keyof typeof AST_MEMORY_PRESSURE_MANAGER_ERROR_CODE],
): Promise<void> {
    try {
        await callback()
    } catch (error) {
        expect(error).toBeInstanceOf(AstMemoryPressureManagerError)

        if (error instanceof AstMemoryPressureManagerError) {
            expect(error.code).toBe(code)
            return
        }
    }

    throw new Error("Expected AstMemoryPressureManagerError to be thrown")
}

describe("AstMemoryPressureManagerService", () => {
    test("pauses at or above 85 percent and resumes below threshold", () => {
        const service = new AstMemoryPressureManagerService()

        const pausedStatus = service.evaluate({
            usedBytes: 850,
            totalBytes: 1_000,
            sampleId: "sample-1",
        })

        expect(pausedStatus.state).toBe(AST_MEMORY_PRESSURE_STATE.PAUSED)
        expect(pausedStatus.isPaused).toBe(true)
        expect(pausedStatus.utilizationPercent).toBe(85)

        const stillPausedStatus = service.evaluate({
            usedBytes: 850,
            totalBytes: 1_000,
            sampleId: "sample-2",
        })

        expect(stillPausedStatus.state).toBe(AST_MEMORY_PRESSURE_STATE.PAUSED)

        const resumedStatus = service.evaluate({
            usedBytes: 840,
            totalBytes: 1_000,
            sampleId: "sample-3",
        })

        expect(resumedStatus.state).toBe(AST_MEMORY_PRESSURE_STATE.NORMAL)
        expect(resumedStatus.isPaused).toBe(false)
        expect(resumedStatus.utilizationPercent).toBe(84)
    })

    test("ignores duplicated sample id for idempotency", () => {
        const service = new AstMemoryPressureManagerService()

        const firstStatus = service.evaluate({
            usedBytes: 900,
            totalBytes: 1_000,
            sampleId: "same-sample",
        })
        const transitionAt = firstStatus.lastTransitionAt

        const duplicatedStatus = service.evaluate({
            usedBytes: 400,
            totalBytes: 1_000,
            sampleId: "same-sample",
        })

        expect(duplicatedStatus.state).toBe(AST_MEMORY_PRESSURE_STATE.PAUSED)
        expect(duplicatedStatus.lastTransitionAt).toEqual(transitionAt)
        expect(duplicatedStatus.utilizationPercent).toBe(90)
    })

    test("reads snapshot with retries and evaluates sample", async () => {
        const backoffDurations: number[] = []
        let callCount = 0
        const service = new AstMemoryPressureManagerService({
            snapshotProvider: () => {
                callCount += 1

                if (callCount < 3) {
                    return Promise.reject(new Error("temporary"))
                }

                return Promise.resolve({
                    usedBytes: 860,
                    totalBytes: 1_000,
                    sampleId: "provider-sample",
                })
            },
            retryPolicy: {
                maxAttempts: 3,
                initialBackoffMs: 10,
                maxBackoffMs: 20,
            },
            sleep: (durationMs) => {
                backoffDurations.push(durationMs)
                return Promise.resolve()
            },
        })

        const status = await service.readAndEvaluate()

        expect(callCount).toBe(3)
        expect(backoffDurations).toEqual([10, 20])
        expect(status.state).toBe(AST_MEMORY_PRESSURE_STATE.PAUSED)
    })

    test("throws typed error when provider keeps failing", async () => {
        const service = new AstMemoryPressureManagerService({
            snapshotProvider: () => Promise.reject(new Error("unavailable")),
            retryPolicy: {
                maxAttempts: 2,
                initialBackoffMs: 1,
                maxBackoffMs: 1,
            },
            sleep: () => Promise.resolve(),
        })

        await expectAstMemoryPressureManagerErrorAsync(
            async () => service.readAndEvaluate(),
            AST_MEMORY_PRESSURE_MANAGER_ERROR_CODE.SNAPSHOT_PROVIDER_FAILED,
        )
    })

    test("throws typed errors for invalid options and samples", async () => {
        expectAstMemoryPressureManagerError(
            () => {
                void new AstMemoryPressureManagerService({
                    pauseThresholdPercent: 120,
                })
            },
            AST_MEMORY_PRESSURE_MANAGER_ERROR_CODE.INVALID_PAUSE_THRESHOLD_PERCENT,
        )

        expectAstMemoryPressureManagerError(
            () => {
                void new AstMemoryPressureManagerService({
                    pauseThresholdPercent: 85,
                    resumeThresholdPercent: 90,
                })
            },
            AST_MEMORY_PRESSURE_MANAGER_ERROR_CODE.INVALID_RESUME_THRESHOLD_PERCENT,
        )

        expectAstMemoryPressureManagerError(
            () => {
                void new AstMemoryPressureManagerService({
                    snapshotProvider: "bad-provider" as never,
                })
            },
            AST_MEMORY_PRESSURE_MANAGER_ERROR_CODE.INVALID_SNAPSHOT_PROVIDER,
        )

        const service = new AstMemoryPressureManagerService()

        expectAstMemoryPressureManagerError(
            () => {
                void service.evaluate({
                    usedBytes: -1,
                    totalBytes: 1_000,
                })
            },
            AST_MEMORY_PRESSURE_MANAGER_ERROR_CODE.INVALID_USED_BYTES,
        )

        expectAstMemoryPressureManagerError(
            () => {
                void service.evaluate({
                    usedBytes: 1_001,
                    totalBytes: 1_000,
                })
            },
            AST_MEMORY_PRESSURE_MANAGER_ERROR_CODE.INVALID_USED_BYTES,
        )

        await expectAstMemoryPressureManagerErrorAsync(
            async () => service.readAndEvaluate(),
            AST_MEMORY_PRESSURE_MANAGER_ERROR_CODE.INVALID_SNAPSHOT_PROVIDER,
        )
    })
})
