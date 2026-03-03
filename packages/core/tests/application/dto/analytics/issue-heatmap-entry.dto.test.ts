import {describe, expect, test} from "bun:test"

import type {IIssueHeatmapEntryDTO} from "../../../../src/application/dto/analytics/issue-heatmap-entry.dto"

describe("IIssueHeatmapEntryDTO", () => {
    test("поддерживает обязательные поля для агрегированного issue heatmap", () => {
        const entry: IIssueHeatmapEntryDTO = {
            filePath: "src/index.ts",
            totalIssues: 5,
            bySeverity: {high: 2, medium: 3},
            byCategory: {style: 1, security: 2, perf: 2},
        }

        expect(entry.filePath).toBe("src/index.ts")
        expect(entry.totalIssues).toBe(5)
        expect(entry.bySeverity.high).toBe(2)
        expect(entry.byCategory.perf).toBe(2)
    })

    test("поддерживает пустые агрегаты без значений", () => {
        const entry: IIssueHeatmapEntryDTO = {
            filePath: "src/no-issues.ts",
            totalIssues: 0,
            bySeverity: {},
            byCategory: {},
        }

        expect(entry.totalIssues).toBe(0)
        expect(Object.keys(entry.bySeverity)).toHaveLength(0)
        expect(Object.keys(entry.byCategory)).toHaveLength(0)
    })
})
