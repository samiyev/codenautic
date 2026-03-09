import {describe, expect, test} from "bun:test"

import {
    AST_FUNCTION_KIND,
    AST_LANGUAGE,
    CODE_GRAPH_EDGE_TYPE,
    type IParsedSourceFileDTO,
} from "@codenautic/core"

import {
    AST_CODE_GRAPH_ENRICHER_ERROR_CODE,
    AstCodeGraphBuilder,
    AstCodeGraphEnricher,
    AstCodeGraphEnricherError,
} from "../../src/ast"

const FIXED_NOW = new Date("2026-03-10T10:00:00.000Z")

/**
 * Creates parsed source file DTO with deterministic defaults.
 *
 * @param overrides Partial parsed file payload.
 * @returns Parsed source file DTO.
 */
function createParsedSourceFile(
    overrides: Partial<IParsedSourceFileDTO> & Pick<IParsedSourceFileDTO, "filePath">,
): IParsedSourceFileDTO {
    return {
        filePath: overrides.filePath,
        language: overrides.language ?? AST_LANGUAGE.TYPESCRIPT,
        hasSyntaxErrors: overrides.hasSyntaxErrors ?? false,
        imports: overrides.imports ?? [],
        typeAliases: overrides.typeAliases ?? [],
        interfaces: overrides.interfaces ?? [],
        enums: overrides.enums ?? [],
        classes: overrides.classes ?? [],
        functions: overrides.functions ?? [],
        calls: overrides.calls ?? [],
    }
}

/**
 * Asserts typed AST code graph enricher error.
 *
 * @param callback Action expected to throw.
 * @param code Expected typed error code.
 */
function expectAstCodeGraphEnricherError(
    callback: () => unknown,
    code: (typeof AST_CODE_GRAPH_ENRICHER_ERROR_CODE)[keyof typeof AST_CODE_GRAPH_ENRICHER_ERROR_CODE],
): void {
    try {
        callback()
    } catch (error) {
        expect(error).toBeInstanceOf(AstCodeGraphEnricherError)

        if (error instanceof AstCodeGraphEnricherError) {
            expect(error.code).toBe(code)
            return
        }
    }

    throw new Error("Expected AstCodeGraphEnricherError to be thrown")
}

