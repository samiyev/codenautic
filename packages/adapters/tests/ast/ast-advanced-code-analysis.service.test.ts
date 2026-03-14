import {describe, expect, test} from "bun:test"

import {
    CODE_GRAPH_EDGE_TYPE,
    CODE_GRAPH_NODE_TYPE,
    type ICodeGraph,
    type ICodeGraphEdge,
    type ICodeGraphNode,
} from "@codenautic/core"

import {
    AST_ADVANCED_CODE_ANALYSIS_ERROR_CODE,
    AST_ADVANCED_CODE_PATTERN_TYPE,
    AstAdvancedCodeAnalysisError,
    AstAdvancedCodeAnalysisService,
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
    type: ICodeGraphEdge["type"],
): ICodeGraphEdge {
    return {
        source,
        target,
        type,
    }
}

/**
 * Creates reusable graph fixture for advanced-pattern detection.
 *
 * @returns Graph snapshot.
 */
function createAdvancedAnalysisGraph(): ICodeGraph {
    return {
        id: "gh:repo-advanced@main",
        nodes: [
            createGraphNode("file:src/a.ts", CODE_GRAPH_NODE_TYPE.FILE, "src/a.ts"),
            createGraphNode("file:src/b.ts", CODE_GRAPH_NODE_TYPE.FILE, "src/b.ts"),
            createGraphNode("file:src/c.ts", CODE_GRAPH_NODE_TYPE.FILE, "src/c.ts"),
            createGraphNode("file:src/d.ts", CODE_GRAPH_NODE_TYPE.FILE, "src/d.ts"),
            createGraphNode("file:src/e.ts", CODE_GRAPH_NODE_TYPE.FILE, "src/e.ts"),
            createGraphNode("file:src/mixed.ts", CODE_GRAPH_NODE_TYPE.FILE, "src/mixed.ts"),
            createGraphNode(
                "class:src/mixed.ts:MixedService",
                CODE_GRAPH_NODE_TYPE.CLASS,
                "src/mixed.ts",
            ),
            createGraphNode(
                "function:src/mixed.ts:run",
                CODE_GRAPH_NODE_TYPE.FUNCTION,
                "src/mixed.ts",
            ),
            createGraphNode(
                "type:src/mixed.ts:MixedPayload",
                CODE_GRAPH_NODE_TYPE.TYPE,
                "src/mixed.ts",
            ),
        ],
        edges: [
            createGraphEdge("file:src/a.ts", "file:src/b.ts", CODE_GRAPH_EDGE_TYPE.IMPORTS),
            createGraphEdge("file:src/b.ts", "file:src/c.ts", CODE_GRAPH_EDGE_TYPE.IMPORTS),
            createGraphEdge("file:src/c.ts", "file:src/a.ts", CODE_GRAPH_EDGE_TYPE.IMPORTS),
            createGraphEdge("file:src/d.ts", "file:src/a.ts", CODE_GRAPH_EDGE_TYPE.IMPORTS),
            createGraphEdge("file:src/d.ts", "file:src/b.ts", CODE_GRAPH_EDGE_TYPE.IMPORTS),
            createGraphEdge("file:src/d.ts", "file:src/c.ts", CODE_GRAPH_EDGE_TYPE.IMPORTS),
            createGraphEdge("file:src/e.ts", "file:src/a.ts", CODE_GRAPH_EDGE_TYPE.IMPORTS),
            createGraphEdge(
                "class:src/mixed.ts:MixedService",
                "function:src/mixed.ts:run",
                CODE_GRAPH_EDGE_TYPE.HAS_METHOD,
            ),
        ],
    }
}

/**
 * Asserts typed advanced-analysis error shape.
 *
 * @param callback Action expected to throw.
 * @param code Expected typed error code.
 */
function expectAstAdvancedCodeAnalysisError(
    callback: () => unknown,
    code:
        (typeof AST_ADVANCED_CODE_ANALYSIS_ERROR_CODE)[keyof typeof AST_ADVANCED_CODE_ANALYSIS_ERROR_CODE],
): void {
    try {
        callback()
    } catch (error) {
        expect(error).toBeInstanceOf(AstAdvancedCodeAnalysisError)

        if (error instanceof AstAdvancedCodeAnalysisError) {
            expect(error.code).toBe(code)
            return
        }
    }

    throw new Error("Expected AstAdvancedCodeAnalysisError to be thrown")
}

