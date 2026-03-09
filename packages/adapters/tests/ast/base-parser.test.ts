import {describe, expect, test} from "bun:test"

import Parser from "tree-sitter"
import JavaScript from "tree-sitter-javascript"
import TypeScript from "tree-sitter-typescript"

import {
    AST_FUNCTION_KIND,
    AST_IMPORT_KIND,
    AST_LANGUAGE,
    type ISourceCodeParseRequest,
} from "@codenautic/core"
import {AST_PARSER_ERROR_CODE, AstParserError, BaseParser} from "../../src/ast"

class TypeScriptTestParser extends BaseParser {
    public constructor() {
        const parser = new Parser()
        parser.setLanguage(TypeScript.typescript as unknown as Parser.Language)
        super({language: AST_LANGUAGE.TYPESCRIPT, parser})
    }
}

class JavaScriptTestParser extends BaseParser {
    public constructor() {
        const parser = new Parser()
        parser.setLanguage(JavaScript as unknown as Parser.Language)
        super({language: AST_LANGUAGE.JAVASCRIPT, parser})
    }
}

class TrackingTypeScriptParser extends TypeScriptTestParser {
    private readonly visitedNodeTypesValue: string[]

    public constructor() {
        super()
        this.visitedNodeTypesValue = []
    }

    public get visitedNodeTypes(): readonly string[] {
        return this.visitedNodeTypesValue
    }

    protected override onNodeVisited(node: Parser.SyntaxNode): void {
        this.visitedNodeTypesValue.push(node.type)
    }
}

class FailingTypeScriptParser extends BaseParser {
    public constructor() {
        const parser = {
            parse(): never {
                throw new Error("synthetic parse failure")
            },
        } as unknown as Parser

        super({language: AST_LANGUAGE.TYPESCRIPT, parser})
    }
}

/**
 * Counts named nodes recursively for one syntax subtree.
 *
 * @param node Root syntax node.
 * @returns Named node count including root.
 */
function countNamedNodes(node: Parser.SyntaxNode): number {
    let total = 1

    for (const child of node.namedChildren) {
        total += countNamedNodes(child)
    }

    return total
}

