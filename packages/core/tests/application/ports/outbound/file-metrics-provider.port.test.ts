import {describe, expect, test} from "bun:test"

import type {IFileMetricsDTO} from "../../../../src"
import type {IFileMetricsProvider} from "../../../../src/application/ports/outbound/analysis/file-metrics-provider"

class InMemoryFileMetricsProvider implements IFileMetricsProvider {
    public getMetrics(
        _repositoryId: string,
        filePaths: readonly string[],
    ): Promise<readonly IFileMetricsDTO[]> {
        return Promise.resolve(
            filePaths.map((filePath): IFileMetricsDTO => {
                return {
                    filePath,
                    loc: 120,
                    complexity: 8,
                    churn: 3,
                    issueCount: 0,
                    coverage: 88,
                }
            }),
        )
    }
}

describe("IFileMetricsProvider contract", () => {
    test("returns metrics for requested files", async () => {
        const provider = new InMemoryFileMetricsProvider()
        const metrics = await provider.getMetrics("repo-1", ["src/index.ts", "src/utils.ts"])

        expect(metrics).toHaveLength(2)
        expect(metrics[0]?.filePath).toBe("src/index.ts")
        expect(metrics[1]?.filePath).toBe("src/utils.ts")
        expect(metrics[0]?.loc).toBe(120)
        expect(metrics[0]?.complexity).toBe(8)
        expect(metrics[0]?.issueCount).toBe(0)
    })

    test("supports empty file list", async () => {
        const provider = new InMemoryFileMetricsProvider()
        const metrics = await provider.getMetrics("repo-1", [])

        expect(metrics).toHaveLength(0)
    })
})
