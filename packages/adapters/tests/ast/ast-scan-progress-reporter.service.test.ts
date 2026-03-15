import {describe, expect, test} from "bun:test"

import {
    AST_SCAN_PROGRESS_REPORTER_ERROR_CODE,
    AstScanProgressReporterError,
    AstScanProgressReporterService,
    type AstScanProgressReporterErrorCode,
} from "../../src/ast"

/**
 * Asserts typed AST scan progress reporter error for sync callback.
 *
 * @param callback Action expected to fail.
 * @param code Expected typed error code.
 */
function expectAstScanProgressReporterError(
    callback: () => unknown,
    code: AstScanProgressReporterErrorCode,
): void {
    try {
        callback()
    } catch (error) {
        expect(error).toBeInstanceOf(AstScanProgressReporterError)

        if (error instanceof AstScanProgressReporterError) {
            expect(error.code).toBe(code)
            return
        }
    }

    throw new Error("Expected AstScanProgressReporterError to be thrown")
}

/**
 * Asserts typed AST scan progress reporter error for async callback.
 *
 * @param callback Action expected to fail.
 * @param code Expected typed error code.
 * @returns Promise resolved when assertion passes.
 */
async function expectAstScanProgressReporterErrorAsync(
    callback: () => Promise<unknown>,
    code: AstScanProgressReporterErrorCode,
): Promise<void> {
    try {
        await callback()
    } catch (error) {
        expect(error).toBeInstanceOf(AstScanProgressReporterError)

        if (error instanceof AstScanProgressReporterError) {
            expect(error.code).toBe(code)
            return
        }
    }

    throw new Error("Expected AstScanProgressReporterError to be thrown")
}

describe("AstScanProgressReporterService", () => {
    test("reports snapshots with current file and eta via IScanProgressCallback", async () => {
        const snapshots: Array<{
            processedFiles: number
            totalFiles: number
            progressPercent: number
            currentFilePath?: string
            elapsedMs: number
            etaMs: number | null
        }> = []
        const nowValues = [1000, 1100, 1300]
        let nowIndex = 0

        const reporter = new AstScanProgressReporterService({
            now: () => {
                const value = nowValues[nowIndex] ?? 1300
                nowIndex += 1
                return value
            },
            onSnapshot: (snapshot) => {
                snapshots.push({
                    processedFiles: snapshot.processedFiles,
                    totalFiles: snapshot.totalFiles,
                    progressPercent: snapshot.progressPercent,
                    currentFilePath: snapshot.currentFilePath,
                    elapsedMs: snapshot.elapsedMs,
                    etaMs: snapshot.etaMs,
                })
            },
        })

        const callback = reporter.asCallback()
        reporter.setCurrentFile("src/a.ts")
        await callback({processedFiles: 1, totalFiles: 4})
        reporter.setCurrentFile("src/b.ts")
        await callback({processedFiles: 2, totalFiles: 4})

        expect(snapshots).toEqual([
            {
                processedFiles: 1,
                totalFiles: 4,
                progressPercent: 25,
                currentFilePath: "src/a.ts",
                elapsedMs: 100,
                etaMs: 300,
            },
            {
                processedFiles: 2,
                totalFiles: 4,
                progressPercent: 50,
                currentFilePath: "src/b.ts",
                elapsedMs: 300,
                etaMs: 300,
            },
        ])
        expect(reporter.getSnapshot()?.processedFiles).toBe(2)
    })

    test("supports reset and completion eta behavior", async () => {
        const nowValues = [1000, 1500, 2000, 2600]
        let nowIndex = 0
        const reporter = new AstScanProgressReporterService({
            now: () => {
                const value = nowValues[nowIndex] ?? 2600
                nowIndex += 1
                return value
            },
        })

        const completedSnapshot = await reporter.report({
            processedFiles: 3,
            totalFiles: 3,
        })
        expect(completedSnapshot.etaMs).toBe(0)
        expect(completedSnapshot.progressPercent).toBe(100)

        reporter.reset()
        const initialSnapshot = await reporter.report({
            processedFiles: 0,
            totalFiles: 0,
        })
        expect(initialSnapshot.elapsedMs).toBe(600)
        expect(initialSnapshot.etaMs).toBeNull()
    })

    test("throws typed errors for invalid config, input, and callback failures", async () => {
        expectAstScanProgressReporterError(
            () =>
                new AstScanProgressReporterService({
                    onSnapshot: 1 as unknown as (
                        snapshot: {
                            processedFiles: number
                        },
                    ) => void,
                }),
            AST_SCAN_PROGRESS_REPORTER_ERROR_CODE.INVALID_ON_SNAPSHOT,
        )

        const reporter = new AstScanProgressReporterService()
        expectAstScanProgressReporterError(
            () => reporter.setCurrentFile(" "),
            AST_SCAN_PROGRESS_REPORTER_ERROR_CODE.INVALID_FILE_PATH,
        )
        await expectAstScanProgressReporterErrorAsync(
            () =>
                reporter.report({
                    processedFiles: 2,
                    totalFiles: 1,
                }),
            AST_SCAN_PROGRESS_REPORTER_ERROR_CODE.INVALID_PROCESSED_FILES,
        )
        await expectAstScanProgressReporterErrorAsync(
            () =>
                reporter.report({
                    processedFiles: 1,
                    totalFiles: -1,
                }),
            AST_SCAN_PROGRESS_REPORTER_ERROR_CODE.INVALID_TOTAL_FILES,
        )

        const failureReporter = new AstScanProgressReporterService({
            onSnapshot: () => {
                throw new Error("sink failed")
            },
        })
        await expectAstScanProgressReporterErrorAsync(
            () =>
                failureReporter.report({
                    processedFiles: 1,
                    totalFiles: 2,
                }),
            AST_SCAN_PROGRESS_REPORTER_ERROR_CODE.SNAPSHOT_CALLBACK_FAILED,
        )
    })
})