describe("BaseParser", () => {
    test("collects imports, types, classes, functions, and calls in one traversal", async () => {
        const parser = new TrackingTypeScriptParser()
        const request: ISourceCodeParseRequest = {
            filePath: "src/review/parser.ts",
            content: [
                'import Foo, {type Bar as LocalBar, baz} from "./deps"',
                'export {shared as sharedAlias} from "./shared"',
                'export type UserId = string',
                'interface Service extends BaseService, Disposable {}',
                'enum Mode { FAST, FULL = 2 }',
                'export class ReviewParser extends BaseParser<string> implements Disposable, Runnable {',
                '    public parseFile(): void {',
                '        helper()',
                '        this.trace()',
                '    }',
                '}',
                'export const boot = async () => createApp()',
            ].join("\n"),
        }

        const treeSitterParser = new Parser()
        treeSitterParser.setLanguage(TypeScript.typescript as unknown as Parser.Language)
        const expectedNodeCount = countNamedNodes(treeSitterParser.parse(request.content).rootNode)

        const result = await parser.parse(request)

        expect(parser.visitedNodeTypes).toHaveLength(expectedNodeCount)
        expect(result.filePath).toBe("src/review/parser.ts")
        expect(result.language).toBe(AST_LANGUAGE.TYPESCRIPT)
        expect(result.hasSyntaxErrors).toBe(false)
        expect(result.imports).toEqual([
            {
                source: "./deps",
                kind: AST_IMPORT_KIND.STATIC,
                specifiers: ["Foo", "LocalBar", "baz"],
                typeOnly: false,
                location: {
                    lineStart: 1,
                    lineEnd: 1,
                    columnStart: 1,
                    columnEnd: 54,
                },
            },
            {
                source: "./shared",
                kind: AST_IMPORT_KIND.EXPORT_FROM,
                specifiers: ["sharedAlias"],
                typeOnly: false,
                location: {
                    lineStart: 2,
                    lineEnd: 2,
                    columnStart: 1,
                    columnEnd: 47,
                },
            },
        ])
        expect(result.typeAliases[0]?.name).toBe("UserId")
        expect(result.interfaces[0]).toEqual({
            name: "Service",
            exported: false,
            extendsTypes: ["BaseService", "Disposable"],
            location: {
                lineStart: 4,
                lineEnd: 4,
                columnStart: 1,
                columnEnd: 53,
            },
        })
        expect(result.enums[0]?.members).toEqual(["FAST", "FULL"])
        expect(result.classes[0]).toEqual({
            name: "ReviewParser",
            exported: true,
            extendsTypes: ["BaseParser<string>"],
            implementsTypes: ["Disposable", "Runnable"],
            location: {
                lineStart: 6,
                lineEnd: 11,
                columnStart: 8,
                columnEnd: 2,
            },
        })
        expect(result.functions).toEqual([
            {
                name: "parseFile",
                kind: AST_FUNCTION_KIND.METHOD,
                exported: false,
                async: false,
                parentClassName: "ReviewParser",
                location: {
                    lineStart: 7,
                    lineEnd: 10,
                    columnStart: 5,
                    columnEnd: 6,
                },
            },
            {
                name: "boot",
                kind: AST_FUNCTION_KIND.FUNCTION,
                exported: true,
                async: true,
                location: {
                    lineStart: 12,
                    lineEnd: 12,
                    columnStart: 21,
                    columnEnd: 44,
                },
            },
        ])
        expect(result.calls).toEqual([
            {
                callee: "helper",
                caller: "parseFile",
                location: {
                    lineStart: 8,
                    lineEnd: 8,
                    columnStart: 9,
                    columnEnd: 17,
                },
            },
            {
                callee: "this.trace",
                caller: "parseFile",
                location: {
                    lineStart: 9,
                    lineEnd: 9,
                    columnStart: 9,
                    columnEnd: 21,
                },
            },
            {
                callee: "createApp",
                caller: "boot",
                location: {
                    lineStart: 12,
                    lineEnd: 12,
                    columnStart: 33,
                    columnEnd: 44,
                },
            },
        ])
    })

    test("normalizes require and dynamic imports for javascript source", async () => {
        const parser = new JavaScriptTestParser()
        const result = await parser.parse({
            filePath: "src/runtime/index.js",
            content: [
                'const sdk = require("sdk")',
                'async function load(){',
                '    await import("./feature.js")',
                '    return api.send()',
                '}',
            ].join("\n"),
        })

        expect(result.language).toBe(AST_LANGUAGE.JAVASCRIPT)
        expect(result.imports).toEqual([
            {
                source: "sdk",
                kind: AST_IMPORT_KIND.REQUIRE,
                specifiers: [],
                typeOnly: false,
                location: {
                    lineStart: 1,
                    lineEnd: 1,
                    columnStart: 13,
                    columnEnd: 27,
                },
            },
            {
                source: "./feature.js",
                kind: AST_IMPORT_KIND.DYNAMIC,
                specifiers: [],
                typeOnly: false,
                location: {
                    lineStart: 3,
                    lineEnd: 3,
                    columnStart: 11,
                    columnEnd: 33,
                },
            },
        ])
        expect(result.functions[0]?.name).toBe("load")
        expect(result.calls).toEqual([
            {
                callee: "api.send",
                caller: "load",
                location: {
                    lineStart: 4,
                    lineEnd: 4,
                    columnStart: 12,
                    columnEnd: 22,
                },
            },
        ])
    })

    test("throws typed error for blank file path", () => {
        const parser = new TypeScriptTestParser()

        return expect(
            parser.parse({
                filePath: "   ",
                content: "export const value = 1",
            }),
        ).rejects.toMatchObject({
            name: "AstParserError",
            code: AST_PARSER_ERROR_CODE.INVALID_FILE_PATH,
        } satisfies Partial<AstParserError>)
    })

    test("throws typed parse-failed error when tree-sitter parser crashes", () => {
        const parser = new FailingTypeScriptParser()

        return expect(
            parser.parse({
                filePath: "src/broken.ts",
                content: "export const value = 1",
            }),
        ).rejects.toMatchObject({
            name: "AstParserError",
            message: "synthetic parse failure",
            code: AST_PARSER_ERROR_CODE.PARSE_FAILED,
            filePath: "src/broken.ts",
        } satisfies Partial<AstParserError>)
    })
})
