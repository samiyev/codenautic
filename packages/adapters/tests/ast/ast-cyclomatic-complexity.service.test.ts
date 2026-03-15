import {describe, expect, test} from "bun:test"

import {
    AST_LANGUAGE,
    type SupportedLanguage,
} from "@codenautic/core"

import {
    AST_CYCLOMATIC_COMPLEXITY_ERROR_CODE,
    AstCyclomaticComplexityError,
    AstCyclomaticComplexityService,
    type IAstCyclomaticComplexityFileInput,
} from "../../src/ast"

type AstCyclomaticComplexityErrorCode =
    (typeof AST_CYCLOMATIC_COMPLEXITY_ERROR_CODE)[keyof typeof AST_CYCLOMATIC_COMPLEXITY_ERROR_CODE]

/**
 * Asserts typed AST cyclomatic complexity error for async action.
 *
 * @param callback Action expected to fail.
 * @param code Expected typed error code.
 * @returns Promise resolved when assertion passes.
 */
async function expectAstCyclomaticComplexityError(
    callback: () => Promise<unknown>,
    code: AstCyclomaticComplexityErrorCode,
): Promise<void> {
    try {
        await callback()
    } catch (error) {
        expect(error).toBeInstanceOf(AstCyclomaticComplexityError)

        if (error instanceof AstCyclomaticComplexityError) {
            expect(error.code).toBe(code)
            return
        }
    }

    throw new Error("Expected AstCyclomaticComplexityError to be thrown")
}

/**
 * Creates one cyclomatic complexity file input fixture.
 *
 * @param filePath Repository-relative file path.
 * @param language Source language.
 * @param sourceCode Source code payload.
 * @returns Cyclomatic complexity file input.
 */
function createFileInput(
    filePath: string,
    language: SupportedLanguage,
    sourceCode: string,
): IAstCyclomaticComplexityFileInput {
    return {
        filePath,
        language,
        sourceCode,
    }
}

describe("AstCyclomaticComplexityService", () => {
    test("calculates c-style cyclomatic complexity from control-flow keywords and logical operators", async () => {
        const service = new AstCyclomaticComplexityService()

        const result = await service.calculate({
            files: [
                createFileInput(
                    "src/main.ts",
                    AST_LANGUAGE.TYPESCRIPT,
                    [
                        "function run(flagA: boolean, flagB: boolean, kind: number): number {",
                        "    if (flagA && flagB) {",
                        "        return 1",
                        "    }",
                        "    for (let i = 0; i < 2; i += 1) {",
                        "        while (false) {",
                        "            break",
                        "        }",
                        "    }",
                        "    switch (kind) {",
                        "        case 1:",
                        "            return 10",
                        "        case 2:",
                        "            return 20",
                        "        default:",
                        "            return 0",
                        "    }",
                        "}",
                    ].join("\n"),
                ),
            ],
        })

        expect(result.items).toEqual([
            {
                filePath: "src/main.ts",
                complexity: 7,
            },
        ])
        expect(result.summary).toEqual({
            totalFiles: 1,
            processedFiles: 1,
            totalComplexity: 7,
            maxComplexity: 7,
        })
    })

    test("supports python and ruby decision keywords with language-specific logical operators", async () => {
        const service = new AstCyclomaticComplexityService()

        const result = await service.calculate({
            files: [
                createFileInput(
                    "scripts/job.py",
                    AST_LANGUAGE.PYTHON,
                    [
                        "def run(a, b, c):",
                        "    if a and b:",
                        "        return 1",
                        "    elif c or b:",
                        "        return 2",
                        "",
                        "try:",
                        "    run(True, False, True)",
                        "except Exception:",
                        "    pass",
                    ].join("\n"),
                ),
                createFileInput(
                    "scripts/app.rb",
                    AST_LANGUAGE.RUBY,
                    [
                        "def run(a, b)",
                        "  if a || b",
                        "    return 1",
                        "  elsif a and b",
                        "    return 2",
                        "  rescue StandardError",
                        "    return 0",
                        "  end",
                        "end",
                    ].join("\n"),
                ),
            ],
        })

        expect(result.items).toEqual([
            {
                filePath: "scripts/app.rb",
                complexity: 6,
            },
            {
                filePath: "scripts/job.py",
                complexity: 6,
            },
        ])
        expect(result.summary).toEqual({
            totalFiles: 2,
            processedFiles: 2,
            totalComplexity: 12,
            maxComplexity: 6,
        })
    })

    test("applies deterministic file-path filter and keeps total file count in summary", async () => {
        const service = new AstCyclomaticComplexityService()

        const result = await service.calculate({
            files: [
                createFileInput("src/a.ts", AST_LANGUAGE.TYPESCRIPT, "if (a) { return 1 }"),
                createFileInput("src/b.ts", AST_LANGUAGE.TYPESCRIPT, "if (b) { return 2 }"),
            ],
            filePaths: [" src/b.ts ", "src/b.ts"],
        })

        expect(result.items).toEqual([
            {
                filePath: "src/b.ts",
                complexity: 2,
            },
        ])
        expect(result.summary).toEqual({
            totalFiles: 2,
            processedFiles: 1,
            totalComplexity: 2,
            maxComplexity: 2,
        })
    })

    test("throws typed errors for invalid complexity input payloads", async () => {
        const service = new AstCyclomaticComplexityService()

        await expectAstCyclomaticComplexityError(
            () =>
                service.calculate({
                    files: [],
                }),
            AST_CYCLOMATIC_COMPLEXITY_ERROR_CODE.EMPTY_FILES,
        )

        await expectAstCyclomaticComplexityError(
            () =>
                service.calculate({
                    files: [
                        createFileInput("src/a.ts", AST_LANGUAGE.TYPESCRIPT, "if (a) { return 1 }"),
                        createFileInput("src/a.ts", AST_LANGUAGE.TYPESCRIPT, "if (b) { return 2 }"),
                    ],
                }),
            AST_CYCLOMATIC_COMPLEXITY_ERROR_CODE.DUPLICATE_FILE_PATH,
        )

        await expectAstCyclomaticComplexityError(
            () =>
                service.calculate({
                    files: [
                        createFileInput(
                            "src/a.ts",
                            "unsupported-language" as SupportedLanguage,
                            "if (a) { return 1 }",
                        ),
                    ],
                }),
            AST_CYCLOMATIC_COMPLEXITY_ERROR_CODE.INVALID_LANGUAGE,
        )

        await expectAstCyclomaticComplexityError(
            () =>
                service.calculate({
                    files: [createFileInput("src/a.ts", AST_LANGUAGE.TYPESCRIPT, "if (a) { return 1 }")],
                    filePaths: [],
                }),
            AST_CYCLOMATIC_COMPLEXITY_ERROR_CODE.EMPTY_FILE_PATH_FILTER,
        )
    })
})
