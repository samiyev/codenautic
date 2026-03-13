import {describe, expect, test} from "bun:test"

import {
    CODE_GRAPH_EDGE_TYPE,
    CODE_GRAPH_NODE_TYPE,
    type CodeGraphEdgeType,
    type ICodeGraph,
    type ICodeGraphEdge,
    type ICodeGraphNode,
} from "@codenautic/core"

import {
    AST_CODE_GRAPH_IMPACT_ANALYSIS_DIRECTION,
    AST_CODE_GRAPH_IMPACT_ANALYSIS_ERROR_CODE,
    AstCodeGraphImpactAnalysisError,
    AstCodeGraphImpactAnalysisService,
    type AstCodeGraphImpactAnalysisDirection,
} from "../../src/ast"

/**
 * Creates deterministic graph node fixture.
 *
 * @param id Stable graph node identifier.
 * @param type Graph node type.
 * @param filePath Repository-relative file path.
 * @returns Graph node fixture.
 */
function createGraphNode(
    id: string,
    type: ICodeGraphNode["type"],
    filePath: string,
): ICodeGraphNode {
    const name = id.split(":").at(-1) ?? id

    return {
        id,
        type,
        name,
        filePath,
        metadata: {},
    }
}

/**
 * Creates deterministic graph edge fixture.
 *
 * @param source Edge source identifier.
 * @param target Edge target identifier.
 * @param type Edge semantic type.
 * @returns Graph edge fixture.
 */
function createGraphEdge(
    source: string,
    target: string,
    type: CodeGraphEdgeType,
): ICodeGraphEdge {
    return {
        source,
        target,
        type,
    }
}

/**
 * Creates graph fixture from nodes and edges.
 *
 * @param nodes Graph nodes.
 * @param edges Graph edges.
 * @returns Graph fixture.
 */
function createGraph(
    nodes: readonly ICodeGraphNode[],
    edges: readonly ICodeGraphEdge[],
): ICodeGraph {
    return {
        id: "gh:repo-1@main",
        nodes,
        edges,
    }
}

/**
 * Creates reusable impact graph with file and symbol relations.
 *
 * @returns Graph fixture for traversal scenarios.
 */
function createImpactGraph(): ICodeGraph {
    return createGraph(
        [
            createGraphNode("file:src/index.ts", CODE_GRAPH_NODE_TYPE.FILE, "src/index.ts"),
            createGraphNode("file:src/utils.ts", CODE_GRAPH_NODE_TYPE.FILE, "src/utils.ts"),
            createGraphNode("file:src/core.ts", CODE_GRAPH_NODE_TYPE.FILE, "src/core.ts"),
            createGraphNode(
                "class:src/index.ts:ReviewService",
                CODE_GRAPH_NODE_TYPE.CLASS,
                "src/index.ts",
            ),
            createGraphNode(
                "class:src/utils.ts:Formatter",
                CODE_GRAPH_NODE_TYPE.CLASS,
                "src/utils.ts",
            ),
            createGraphNode(
                "function:src/index.ts:run",
                CODE_GRAPH_NODE_TYPE.FUNCTION,
                "src/index.ts",
            ),
            createGraphNode(
                "function:src/utils.ts:format",
                CODE_GRAPH_NODE_TYPE.FUNCTION,
                "src/utils.ts",
            ),
        ],
        [
            createGraphEdge("file:src/index.ts", "file:src/utils.ts", CODE_GRAPH_EDGE_TYPE.IMPORTS),
            createGraphEdge("file:src/utils.ts", "file:src/core.ts", CODE_GRAPH_EDGE_TYPE.IMPORTS),
            createGraphEdge(
                "class:src/index.ts:ReviewService",
                "function:src/index.ts:run",
                CODE_GRAPH_EDGE_TYPE.HAS_METHOD,
            ),
            createGraphEdge(
                "class:src/utils.ts:Formatter",
                "function:src/utils.ts:format",
                CODE_GRAPH_EDGE_TYPE.HAS_METHOD,
            ),
            createGraphEdge(
                "function:src/index.ts:run",
                "function:src/utils.ts:format",
                CODE_GRAPH_EDGE_TYPE.CALLS,
            ),
        ],
    )
}

/**
 * Asserts typed impact analysis error shape.
 *
 * @param callback Action expected to throw.
 * @param code Expected typed error code.
 */
function expectAstCodeGraphImpactAnalysisError(
    callback: () => unknown,
    code: (typeof AST_CODE_GRAPH_IMPACT_ANALYSIS_ERROR_CODE)[keyof typeof AST_CODE_GRAPH_IMPACT_ANALYSIS_ERROR_CODE],
): void {
    try {
        callback()
    } catch (error) {
        expect(error).toBeInstanceOf(AstCodeGraphImpactAnalysisError)

        if (error instanceof AstCodeGraphImpactAnalysisError) {
            expect(error.code).toBe(code)
            return
        }
    }

    throw new Error("Expected AstCodeGraphImpactAnalysisError to be thrown")
}

