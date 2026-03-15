import {describe, expect, test} from "bun:test"
import {mkdtemp, mkdir, rm, writeFile} from "node:fs/promises"
import {tmpdir} from "node:os"
import {join} from "node:path"

import {
    AST_INCREMENTAL_DIFF_SCANNER_ERROR_CODE,
    AstIncrementalDiffScannerError,
    AstIncrementalDiffScannerService,
    type AstIncrementalDiffScannerErrorCode,
} from "../../src/ast"

/**
 * Asserts typed AST incremental diff scanner error for async action.
 *
 * @param callback Action expected to fail.
 * @param code Expected typed error code.
 * @returns Promise resolved when assertion passes.
 */
async function expectAstIncrementalDiffScannerError(
    callback: () => Promise<unknown>,
    code: AstIncrementalDiffScannerErrorCode,
): Promise<void> {
    try {
        await callback()
    } catch (error) {
        expect(error).toBeInstanceOf(AstIncrementalDiffScannerError)

        if (error instanceof AstIncrementalDiffScannerError) {
            expect(error.code).toBe(code)
            return
        }
    }

    throw new Error("Expected AstIncrementalDiffScannerError to be thrown")
}

describe("AstIncrementalDiffScannerService", () => {
    test("scans changed files only and reuses cached AST artifacts for repeated ref scans", async () => {
        const repositoryPath = await mkdtemp(join(tmpdir(), "ast-incremental-scan-"))
        await mkdir(join(repositoryPath, "src"), {recursive: true})
        await writeFile(
            join(repositoryPath, "src", "app.ts"),
            "import {util} from \"./util\"\nexport function runApp(): number {\n    return util()\n}\n",
            "utf8",
        )
        await writeFile(
            join(repositoryPath, "src", "util.ts"),
            "export const util = (): number => {\n    return 1\n}\n",
            "utf8",
        )
        await writeFile(join(repositoryPath, "README.md"), "docs\n", "utf8")

        const readCountByFile = new Map<string, number>()
        const progressEvents: Array<{processedFiles: number; totalFiles: number}> = []
        const scanner = new AstIncrementalDiffScannerService({
            resolveRepositoryPath: () => repositoryPath,
            resolveChangedFilePaths: () =>
                Promise.resolve([
                    "src/app.ts",
                    "src/util.ts",
                    "src/app.ts",
                    "README.md",
                ]),
            readFile: (absoluteFilePath) => {
                const attempts = (readCountByFile.get(absoluteFilePath) ?? 0) + 1
                readCountByFile.set(absoluteFilePath, attempts)
                return Bun.file(absoluteFilePath).arrayBuffer().then((buffer) => Buffer.from(buffer))
            },
        })

        const firstResult = await scanner.scanRepository("repo-1", "main", (progress) => {
            progressEvents.push(progress)
        })
        const secondResult = await scanner.scanRepository("repo-1", "main", (progress) => {
            progressEvents.push(progress)
        })

        await rm(repositoryPath, {recursive: true, force: true})

        expect(firstResult.totalFiles).toBe(2)
        expect(firstResult.totalNodes).toBe(2)
        expect(firstResult.totalEdges).toBe(1)
        expect(firstResult.languages).toEqual([
            {language: "TypeScript", fileCount: 2, loc: 7},
        ])
        expect(secondResult.totalFiles).toBe(2)
        expect(secondResult.totalNodes).toBe(2)
        expect(secondResult.totalEdges).toBe(1)

        expect(progressEvents).toEqual([
            {processedFiles: 1, totalFiles: 2},
            {processedFiles: 2, totalFiles: 2},
            {processedFiles: 1, totalFiles: 2},
            {processedFiles: 2, totalFiles: 2},
        ])

        expect(readCountByFile.size).toBe(2)
        for (const readCount of readCountByFile.values()) {
            expect(readCount).toBe(1)
        }
    })

    test("supports scan cancellation", async () => {
        const scanner = new AstIncrementalDiffScannerService({
            generateScanId: () => "scan-cancelled",
            resolveChangedFilePaths: () =>
                Promise.resolve(["src/a.ts", "src/b.ts"]),
            readFile: (absoluteFilePath) => {
                if (absoluteFilePath.endsWith("/src/a.ts")) {
                    void scanner.cancelScan("scan-cancelled")
                }

                return Promise.resolve(Buffer.from("export const value = 1\n", "utf8"))
            },
        })

        await expectAstIncrementalDiffScannerError(
            () => scanner.scanRepository("/tmp/repo", "main"),
            AST_INCREMENTAL_DIFF_SCANNER_ERROR_CODE.SCAN_CANCELLED,
        )
    })

    test("retries read failures and skips removed files", async () => {
        const attemptsByFile = new Map<string, number>()
        const scanner = new AstIncrementalDiffScannerService({
            resolveChangedFilePaths: () =>
                Promise.resolve(["src/flaky.ts", "src/deleted.ts"]),
            readFile: (absoluteFilePath) => {
                const attempts = (attemptsByFile.get(absoluteFilePath) ?? 0) + 1
                attemptsByFile.set(absoluteFilePath, attempts)

                if (absoluteFilePath.endsWith("/src/flaky.ts") && attempts === 1) {
                    return Promise.reject(new Error("EAGAIN"))
                }

                if (absoluteFilePath.endsWith("/src/deleted.ts")) {
                    const errorWithCode = new Error("file removed") as Error & {code: string}
                    errorWithCode.code = "ENOENT"
                    return Promise.reject(errorWithCode)
                }

                return Promise.resolve(Buffer.from("export const flaky = 1\n", "utf8"))
            },
            maxReadAttempts: 2,
            retryBackoffMs: 1,
        })

        const result = await scanner.scanRepository("/tmp/repo", "main")

        expect(result.totalFiles).toBe(1)
        expect(result.totalNodes).toBe(1)
        expect(result.totalEdges).toBe(0)
    })

    test("throws typed errors for invalid input and progress callback failures", async () => {
        const scanner = new AstIncrementalDiffScannerService({
            resolveChangedFilePaths: () => Promise.resolve(["src/a.ts"]),
            readFile: () => Promise.resolve(Buffer.from("export const a = 1\n", "utf8")),
            generateScanId: () => "scan-progress-fail",
        })

        await expectAstIncrementalDiffScannerError(
            () => scanner.scanRepository(" ", "main"),
            AST_INCREMENTAL_DIFF_SCANNER_ERROR_CODE.INVALID_REPOSITORY_ID,
        )
        await expectAstIncrementalDiffScannerError(
            () => scanner.scanRepository("/tmp/repo", " "),
            AST_INCREMENTAL_DIFF_SCANNER_ERROR_CODE.INVALID_REF,
        )
        await expectAstIncrementalDiffScannerError(
            () =>
                scanner.scanRepository("/tmp/repo", "main", () => {
                    throw new Error("progress unavailable")
                }),
            AST_INCREMENTAL_DIFF_SCANNER_ERROR_CODE.PROGRESS_CALLBACK_FAILED,
        )
    })

    test("wraps resolver failures into typed errors", async () => {
        const repositoryPathFailureScanner = new AstIncrementalDiffScannerService({
            resolveRepositoryPath: () => Promise.reject(new Error("resolver unavailable")),
        })

        await expectAstIncrementalDiffScannerError(
            () => repositoryPathFailureScanner.scanRepository("repo-1", "main"),
            AST_INCREMENTAL_DIFF_SCANNER_ERROR_CODE.REPOSITORY_PATH_RESOLUTION_FAILED,
        )

        const changedFilesFailureScanner = new AstIncrementalDiffScannerService({
            resolveChangedFilePaths: () => Promise.reject(new Error("diff unavailable")),
        })

        await expectAstIncrementalDiffScannerError(
            () => changedFilesFailureScanner.scanRepository("/tmp/repo", "main"),
            AST_INCREMENTAL_DIFF_SCANNER_ERROR_CODE.CHANGED_FILES_RESOLUTION_FAILED,
        )
    })
})
