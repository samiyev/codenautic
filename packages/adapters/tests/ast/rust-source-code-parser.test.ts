import {describe, expect, test} from "bun:test"

import {
    AST_FUNCTION_KIND,
    AST_IMPORT_KIND,
    AST_LANGUAGE,
    type ISourceCodeParseRequest,
} from "@codenautic/core"

import {
    assertRustParserLanguage,
    RustSourceCodeParser,
} from "../../src/ast"

describe("RustSourceCodeParser", () => {
    test("parses .rs source files with use imports, structs, traits, impl methods, and calls", async () => {
        const parser = new RustSourceCodeParser({
            language: AST_LANGUAGE.RUST,
        })
        const request: ISourceCodeParseRequest = {
            filePath: "src/runtime/reviewer.rs",
            content: [
                "use std::fmt::Debug;",
                "use crate::core::{Runner, Worker as CoreWorker};",
                "",
                "pub struct Worker {",
                "    id: String,",
                "}",
                "",
                "pub trait Reviewable {",
                "    fn run(&self);",
                "}",
                "",
                "impl Reviewable for Worker {",
                "    fn run(&self) {",
                "        println!(\"ok\");",
                "    }",
                "}",
                "",
                "fn bootstrap() {",
                "    Worker::run();",
                "}",
            ].join("\n"),
        }

        const result = await parser.parse(request)

        expect(result.language).toBe(AST_LANGUAGE.RUST)
        expect(result.hasSyntaxErrors).toBe(false)
        expect(result.imports).toEqual([
            expect.objectContaining({
                source: "std::fmt::Debug",
                kind: AST_IMPORT_KIND.STATIC,
                specifiers: ["Debug"],
                typeOnly: false,
            }),
            expect.objectContaining({
                source: "crate::core::Runner",
                kind: AST_IMPORT_KIND.STATIC,
                specifiers: ["Runner"],
                typeOnly: false,
            }),
            expect.objectContaining({
                source: "crate::core::Worker",
                kind: AST_IMPORT_KIND.STATIC,
                specifiers: ["CoreWorker"],
                typeOnly: false,
            }),
        ])
        expect(result.interfaces).toEqual([
            expect.objectContaining({
                name: "Reviewable",
                exported: true,
            }),
        ])
        expect(result.classes).toEqual([
            expect.objectContaining({
                name: "Worker",
                exported: true,
                implementsTypes: ["Reviewable"],
            }),
        ])

        const traitMethod = result.functions.find((entry) => {
            return entry.name === "run" && entry.parentClassName === "Reviewable"
        })
        expect(traitMethod).toBeDefined()
        if (traitMethod === undefined) {
            throw new Error("Expected trait method run to be parsed")
        }

        expect(traitMethod.kind).toBe(AST_FUNCTION_KIND.METHOD)

        const implMethod = result.functions.find((entry) => {
            return entry.name === "run" && entry.parentClassName === "Worker"
        })
        expect(implMethod).toBeDefined()
        if (implMethod === undefined) {
            throw new Error("Expected impl method run to be parsed")
        }

        expect(implMethod.kind).toBe(AST_FUNCTION_KIND.METHOD)

        const bootstrapFunction = result.functions.find((entry) => entry.name === "bootstrap")
        expect(bootstrapFunction).toBeDefined()
        if (bootstrapFunction === undefined) {
            throw new Error("Expected function bootstrap to be parsed")
        }

        expect(bootstrapFunction.kind).toBe(AST_FUNCTION_KIND.FUNCTION)
        expect(bootstrapFunction.parentClassName).toBeUndefined()
        expect(result.calls.map((entry) => entry.callee)).toEqual(["println", "Worker::run"])
    })

    test("narrows only rust language", () => {
        expect(assertRustParserLanguage(AST_LANGUAGE.RUST)).toBe(AST_LANGUAGE.RUST)
        expect(() => assertRustParserLanguage(AST_LANGUAGE.JAVASCRIPT)).toThrow(
            "Unsupported Rust parser language: javascript",
        )
    })
})
