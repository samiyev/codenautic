import {describe, expect, test} from "bun:test"

import {
    AST_FUNCTION_KIND,
    AST_IMPORT_KIND,
    AST_LANGUAGE,
    type ISourceCodeParseRequest,
} from "@codenautic/core"

import {
    assertPythonParserLanguage,
    PythonSourceCodeParser,
} from "../../src/ast"

describe("PythonSourceCodeParser", () => {
    test("parses .py source files with imports, classes, functions, and calls", async () => {
        const parser = new PythonSourceCodeParser({
            language: AST_LANGUAGE.PYTHON,
        })
        const request: ISourceCodeParseRequest = {
            filePath: "src/runtime/review_worker.py",
            content: [
                "import os",
                "from pkg.sub import WorkerBase as BaseWorker, Helper",
                "",
                "class ReviewWorker(BaseWorker):",
                "    def __init__(self) -> None:",
                "        self.run()",
                "",
                "async def bootstrap() -> None:",
                "    helper = Helper()",
                "    return helper.execute()",
            ].join("\n"),
        }

        const result = await parser.parse(request)

        expect(result.language).toBe(AST_LANGUAGE.PYTHON)
        expect(result.hasSyntaxErrors).toBe(false)
        expect(result.imports).toEqual([
            expect.objectContaining({
                source: "os",
                kind: AST_IMPORT_KIND.STATIC,
                specifiers: ["os"],
                typeOnly: false,
            }),
            expect.objectContaining({
                source: "pkg.sub",
                kind: AST_IMPORT_KIND.STATIC,
                specifiers: ["BaseWorker", "Helper"],
                typeOnly: false,
            }),
        ])
        expect(result.classes).toEqual([
            expect.objectContaining({
                name: "ReviewWorker",
                extendsTypes: ["BaseWorker"],
                implementsTypes: [],
            }),
        ])

        const constructorFunction = result.functions.find((entry) => entry.name === "__init__")
        expect(constructorFunction).toBeDefined()
        if (constructorFunction === undefined) {
            throw new Error("Expected constructor function to be parsed")
        }

        expect(constructorFunction.kind).toBe(AST_FUNCTION_KIND.METHOD)
        expect(constructorFunction.parentClassName).toBe("ReviewWorker")
        expect(constructorFunction.async).toBe(false)
        expect(constructorFunction.exported).toBe(false)

        const bootstrapFunction = result.functions.find((entry) => entry.name === "bootstrap")
        expect(bootstrapFunction).toBeDefined()
        if (bootstrapFunction === undefined) {
            throw new Error("Expected bootstrap function to be parsed")
        }

        expect(bootstrapFunction.kind).toBe(AST_FUNCTION_KIND.FUNCTION)
        expect(bootstrapFunction.parentClassName).toBeUndefined()
        expect(bootstrapFunction.async).toBe(true)
        expect(bootstrapFunction.exported).toBe(false)
        expect(result.calls.map((entry) => entry.callee)).toEqual([
            "self.run",
            "Helper",
            "helper.execute",
        ])
    })

    test("narrows only python language", () => {
        expect(assertPythonParserLanguage(AST_LANGUAGE.PYTHON)).toBe(AST_LANGUAGE.PYTHON)
        expect(() => assertPythonParserLanguage(AST_LANGUAGE.JAVASCRIPT)).toThrow(
            "Unsupported Python parser language: javascript",
        )
    })
})
