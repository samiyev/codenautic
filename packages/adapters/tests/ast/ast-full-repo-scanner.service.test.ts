import {describe, expect, test} from "bun:test"
import {mkdtemp, mkdir, rm, writeFile} from "node:fs/promises"
import {tmpdir} from "node:os"
import {join} from "node:path"

import {
    AST_FULL_REPO_SCANNER_ERROR_CODE,
    AstFullRepoScannerError,
    AstFullRepoScannerService,
    type AstFullRepoScannerErrorCode,
} from "../../src/ast"

/**
 * Asserts typed AST full repo scanner error for async action.
 *
 * @param callback Action expected to fail.
 * @param code Expected typed error code.
 * @returns Promise resolved when assertion passes.
 */
async function expectAstFullRepoScannerError(
    callback: () => Promise<unknown>,
    code: AstFullRepoScannerErrorCode,
): Promise<void> {
    try {
        await callback()
    } catch (error) {
        expect(error).toBeInstanceOf(AstFullRepoScannerError)

        if (error instanceof AstFullRepoScannerError) {
            expect(error.code).toBe(code)
            return
        }
    }

    throw new Error("Expected AstFullRepoScannerError to be thrown")
}

describe("AstFullRepoScannerService", () => {
    test("scans source files with language stats and progress callback", async () => {
        const repositoryPath = await mkdtemp(join(tmpdir(), "ast-full-repo-scan-"))
        await mkdir(join(repositoryPath, "src"), {recursive: true})
        await mkdir(join(repositoryPath, "vendor"), {recursive: true})
        await writeFile(
            join(repositoryPath, "src", "main.ts"),
            "import {util} from \"./util\"\nconst value = util()\n",
            "utf8",
        )
        await writeFile(join(repositoryPath, "src", "util.ts"), "export const util = () => 1\n", "utf8")
        await writeFile(
            join(repositoryPath, "src", "script.py"),
            "import os\nfrom pathlib import Path\n",
            "utf8",
        )
        await writeFile(join(repositoryPath, "vendor", "ignored.ts"), "const ignored = 1\n", "utf8")
        await writeFile(join(repositoryPath, "README.md"), "documentation\n", "utf8")

        let nowCall = 0
        const nowValues = [1000, 1600, 1600]
        const progressStates: Array<{processedFiles: number; totalFiles: number}> = []
        const scanner = new AstFullRepoScannerService({
            generateScanId: () => "scan-fixed-1",
            now: () => {
                const value = nowValues[nowCall] ?? 1600
                nowCall += 1
                return value
            },
        })

        const result = await scanner.scanRepository(repositoryPath, "main", (progress) => {
            progressStates.push(progress)
        })

        await rm(repositoryPath, {recursive: true, force: true})

        expect(result.scanId).toBe("scan-fixed-1")
        expect(result.repositoryId).toBe(repositoryPath)
        expect(result.totalFiles).toBe(3)
        expect(result.totalNodes).toBe(3)
        expect(result.totalEdges).toBe(3)
        expect(result.duration).toBe(600)
        expect(result.completedAt).toBe("1970-01-01T00:00:01.600Z")
        expect(result.languages).toEqual([
            {language: "Python", fileCount: 1, loc: 2},
            {language: "TypeScript", fileCount: 2, loc: 3},
        ])
        expect(progressStates).toEqual([
            {processedFiles: 1, totalFiles: 3},
            {processedFiles: 2, totalFiles: 3},
            {processedFiles: 3, totalFiles: 3},
        ])
    })

    test("supports scan cancellation", async () => {
        const scanner = new AstFullRepoScannerService({
            generateScanId: () => "scan-cancelled",
            listDirectory: (directoryPath) => {
                if (directoryPath.endsWith("/src")) {
                    return Promise.resolve([
                        {name: "a.ts", kind: "file" as const},
                        {name: "b.ts", kind: "file" as const},
                    ])
                }

                return Promise.resolve([{name: "src", kind: "directory" as const}])
            },
            readFile: (absoluteFilePath) => {
                if (absoluteFilePath.endsWith("/a.ts")) {
                    void scanner.cancelScan("scan-cancelled")
                }

                return Promise.resolve(Buffer.from("export const value = 1\n", "utf8"))
            },
        })

        await expectAstFullRepoScannerError(
            () => scanner.scanRepository("/tmp/repo", "main"),
            AST_FULL_REPO_SCANNER_ERROR_CODE.SCAN_CANCELLED,
        )
    })

    test("retries read failures and succeeds on next attempt", async () => {
        const attemptsByFile = new Map<string, number>()
        const scanner = new AstFullRepoScannerService({
            listDirectory: (directoryPath) => {
                if (directoryPath.endsWith("/src")) {
                    return Promise.resolve([{name: "index.ts", kind: "file" as const}])
                }

                return Promise.resolve([{name: "src", kind: "directory" as const}])
            },
            readFile: (absoluteFilePath) => {
                const attempts = (attemptsByFile.get(absoluteFilePath) ?? 0) + 1
                attemptsByFile.set(absoluteFilePath, attempts)
                if (attempts === 1) {
                    return Promise.reject(new Error("EAGAIN"))
                }

                return Promise.resolve(Buffer.from("export const v = 1\n", "utf8"))
            },
            maxReadAttempts: 2,
            retryBackoffMs: 1,
        })

        const result = await scanner.scanRepository("/tmp/repo", "main")

        expect(result.totalFiles).toBe(1)
        expect(result.totalNodes).toBe(1)
    })

    test("throws typed errors for invalid input and progress callback failures", async () => {
        const scanner = new AstFullRepoScannerService({
            listDirectory: () => Promise.resolve([{name: "a.ts", kind: "file"}]),
            readFile: () => Promise.resolve(Buffer.from("export const a = 1\n", "utf8")),
            generateScanId: () => "scan-progress-fail",
        })

        await expectAstFullRepoScannerError(
            () => scanner.scanRepository(" ", "main"),
            AST_FULL_REPO_SCANNER_ERROR_CODE.INVALID_REPOSITORY_ID,
        )

        await expectAstFullRepoScannerError(
            () => scanner.scanRepository("/tmp/repo", " "),
            AST_FULL_REPO_SCANNER_ERROR_CODE.INVALID_REF,
        )

        await expectAstFullRepoScannerError(
            () =>
                scanner.scanRepository("/tmp/repo", "main", () => {
                    throw new Error("progress unavailable")
                }),
            AST_FULL_REPO_SCANNER_ERROR_CODE.PROGRESS_CALLBACK_FAILED,
        )
    })

    test("wraps repository path resolution failures into typed error", async () => {
        const scanner = new AstFullRepoScannerService({
            resolveRepositoryPath: () => Promise.reject(new Error("resolver unavailable")),
        })

        await expectAstFullRepoScannerError(
            () => scanner.scanRepository("repo-1", "main"),
            AST_FULL_REPO_SCANNER_ERROR_CODE.REPOSITORY_PATH_RESOLUTION_FAILED,
        )
    })
})
