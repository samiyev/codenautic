import {describe, expect, test} from "bun:test"

import {AST_LANGUAGE} from "@codenautic/core"

import {
    AST_LANGUAGE_DETECTION_ERROR_CODE,
    AstLanguageDetectionError,
    AstLanguageDetectionService,
} from "../../src/ast"

/**
 * Asserts typed AST language detection error payload.
 *
 * @param callback Action expected to throw.
 * @param code Expected error code.
 * @param filePath Expected file path metadata.
 */
function expectAstLanguageDetectionError(
    callback: () => unknown,
    code: (typeof AST_LANGUAGE_DETECTION_ERROR_CODE)[keyof typeof AST_LANGUAGE_DETECTION_ERROR_CODE],
    filePath: string,
): void {
    try {
        callback()
    } catch (error) {
        expect(error).toBeInstanceOf(AstLanguageDetectionError)

        if (error instanceof AstLanguageDetectionError) {
            expect(error.code).toBe(code)
            expect(error.filePath).toBe(filePath)
            return
        }
    }

    throw new Error("Expected AstLanguageDetectionError to be thrown")
}

describe("AstLanguageDetectionService", () => {
    test("detects supported languages by exact filename and extension", () => {
        const service = new AstLanguageDetectionService()

        expect(service.detect({filePath: "Gemfile"})).toBe(AST_LANGUAGE.RUBY)
        expect(service.detect({filePath: "src/types.d.ts"})).toBe(AST_LANGUAGE.TYPESCRIPT)
        expect(service.detect({filePath: "src/app.ts"})).toBe(AST_LANGUAGE.TYPESCRIPT)
        expect(service.detect({filePath: "src/app.tsx"})).toBe(AST_LANGUAGE.TSX)
        expect(service.detect({filePath: "src/app.mts"})).toBe(AST_LANGUAGE.TYPESCRIPT)
        expect(service.detect({filePath: "src/app.js"})).toBe(AST_LANGUAGE.JAVASCRIPT)
        expect(service.detect({filePath: "src/app.jsx"})).toBe(AST_LANGUAGE.JSX)
        expect(service.detect({filePath: "src/app.cjs"})).toBe(AST_LANGUAGE.JAVASCRIPT)
        expect(service.detect({filePath: "scripts/run.py"})).toBe(AST_LANGUAGE.PYTHON)
        expect(service.detect({filePath: "build.gradle.kts"})).toBe(AST_LANGUAGE.KOTLIN)
        expect(service.detect({filePath: "src/main.rs"})).toBe(AST_LANGUAGE.RUST)
    })

    test("normalizes windows-style paths before detection", () => {
        const service = new AstLanguageDetectionService()

        expect(service.detect({filePath: "src\\cli\\main.ts"})).toBe(AST_LANGUAGE.TYPESCRIPT)
    })

    test("detects language by shebang when extension is missing", () => {
        const service = new AstLanguageDetectionService()

        expect(
            service.detect({
                filePath: "bin/review-worker",
                content: "#!/usr/bin/env python3\nprint('ok')\n",
            }),
        ).toBe(AST_LANGUAGE.PYTHON)
        expect(
            service.detect({
                filePath: "bin/review-agent",
                content: "#!/usr/bin/env ts-node\nconst value: string = 'ok'\n",
            }),
        ).toBe(AST_LANGUAGE.TYPESCRIPT)
        expect(
            service.detect({
                filePath: "bin/ci-bootstrap",
                content: "#!/usr/bin/env ruby\nputs 'ok'\n",
            }),
        ).toBe(AST_LANGUAGE.RUBY)
        expect(
            service.detect({
                filePath: "bin/migrate",
                content: "#!/usr/bin/env php\n<?php echo 'ok';\n",
            }),
        ).toBe(AST_LANGUAGE.PHP)
        expect(
            service.detect({
                filePath: "bin/main",
                content: "#!/usr/bin/env java\nclass Main {}\n",
            }),
        ).toBe(AST_LANGUAGE.JAVA)
        expect(
            service.detect({
                filePath: "bin/tool",
                content: "#!/usr/bin/env kotlin\nprintln(\"ok\")\n",
            }),
        ).toBe(AST_LANGUAGE.KOTLIN)
        expect(
            service.detect({
                filePath: "bin/collector",
                content: "#!/usr/bin/env go\npackage main\n",
            }),
        ).toBe(AST_LANGUAGE.GO)
    })

    test("uses content heuristics to disambiguate script family runtimes", () => {
        const service = new AstLanguageDetectionService()

        expect(
            service.detect({
                filePath: "bin/ui-renderer",
                content: "#!/usr/bin/env bun\ninterface Props { readonly title: string }\nconst View = () => <main />\n",
            }),
        ).toBe(AST_LANGUAGE.TSX)
        expect(
            service.detect({
                filePath: "bin/web-preview",
                content: "#!/usr/bin/env bun\nconst View = () => <main />\n",
            }),
        ).toBe(AST_LANGUAGE.JSX)
        expect(
            service.detect({
                filePath: "bin/scanner",
                content: "#!/usr/bin/env deno\ntype ReviewId = string\nconst reviewId: string = '1'\n",
            }),
        ).toBe(AST_LANGUAGE.TYPESCRIPT)
        expect(
            service.detect({
                filePath: "bin/tsx-view",
                content: "#!/usr/bin/env tsx\nconst View = () => <main />\n",
            }),
        ).toBe(AST_LANGUAGE.TSX)
        expect(
            service.detect({
                filePath: "bin/node-worker",
                content: "#!/usr/bin/env node\nconst View = () => <main />\n",
            }),
        ).toBe(AST_LANGUAGE.JSX)
        expect(
            service.detect({
                filePath: "bin/node-script",
                content: "#!/usr/bin/env node\nconst value: string = 'typed but still node'\n",
            }),
        ).toBe(AST_LANGUAGE.JAVASCRIPT)
    })

    test("prefers explicit file extension over shebang heuristics", () => {
        const service = new AstLanguageDetectionService()

        expect(
            service.detect({
                filePath: "scripts/deploy.rb",
                content: "#!/usr/bin/env python3\nprint('this should stay ruby')\n",
            }),
        ).toBe(AST_LANGUAGE.RUBY)
    })

    test("throws typed error for blank file path", () => {
        const service = new AstLanguageDetectionService()

        expectAstLanguageDetectionError(
            () => service.detect({filePath: "   "}),
            AST_LANGUAGE_DETECTION_ERROR_CODE.INVALID_FILE_PATH,
            "   ",
        )
        expect(() => service.detect({filePath: "   "})).toThrow("AST language file path cannot be empty")
    })

    test("throws typed error when language cannot be detected", () => {
        const service = new AstLanguageDetectionService()

        expectAstLanguageDetectionError(
            () =>
                service.detect({
                    filePath: "notes/readme",
                    content: "plain text without code markers\n",
                }),
            AST_LANGUAGE_DETECTION_ERROR_CODE.LANGUAGE_NOT_DETECTED,
            "notes/readme",
        )
        expect(() =>
            service.detect({
                filePath: "notes/readme",
                content: "plain text without code markers\n",
            }),
        ).toThrow("Unable to detect AST language for file: notes/readme")
    })

    test("throws typed error when content starts with blank lines or unsupported shebang", () => {
        const service = new AstLanguageDetectionService()

        expectAstLanguageDetectionError(
            () =>
                service.detect({
                    filePath: "scripts/blank-start",
                    content: "\n#!/usr/bin/env python3\nprint('hidden shebang')\n",
                }),
            AST_LANGUAGE_DETECTION_ERROR_CODE.LANGUAGE_NOT_DETECTED,
            "scripts/blank-start",
        )
        expectAstLanguageDetectionError(
            () =>
                service.detect({
                    filePath: "scripts/unsupported-runtime",
                    content: "\uFEFF#!/usr/bin/env bash\necho 'no parser'\n",
                }),
            AST_LANGUAGE_DETECTION_ERROR_CODE.LANGUAGE_NOT_DETECTED,
            "scripts/unsupported-runtime",
        )
        expectAstLanguageDetectionError(
            () => service.detect({filePath: "scripts/no-content"}),
            AST_LANGUAGE_DETECTION_ERROR_CODE.LANGUAGE_NOT_DETECTED,
            "scripts/no-content",
        )
    })
})
