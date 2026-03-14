import {describe, expect, test} from "bun:test"

import {
    AST_FUNCTION_KIND,
    AST_IMPORT_KIND,
    AST_LANGUAGE,
    type ISourceCodeParseRequest,
} from "@codenautic/core"

import {
    assertPhpParserLanguage,
    PhpSourceCodeParser,
} from "../../src/ast"

describe("PhpSourceCodeParser", () => {
    test("parses .php source files with imports, classes, traits, functions, and calls", async () => {
        const parser = new PhpSourceCodeParser({
            language: AST_LANGUAGE.PHP,
        })
        const request: ISourceCodeParseRequest = {
            filePath: "src/runtime/worker.php",
            content: [
                "<?php",
                "namespace App\\Runtime;",
                "",
                "use Foo\\Bar;",
                "use Foo\\Baz as Qux;",
                "use Foo\\{Helper, Utils as Tools};",
                "",
                "interface Reviewer extends BaseReviewer, Auditable {",
                "    public function run(): void;",
                "}",
                "",
                "trait Loggable {",
                "    public function log(): void {",
                "        helper();",
                "    }",
                "}",
                "",
                "class Worker extends BaseWorker implements Reviewer, CanClose {",
                "    use Loggable;",
                "",
                "    private function boot(): void {",
                "        self::init();",
                "    }",
                "",
                "    public function run(): void {",
                "        parent::run();",
                "        $this->log();",
                "        helper();",
                "    }",
                "}",
                "",
                "function bootstrap(): void {",
                "    run();",
                "}",
            ].join("\n"),
        }

        const result = await parser.parse(request)

        expect(result.language).toBe(AST_LANGUAGE.PHP)
        expect(result.hasSyntaxErrors).toBe(false)
        expect(result.imports).toEqual([
            expect.objectContaining({
                source: "Foo\\Bar",
                kind: AST_IMPORT_KIND.STATIC,
                specifiers: ["Bar"],
                typeOnly: false,
            }),
            expect.objectContaining({
                source: "Foo\\Baz",
                kind: AST_IMPORT_KIND.STATIC,
                specifiers: ["Qux"],
                typeOnly: false,
            }),
            expect.objectContaining({
                source: "Foo\\Helper",
                kind: AST_IMPORT_KIND.STATIC,
                specifiers: ["Helper"],
                typeOnly: false,
            }),
            expect.objectContaining({
                source: "Foo\\Utils",
                kind: AST_IMPORT_KIND.STATIC,
                specifiers: ["Tools"],
                typeOnly: false,
            }),
        ])
        expect(result.interfaces).toEqual([
            expect.objectContaining({
                name: "Reviewer",
                exported: true,
                extendsTypes: ["BaseReviewer", "Auditable"],
            }),
        ])
        const traitClass = result.classes.find((entry) => entry.name === "Loggable")
        expect(traitClass).toBeDefined()
        if (traitClass === undefined) {
            throw new Error("Expected trait Loggable to be parsed")
        }
        expect(traitClass.exported).toBe(true)
        expect(traitClass.extendsTypes).toEqual([])
        expect(traitClass.implementsTypes).toEqual([])

        const workerClass = result.classes.find((entry) => entry.name === "Worker")
        expect(workerClass).toBeDefined()
        if (workerClass === undefined) {
            throw new Error("Expected class Worker to be parsed")
        }
        expect(workerClass.exported).toBe(true)
        expect(workerClass.extendsTypes).toEqual(["BaseWorker"])
        expect(workerClass.implementsTypes).toEqual(["Reviewer", "CanClose", "Loggable"])

        const bootMethod = result.functions.find((entry) => entry.name === "boot")
        expect(bootMethod).toBeDefined()
        if (bootMethod === undefined) {
            throw new Error("Expected method boot to be parsed")
        }

        expect(bootMethod.kind).toBe(AST_FUNCTION_KIND.METHOD)
        expect(bootMethod.parentClassName).toBe("Worker")
        expect(bootMethod.exported).toBe(false)
        expect(bootMethod.async).toBe(false)

        const bootstrapFunction = result.functions.find((entry) => entry.name === "bootstrap")
        expect(bootstrapFunction).toBeDefined()
        if (bootstrapFunction === undefined) {
            throw new Error("Expected function bootstrap to be parsed")
        }

        expect(bootstrapFunction.kind).toBe(AST_FUNCTION_KIND.FUNCTION)
        expect(bootstrapFunction.parentClassName).toBeUndefined()
        expect(bootstrapFunction.exported).toBe(true)
        expect(bootstrapFunction.async).toBe(false)

        const callCallees = result.calls.map((entry) => entry.callee)
        expect(callCallees).toContain("self::init")
        expect(callCallees).toContain("parent::run")
        expect(callCallees).toContain("$this->log")
        expect(callCallees).toContain("helper")
        expect(callCallees).toContain("run")

        const memberCall = result.calls.find((entry) => entry.callee === "$this->log")
        expect(memberCall).toBeDefined()
        if (memberCall === undefined) {
            throw new Error("Expected member call $this->log to be parsed")
        }

        expect(memberCall.caller).toBe("run")
    })

    test("narrows only php language", () => {
        expect(assertPhpParserLanguage(AST_LANGUAGE.PHP)).toBe(AST_LANGUAGE.PHP)
        expect(() => assertPhpParserLanguage(AST_LANGUAGE.JAVASCRIPT)).toThrow(
            "Unsupported PHP parser language: javascript",
        )
    })
})
