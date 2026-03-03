import {describe, expect, test} from "bun:test"

import type {ILanguageStat, IScanResult} from "../../../../src/application/dto/scanning/scan-result.dto"

describe("IScanResult", () => {
    test("поддерживает агрегированные результаты сканирования", () => {
        const scanResult: IScanResult = {
            scanId: "scan-001",
            repositoryId: "repo-001",
            totalFiles: 12,
            totalNodes: 37,
            totalEdges: 24,
            languages: [
                {
                    language: "TypeScript",
                    fileCount: 10,
                    loc: 1230,
                },
            ] as readonly ILanguageStat[],
            duration: 1845,
            completedAt: "2026-03-03T12:00:00.000Z",
        }

        expect(scanResult.scanId).toBe("scan-001")
        expect(scanResult.repositoryId).toBe("repo-001")
        expect(scanResult.languages).toHaveLength(1)
        expect(scanResult.languages[0] !== undefined).toBe(true)
        expect(scanResult.languages[0]?.language).toBe("TypeScript")
        expect(scanResult.duration).toBe(1845)
    })

    test("поддерживает пустой набор языков при завершении без детекции", () => {
        const emptyLanguages: readonly ILanguageStat[] = []
        const scanResult: IScanResult = {
            scanId: "scan-002",
            repositoryId: "repo-002",
            totalFiles: 0,
            totalNodes: 0,
            totalEdges: 0,
            languages: emptyLanguages,
            duration: 300,
            completedAt: "2026-03-03T12:10:00.000Z",
        }

        expect(scanResult.languages).toHaveLength(0)
        expect(scanResult.totalFiles).toBe(0)
    })
})
