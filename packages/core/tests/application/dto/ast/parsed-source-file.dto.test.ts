import {describe, expect, test} from "bun:test"

import {
    AST_FUNCTION_KIND,
    AST_IMPORT_KIND,
    AST_LANGUAGE,
    type IParsedSourceFileDTO,
} from "../../../../src/application/dto/ast"

describe("IParsedSourceFileDTO", () => {
    test("supports rich parsed source-file payload", () => {
        const parsedFile: IParsedSourceFileDTO = {
            filePath: "src/review/parser.ts",
            language: AST_LANGUAGE.TYPESCRIPT,
            hasSyntaxErrors: false,
            imports: [
                {
                    source: "./shared",
                    kind: AST_IMPORT_KIND.STATIC,
                    specifiers: ["collectNodes"],
                    typeOnly: false,
                    location: {
                        lineStart: 1,
                        lineEnd: 1,
                        columnStart: 1,
                        columnEnd: 33,
                    },
                },
            ],
            typeAliases: [
                {
                    name: "NodeId",
                    exported: true,
                    location: {
                        lineStart: 3,
                        lineEnd: 3,
                        columnStart: 1,
                        columnEnd: 28,
                    },
                },
            ],
            interfaces: [
                {
                    name: "ParserConfig",
                    exported: false,
                    extendsTypes: ["BaseConfig"],
                    location: {
                        lineStart: 5,
                        lineEnd: 8,
                        columnStart: 1,
                        columnEnd: 2,
                    },
                },
            ],
            enums: [
                {
                    name: "ParseMode",
                    exported: true,
                    members: ["FAST", "FULL"],
                    location: {
                        lineStart: 10,
                        lineEnd: 13,
                        columnStart: 1,
                        columnEnd: 2,
                    },
                },
            ],
            classes: [
                {
                    name: "ParserFacade",
                    exported: true,
                    extendsTypes: ["BaseParser"],
                    implementsTypes: ["Disposable"],
                    location: {
                        lineStart: 15,
                        lineEnd: 28,
                        columnStart: 1,
                        columnEnd: 2,
                    },
                },
            ],
            functions: [
                {
                    name: "parseFile",
                    kind: AST_FUNCTION_KIND.METHOD,
                    exported: false,
                    async: true,
                    parentClassName: "ParserFacade",
                    location: {
                        lineStart: 17,
                        lineEnd: 24,
                        columnStart: 5,
                        columnEnd: 6,
                    },
                },
            ],
            calls: [
                {
                    callee: "collectNodes",
                    caller: "parseFile",
                    location: {
                        lineStart: 20,
                        lineEnd: 20,
                        columnStart: 16,
                        columnEnd: 30,
                    },
                },
            ],
        }

        expect(parsedFile.language).toBe(AST_LANGUAGE.TYPESCRIPT)
        expect(parsedFile.imports[0]?.source).toBe("./shared")
        expect(parsedFile.interfaces[0]?.extendsTypes).toEqual(["BaseConfig"])
        expect(parsedFile.enums[0]?.members).toEqual(["FAST", "FULL"])
        expect(parsedFile.functions[0]?.kind).toBe(AST_FUNCTION_KIND.METHOD)
        expect(parsedFile.calls[0]?.caller).toBe("parseFile")
    })

    test("supports empty parser result for blank source file", () => {
        const parsedFile: IParsedSourceFileDTO = {
            filePath: "src/empty.ts",
            language: AST_LANGUAGE.TYPESCRIPT,
            hasSyntaxErrors: false,
            imports: [],
            typeAliases: [],
            interfaces: [],
            enums: [],
            classes: [],
            functions: [],
            calls: [],
        }

        expect(parsedFile.imports).toHaveLength(0)
        expect(parsedFile.hasSyntaxErrors).toBe(false)
    })
})
