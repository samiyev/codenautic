import {describe, expect, test} from "bun:test"

import {
    CODE_GRAPH_EDGE_TYPE,
    CODE_GRAPH_NODE_TYPE,
    type CodeGraphEdgeType,
    type CodeGraphNodeMetadataValue,
    type ICodeGraphEdge,
    type ICodeGraphNode,
} from "../../../../../src"

describe("Code graph public exports", () => {
    test("exports CodeGraphNodeMetadataValue from package root for graph metadata typing", () => {
        const metadataValue: CodeGraphNodeMetadataValue = "typescript"
        const node: ICodeGraphNode = {
            id: "file:src/index.ts",
            type: CODE_GRAPH_NODE_TYPE.FILE,
            name: "index.ts",
            filePath: "src/index.ts",
            metadata: {
                language: metadataValue,
                functionCount: 4,
                hasSyntaxErrors: false,
                score: null,
            },
        }

        expect(node.metadata?.language).toBe("typescript")
        expect(node.metadata?.functionCount).toBe(4)
        expect(node.type).toBe(CODE_GRAPH_NODE_TYPE.FILE)
    })

    test("exports HAS_METHOD edge type from package root for enriched graph relations", () => {
        const edgeType: CodeGraphEdgeType = CODE_GRAPH_EDGE_TYPE.HAS_METHOD
        const edge: ICodeGraphEdge = {
            source: "class:src/index.ts:ReviewService:10",
            target: "function:src/index.ts:ReviewService:run:14",
            type: edgeType,
        }

        expect(edge.type).toBe("HAS_METHOD")
    })
})
