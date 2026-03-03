import {describe, expect, test} from "bun:test"

import type {IIssueHeatmapEntryDTO} from "../../../../src/application/dto/analytics/issue-heatmap-entry.dto"
import type {IIssueAggregationProvider} from "../../../../src/application/ports/outbound/review/issue-aggregation-provider"

class InMemoryIssueAggregationProvider implements IIssueAggregationProvider {
    public aggregateByFile(_repositoryId: string): Promise<readonly IIssueHeatmapEntryDTO[]> {
        return Promise.resolve([
            {
                filePath: "src/index.ts",
                totalIssues: 2,
                bySeverity: {high: 1, medium: 1},
                byCategory: {bug: 1, style: 1},
            },
            {
                filePath: "src/utils.ts",
                totalIssues: 0,
                bySeverity: {} as Record<string, number>,
                byCategory: {} as Record<string, number>,
            },
        ])
    }
}

describe("IIssueAggregationProvider contract", () => {
    test("returns issue heatmap entries by file", async () => {
        const provider = new InMemoryIssueAggregationProvider()
        const heatmap = await provider.aggregateByFile("repo-1")

        expect(heatmap).toHaveLength(2)
        expect(heatmap[0]?.filePath).toBe("src/index.ts")
        expect(heatmap[0]?.totalIssues).toBe(2)
        expect(heatmap[1]?.totalIssues).toBe(0)
        expect(heatmap[1]?.bySeverity).toEqual({})
    })

    test("returns empty collection for repository without issues", async () => {
        class EmptyIssueAggregationProvider implements IIssueAggregationProvider {
            public aggregateByFile(_repositoryId: string): Promise<readonly IIssueHeatmapEntryDTO[]> {
                return Promise.resolve([])
            }
        }

        const provider = new EmptyIssueAggregationProvider()
        const heatmap = await provider.aggregateByFile("repo-empty")

        expect(heatmap).toHaveLength(0)
    })
})
