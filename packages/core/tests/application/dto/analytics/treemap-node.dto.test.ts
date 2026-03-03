import {describe, expect, test} from "bun:test"

import type {ITreemapNodeDTO} from "../../../../src/application/dto/analytics/treemap-node.dto"
import {TREEMAP_NODE_TYPE} from "../../../../src/application/dto/analytics/treemap-node.dto"

describe("ITreemapNodeDTO", () => {
    test("поддерживает файловый узел с метриками", () => {
        const fileNode: ITreemapNodeDTO = {
            id: "src/index.ts",
            name: "index.ts",
            type: TREEMAP_NODE_TYPE.FILE,
            metrics: {value: 120, extras: {complexity: 8}},
            children: [],
        }

        expect(fileNode.type).toBe(TREEMAP_NODE_TYPE.FILE)
        expect(fileNode.metrics.value).toBe(120)
        expect(fileNode.children).toHaveLength(0)
    })

    test("поддерживает рекурсивную иерархию директорий", () => {
        const directoryNode: ITreemapNodeDTO = {
            id: "src",
            name: "src",
            type: TREEMAP_NODE_TYPE.DIRECTORY,
            metrics: {value: 200},
            children: [
                {
                    id: "src/index.ts",
                    name: "index.ts",
                    type: TREEMAP_NODE_TYPE.FILE,
                    metrics: {value: 80},
                    children: [],
                },
            ],
        }

        expect(directoryNode.children[0]?.id).toBe("src/index.ts")
        expect(directoryNode.children[0]?.type).toBe(TREEMAP_NODE_TYPE.FILE)
        expect(directoryNode.children[0]?.children).toHaveLength(0)
    })
})
