import {describe, expect, test} from "bun:test"

import type {ILanguageStat, IScanResult} from "../../../../../src/application/dto/scanning"
import type {IRepositoryScanner, IScanProgressState} from "../../../../../src/application/ports/outbound/scanning/repository-scanner"

class InMemoryRepositoryScanner implements IRepositoryScanner {
    public async scanRepository(
        _repositoryId: string,
        _ref: string,
        onProgress?: (progress: IScanProgressState) => Promise<void> | void,
    ): Promise<IScanResult> {
        if (onProgress !== undefined) {
            await onProgress({processedFiles: 4, totalFiles: 4})
        }

        return {
            scanId: "scan-1",
            repositoryId: "repo-1",
            totalFiles: 4,
            totalNodes: 9,
            totalEdges: 11,
            languages: [
                {
                    language: "TypeScript",
                    fileCount: 4,
                    loc: 420,
                } as ILanguageStat,
            ],
            duration: 1400,
            completedAt: "2026-03-03T12:20:00.000Z",
        }
    }

    public async cancelScan(_scanId: string): Promise<void> {
        return Promise.resolve()
    }
}

describe("IRepositoryScanner contract", () => {
    test("scanRepository вызывается с callback для прогресса", async () => {
        const scanner = new InMemoryRepositoryScanner()
        let progressCalled = false

        const result: IScanResult = await scanner.scanRepository(
            "repo-1",
            "main",
            (progress: IScanProgressState) => {
                progressCalled = true
                expect(progress.processedFiles).toBe(4)
                expect(progress.totalFiles).toBe(4)
            },
        )

        expect(progressCalled).toBe(true)
        expect(result.scanId).toBe("scan-1")
        expect(result.totalFiles).toBe(4)
        expect(result.languages[0]?.language).toBe("TypeScript")
    })

    test("cancelScan завершается без исключений", async () => {
        const scanner = new InMemoryRepositoryScanner()

        await scanner.cancelScan("scan-1")
        expect(scanner).toBeDefined()
    })
})