describe("AstAdvancedCodeAnalysisService", () => {
    test("detects complex structural patterns deterministically", async () => {
        const service = new AstAdvancedCodeAnalysisService()
        const result = await service.analyze(createAdvancedAnalysisGraph())

        expect(result.summary.totalPatterns).toBe(4)
        expect(result.summary.byType).toEqual({
            CIRCULAR_DEPENDENCY: 1,
            HIGH_FAN_IN: 1,
            HIGH_FAN_OUT: 1,
            MIXED_ABSTRACTION: 1,
        })

        const cyclePattern = result.patterns.find(
            (pattern) => pattern.type === AST_ADVANCED_CODE_PATTERN_TYPE.CIRCULAR_DEPENDENCY,
        )
        const highFanInPattern = result.patterns.find(
            (pattern) => pattern.type === AST_ADVANCED_CODE_PATTERN_TYPE.HIGH_FAN_IN,
        )
        const highFanOutPattern = result.patterns.find(
            (pattern) => pattern.type === AST_ADVANCED_CODE_PATTERN_TYPE.HIGH_FAN_OUT,
        )
        const mixedAbstractionPattern = result.patterns.find(
            (pattern) => pattern.type === AST_ADVANCED_CODE_PATTERN_TYPE.MIXED_ABSTRACTION,
        )

        expect(cyclePattern?.filePaths).toEqual([
            "src/a.ts",
            "src/b.ts",
            "src/c.ts",
        ])
        expect(highFanInPattern?.filePaths).toEqual(["src/a.ts"])
        expect(highFanOutPattern?.filePaths).toEqual(["src/d.ts"])
        expect(mixedAbstractionPattern?.filePaths).toEqual(["src/mixed.ts"])
    })

    test("respects file-path filter and excludes non-matching patterns", async () => {
        const service = new AstAdvancedCodeAnalysisService()
        const result = await service.analyze(createAdvancedAnalysisGraph(), {
            filePaths: [
                "src/a.ts",
                "src/b.ts",
                "src/c.ts",
            ],
        })

        expect(result.patterns).toHaveLength(1)
        expect(result.patterns[0]?.type).toBe(AST_ADVANCED_CODE_PATTERN_TYPE.CIRCULAR_DEPENDENCY)
        expect(result.summary.byType).toEqual({
            CIRCULAR_DEPENDENCY: 1,
            HIGH_FAN_IN: 0,
            HIGH_FAN_OUT: 0,
            MIXED_ABSTRACTION: 0,
        })
    })

    test("limits patterns per type and keeps highest-score candidates", async () => {
        const service = new AstAdvancedCodeAnalysisService()
        const result = await service.analyze(createAdvancedAnalysisGraph(), {
            minimumHubFanIn: 1,
            minimumHubFanOut: 1,
            maxPatternsPerType: 1,
        })

        const highFanInPatterns = result.patterns.filter(
            (pattern) => pattern.type === AST_ADVANCED_CODE_PATTERN_TYPE.HIGH_FAN_IN,
        )
        const highFanOutPatterns = result.patterns.filter(
            (pattern) => pattern.type === AST_ADVANCED_CODE_PATTERN_TYPE.HIGH_FAN_OUT,
        )

        expect(highFanInPatterns).toHaveLength(1)
        expect(highFanOutPatterns).toHaveLength(1)
        expect(highFanInPatterns[0]?.filePaths).toEqual(["src/a.ts"])
        expect(highFanOutPatterns[0]?.filePaths).toEqual(["src/d.ts"])
    })

    test("returns identical output for repeated calls with identical input", async () => {
        const service = new AstAdvancedCodeAnalysisService()
        const graph = createAdvancedAnalysisGraph()
        const options = {
            minimumHubFanIn: 2,
            minimumHubFanOut: 2,
        }

        const first = await service.analyze(graph, options)
        const second = await service.analyze(graph, options)

        expect(second).toEqual(first)
    })

    test("throws typed error for invalid constructor defaults", () => {
        expectAstAdvancedCodeAnalysisError(
            () => {
                void new AstAdvancedCodeAnalysisService({
                    defaultMinimumCycleSize: 1,
                })
            },
            AST_ADVANCED_CODE_ANALYSIS_ERROR_CODE.INVALID_MINIMUM_CYCLE_SIZE,
        )
    })

    test("throws typed error for invalid runtime fan-out threshold", () => {
        const service = new AstAdvancedCodeAnalysisService()

        expectAstAdvancedCodeAnalysisError(
            () => {
                void service.analyze(createAdvancedAnalysisGraph(), {
                    minimumHubFanOut: 0,
                })
            },
            AST_ADVANCED_CODE_ANALYSIS_ERROR_CODE.INVALID_MINIMUM_HUB_FAN_OUT,
        )
    })

    test("throws typed error for invalid file path filter", () => {
        const service = new AstAdvancedCodeAnalysisService()

        expectAstAdvancedCodeAnalysisError(
            () => {
                void service.analyze(createAdvancedAnalysisGraph(), {
                    filePaths: [" "],
                })
            },
            AST_ADVANCED_CODE_ANALYSIS_ERROR_CODE.INVALID_FILE_PATH,
        )
    })

    test("throws typed error for empty file path filter", () => {
        const service = new AstAdvancedCodeAnalysisService()

        expectAstAdvancedCodeAnalysisError(
            () => {
                void service.analyze(createAdvancedAnalysisGraph(), {
                    filePaths: [],
                })
            },
            AST_ADVANCED_CODE_ANALYSIS_ERROR_CODE.EMPTY_FILE_PATHS,
        )
    })
})