describe("AstCodeGraphImpactAnalysisService", () => {
    test("uses backward traversal by default and returns dependents within default depth", async () => {
        const service = new AstCodeGraphImpactAnalysisService()

        const impact = await service.analyzeImpact({
            graph: createImpactGraph(),
            changedFilePaths: ["src/utils.ts"],
        })

        expect(impact.changedNodes.map((node) => node.id)).toEqual([
            "class:src/utils.ts:Formatter",
            "file:src/utils.ts",
            "function:src/utils.ts:format",
        ])
        expect(impact.affectedNodes.map((node) => node.id)).toEqual([
            "class:src/index.ts:ReviewService",
            "class:src/utils.ts:Formatter",
            "file:src/index.ts",
            "file:src/utils.ts",
            "function:src/index.ts:run",
            "function:src/utils.ts:format",
        ])
        expect(impact.impactRadius).toBe(2)
        expect(impact.breakingChanges).toHaveLength(0)
    })

    test("supports forward traversal with explicit depth cutoff", async () => {
        const service = new AstCodeGraphImpactAnalysisService()

        const impact = await service.analyzeImpact({
            graph: createImpactGraph(),
            changedFilePaths: ["src/utils.ts"],
            direction: AST_CODE_GRAPH_IMPACT_ANALYSIS_DIRECTION.FORWARD,
            depth: 1,
        })

        expect(impact.affectedNodes.map((node) => node.id)).toEqual([
            "class:src/utils.ts:Formatter",
            "file:src/core.ts",
            "file:src/utils.ts",
            "function:src/utils.ts:format",
        ])
        expect(impact.impactRadius).toBe(1)
    })

    test("supports bidirectional traversal across dependencies and dependents", async () => {
        const service = new AstCodeGraphImpactAnalysisService()

        const impact = await service.analyzeImpact({
            graph: createImpactGraph(),
            changedFilePaths: ["src/utils.ts"],
            direction: AST_CODE_GRAPH_IMPACT_ANALYSIS_DIRECTION.BOTH,
            depth: 2,
        })

        expect(impact.affectedNodes.map((node) => node.id)).toEqual([
            "class:src/index.ts:ReviewService",
            "class:src/utils.ts:Formatter",
            "file:src/core.ts",
            "file:src/index.ts",
            "file:src/utils.ts",
            "function:src/index.ts:run",
            "function:src/utils.ts:format",
        ])
        expect(impact.impactRadius).toBe(2)
    })

    test("returns only changed nodes when depth is zero", async () => {
        const service = new AstCodeGraphImpactAnalysisService()

        const impact = await service.analyzeImpact({
            graph: createImpactGraph(),
            changedFilePaths: ["src/utils.ts"],
            depth: 0,
        })

        expect(impact.affectedNodes.map((node) => node.id)).toEqual([
            "class:src/utils.ts:Formatter",
            "file:src/utils.ts",
            "function:src/utils.ts:format",
        ])
        expect(impact.impactRadius).toBe(0)
    })

    test("creates synthetic breaking change when changed file is absent from graph", async () => {
        const service = new AstCodeGraphImpactAnalysisService()

        const impact = await service.analyzeImpact({
            graph: createImpactGraph(),
            changedFilePaths: ["src/missing.ts"],
        })

        expect(impact.changedNodes.map((node) => node.id)).toEqual(["file:src/missing.ts"])
        expect(impact.affectedNodes.map((node) => node.id)).toEqual(["file:src/missing.ts"])
        expect(impact.breakingChanges).toEqual([
            {
                node: {
                    id: "file:src/missing.ts",
                    type: CODE_GRAPH_NODE_TYPE.FILE,
                    name: "src/missing.ts",
                    filePath: "src/missing.ts",
                },
                reason: "CHANGED_FILE_NOT_IN_GRAPH",
            },
        ])
    })

    test("throws typed error for invalid depth", () => {
        const service = new AstCodeGraphImpactAnalysisService()

        expectAstCodeGraphImpactAnalysisError(
            () => {
                void service.analyzeImpact({
                    graph: createImpactGraph(),
                    changedFilePaths: ["src/utils.ts"],
                    depth: -1,
                })
            },
            AST_CODE_GRAPH_IMPACT_ANALYSIS_ERROR_CODE.INVALID_DEPTH,
        )
    })

    test("throws typed error for invalid traversal direction", () => {
        const service = new AstCodeGraphImpactAnalysisService()

        expectAstCodeGraphImpactAnalysisError(
            () => {
                void service.analyzeImpact({
                    graph: createImpactGraph(),
                    changedFilePaths: ["src/utils.ts"],
                    direction: "sideways" as unknown as AstCodeGraphImpactAnalysisDirection,
                })
            },
            AST_CODE_GRAPH_IMPACT_ANALYSIS_ERROR_CODE.INVALID_DIRECTION,
        )
    })

    test("throws typed error for invalid changed file path", () => {
        const service = new AstCodeGraphImpactAnalysisService()

        expectAstCodeGraphImpactAnalysisError(
            () => {
                void service.analyzeImpact({
                    graph: createImpactGraph(),
                    changedFilePaths: ["   "],
                })
            },
            AST_CODE_GRAPH_IMPACT_ANALYSIS_ERROR_CODE.INVALID_FILE_PATH,
        )
    })

    test("throws typed error for empty changed file path set", () => {
        const service = new AstCodeGraphImpactAnalysisService()

        expectAstCodeGraphImpactAnalysisError(
            () => {
                void service.analyzeImpact({
                    graph: createImpactGraph(),
                    changedFilePaths: [],
                })
            },
            AST_CODE_GRAPH_IMPACT_ANALYSIS_ERROR_CODE.EMPTY_CHANGED_FILE_PATHS,
        )
    })
})
