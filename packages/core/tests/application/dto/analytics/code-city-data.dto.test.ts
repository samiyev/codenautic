import {describe, expect, test} from "bun:test"

import {
    TREEMAP_NODE_TYPE,
    type ICodeCityDataDTO,
} from "../../../../src/application/dto/analytics"

describe("ICodeCityDataDTO", () => {
    test("поддерживает полный аггрегированный payload для CodeCity", () => {
        const data: ICodeCityDataDTO = {
            repositoryId: "repo-123",
            rootNode: {
                id: "src",
                name: "src",
                type: TREEMAP_NODE_TYPE.DIRECTORY,
                metrics: {value: 420},
                children: [
                    {
                        id: "src/index.ts",
                        name: "index.ts",
                        type: TREEMAP_NODE_TYPE.FILE,
                        metrics: {value: 120},
                        children: [],
                    },
                ],
            },
            heatmap: [
                {
                    filePath: "src/index.ts",
                    totalIssues: 3,
                    bySeverity: {high: 1, medium: 2},
                    byCategory: {bug: 2, style: 1},
                },
            ],
            hotspots: [
                {
                    filePath: "src/index.ts",
                    score: 12.4,
                },
            ],
            generatedAt: "2026-03-03T12:00:00.000Z",
        }

        expect(data.repositoryId).toBe("repo-123")
        expect(data.rootNode.name).toBe("src")
        expect(data.rootNode.children).toHaveLength(1)
        expect(data.heatmap[0]?.totalIssues).toBe(3)
        expect(data.hotspots[0]?.score).toBe(12.4)
        expect(data.generatedAt).toBe("2026-03-03T12:00:00.000Z")
    })

    test("поддерживает пустые коллекции heatmap и hotspots", () => {
        const data: ICodeCityDataDTO = {
            repositoryId: "repo-empty",
            rootNode: {
                id: "root",
                name: "root",
                type: TREEMAP_NODE_TYPE.DIRECTORY,
                metrics: {value: 0},
                children: [],
            },
            heatmap: [],
            hotspots: [],
            generatedAt: "2026-03-03T13:00:00.000Z",
        }

        expect(data.heatmap).toHaveLength(0)
        expect(data.hotspots).toHaveLength(0)
    })
})
