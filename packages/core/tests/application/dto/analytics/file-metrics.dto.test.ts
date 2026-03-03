import {describe, expect, test} from "bun:test"

import type {IFileMetricsDTO} from "../../../../src/application/dto/analytics/file-metrics.dto"

describe("IFileMetricsDTO", () => {
    test("поддерживает обязательные поля метрик файла", () => {
        const fileMetrics: IFileMetricsDTO = {
            filePath: "src/core.ts",
            loc: 120,
            complexity: 8,
            churn: 3,
            issueCount: 2,
        }

        expect(fileMetrics.filePath).toBe("src/core.ts")
        expect(fileMetrics.loc).toBe(120)
        expect(fileMetrics.complexity).toBe(8)
        expect(fileMetrics.churn).toBe(3)
        expect(fileMetrics.issueCount).toBe(2)
    })

    test("поддерживает опциональные поля покрытия и даты последнего ревью", () => {
        const fileMetrics: IFileMetricsDTO = {
            filePath: "src/utils/helper.ts",
            loc: 80,
            complexity: 5,
            coverage: 92.5,
            churn: 1,
            issueCount: 0,
            lastReviewDate: "2026-03-03T09:00:00.000Z",
        }

        expect(fileMetrics.coverage).toBe(92.5)
        expect(fileMetrics.lastReviewDate).toBe("2026-03-03T09:00:00.000Z")
    })
})