describe("AstCodeGraphEnricher", () => {
    test("enriches graph with import, call, has-method, extends, and implements edges", () => {
        const files = [
            createParsedSourceFile({
                filePath: "src/review/base.ts",
                classes: [
                    {
                        name: "BaseService",
                        exported: true,
                        extendsTypes: [],
                        implementsTypes: [],
                        location: {
                            lineStart: 1,
                            lineEnd: 4,
                            columnStart: 1,
                            columnEnd: 2,
                        },
                    },
                ],
            }),
            createParsedSourceFile({
                filePath: "src/review/contracts.ts",
                interfaces: [
                    {
                        name: "ReviewContract",
                        exported: true,
                        extendsTypes: [],
                        location: {
                            lineStart: 1,
                            lineEnd: 3,
                            columnStart: 1,
                            columnEnd: 2,
                        },
                    },
                ],
            }),
            createParsedSourceFile({
                filePath: "src/review/helpers.ts",
                functions: [
                    {
                        name: "formatReview",
                        kind: AST_FUNCTION_KIND.FUNCTION,
                        exported: true,
                        async: false,
                        location: {
                            lineStart: 1,
                            lineEnd: 3,
                            columnStart: 1,
                            columnEnd: 2,
                        },
                    },
                ],
            }),
            createParsedSourceFile({
                filePath: "src/review/service.ts",
                imports: [
                    {
                        source: "./base",
                        kind: "static",
                        specifiers: ["BaseService"],
                        typeOnly: false,
                        location: {
                            lineStart: 1,
                            lineEnd: 1,
                            columnStart: 1,
                            columnEnd: 36,
                        },
                    },
                    {
                        source: "./contracts",
                        kind: "static",
                        specifiers: ["ReviewContract"],
                        typeOnly: false,
                        location: {
                            lineStart: 2,
                            lineEnd: 2,
                            columnStart: 1,
                            columnEnd: 42,
                        },
                    },
                    {
                        source: "./helpers",
                        kind: "static",
                        specifiers: ["formatReview"],
                        typeOnly: false,
                        location: {
                            lineStart: 3,
                            lineEnd: 3,
                            columnStart: 1,
                            columnEnd: 40,
                        },
                    },
                ],
                classes: [
                    {
                        name: "ReviewService",
                        exported: true,
                        extendsTypes: ["BaseService"],
                        implementsTypes: ["ReviewContract"],
                        location: {
                            lineStart: 5,
                            lineEnd: 14,
                            columnStart: 1,
                            columnEnd: 2,
                        },
                    },
                ],
                functions: [
                    {
                        name: "run",
                        kind: AST_FUNCTION_KIND.METHOD,
                        exported: false,
                        async: false,
                        parentClassName: "ReviewService",
                        location: {
                            lineStart: 6,
                            lineEnd: 9,
                            columnStart: 5,
                            columnEnd: 6,
                        },
                    },
                    {
                        name: "trace",
                        kind: AST_FUNCTION_KIND.METHOD,
                        exported: false,
                        async: false,
                        parentClassName: "ReviewService",
                        location: {
                            lineStart: 11,
                            lineEnd: 13,
                            columnStart: 5,
                            columnEnd: 6,
                        },
                    },
                ],
                calls: [
                    {
                        callee: "formatReview",
                        caller: "run",
                        location: {
                            lineStart: 7,
                            lineEnd: 7,
                            columnStart: 9,
                            columnEnd: 23,
                        },
                    },
                    {
                        callee: "this.trace",
                        caller: "run",
                        location: {
                            lineStart: 8,
                            lineEnd: 8,
                            columnStart: 9,
                            columnEnd: 21,
                        },
                    },
                ],
            }),
        ]
        const builder = new AstCodeGraphBuilder({
            nowProvider: () => FIXED_NOW,
        })
        const enricher = new AstCodeGraphEnricher()

        const built = builder.build({
            repositoryId: "gh:repo-1",
            branch: "main",
            files,
        })
        const result = enricher.enrich({
            graph: built,
            files,
        })

        expect(result.graph.edges).toEqual([
            {
                source: "class:src/review/service.ts:ReviewService:5",
                target: "class:src/review/base.ts:BaseService:1",
                type: CODE_GRAPH_EDGE_TYPE.EXTENDS,
            },
            {
                source: "class:src/review/service.ts:ReviewService:5",
                target: "function:src/review/service.ts:ReviewService:run:6",
                type: CODE_GRAPH_EDGE_TYPE.HAS_METHOD,
            },
            {
                source: "class:src/review/service.ts:ReviewService:5",
                target: "function:src/review/service.ts:ReviewService:trace:11",
                type: CODE_GRAPH_EDGE_TYPE.HAS_METHOD,
            },
            {
                source: "class:src/review/service.ts:ReviewService:5",
                target: "type:src/review/contracts.ts:interface:ReviewContract:1",
                type: CODE_GRAPH_EDGE_TYPE.IMPLEMENTS,
            },
            {
                source: "file:src/review/service.ts",
                target: "file:src/review/base.ts",
                type: CODE_GRAPH_EDGE_TYPE.IMPORTS,
            },
            {
                source: "file:src/review/service.ts",
                target: "file:src/review/contracts.ts",
                type: CODE_GRAPH_EDGE_TYPE.IMPORTS,
            },
            {
                source: "file:src/review/service.ts",
                target: "file:src/review/helpers.ts",
                type: CODE_GRAPH_EDGE_TYPE.IMPORTS,
            },
            {
                source: "function:src/review/service.ts:ReviewService:run:6",
                target: "function:src/review/helpers.ts:global:formatReview:1",
                type: CODE_GRAPH_EDGE_TYPE.CALLS,
            },
            {
                source: "function:src/review/service.ts:ReviewService:run:6",
                target: "function:src/review/service.ts:ReviewService:trace:11",
                type: CODE_GRAPH_EDGE_TYPE.CALLS,
            },
        ])
        expect(result.edgesByType.get(CODE_GRAPH_EDGE_TYPE.HAS_METHOD)?.map((edge) => edge.target)).toEqual([
            "function:src/review/service.ts:ReviewService:run:6",
            "function:src/review/service.ts:ReviewService:trace:11",
        ])
        expect(result.outgoingEdges.get("class:src/review/service.ts:ReviewService:5")?.map((edge) => edge.type)).toEqual([
            CODE_GRAPH_EDGE_TYPE.EXTENDS,
            CODE_GRAPH_EDGE_TYPE.HAS_METHOD,
            CODE_GRAPH_EDGE_TYPE.HAS_METHOD,
            CODE_GRAPH_EDGE_TYPE.IMPLEMENTS,
        ])
        expect(result.incomingEdges.get("function:src/review/service.ts:ReviewService:trace:11")?.map((edge) => edge.type)).toEqual([
            CODE_GRAPH_EDGE_TYPE.HAS_METHOD,
            CODE_GRAPH_EDGE_TYPE.CALLS,
        ])
    })

    test("throws typed error when parsed files do not have matching file nodes in graph", () => {
        const builder = new AstCodeGraphBuilder()
        const enricher = new AstCodeGraphEnricher()
        const built = builder.build({
            repositoryId: "gh:repo-1",
            branch: "main",
            files: [
                createParsedSourceFile({
                    filePath: "src/review/base.ts",
                }),
            ],
        })

        expectAstCodeGraphEnricherError(
            () =>
                enricher.enrich({
                    graph: built,
                    files: [
                        createParsedSourceFile({
                            filePath: "src/review/other.ts",
                        }),
                    ],
                }),
            AST_CODE_GRAPH_ENRICHER_ERROR_CODE.FILE_NODE_NOT_FOUND,
        )
        expect(() =>
            enricher.enrich({
                graph: built,
                files: [
                    createParsedSourceFile({
                        filePath: "src/review/other.ts",
                    }),
                ],
            }),
        ).toThrow(
            "Missing file node for AST code graph enrichment: src/review/other.ts",
        )
    })
})
