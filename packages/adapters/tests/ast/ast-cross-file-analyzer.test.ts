import {describe, expect, test} from "bun:test"

import {AST_LANGUAGE, type IParsedSourceFileDTO} from "@codenautic/core"

import {
    AST_CROSS_FILE_ANALYZER_ERROR_CODE,
    AstCrossFileAnalyzer,
    AstCrossFileAnalyzerError,
    type IAstCrossFileAnalysisContext,
    type IAstCrossFileAnalyzerInput,
} from "../../src/ast"

interface ITestCrossFileAnalyzerInput extends IAstCrossFileAnalyzerInput {
    readonly marker?: string
}

interface ITestCrossFileAnalyzerOutput {
    readonly filePaths: readonly string[]
    readonly sourceFilePaths: readonly string[]
    readonly directoryPaths: readonly string[]
    readonly fileLookupSize: number
    readonly sourceFileLookupSize: number
    readonly marker?: string
}

class TestCrossFileAnalyzer extends AstCrossFileAnalyzer<
    ITestCrossFileAnalyzerInput,
    ITestCrossFileAnalyzerOutput
> {
    protected override analyzeWithContext(
        context: IAstCrossFileAnalysisContext,
        input: ITestCrossFileAnalyzerInput,
    ): ITestCrossFileAnalyzerOutput {
        return {
            filePaths: context.files.map((file) => file.filePath),
            sourceFilePaths: context.sourceFiles.map((file) => file.filePath),
            directoryPaths: context.files.map((file) => file.directoryPath),
            fileLookupSize: context.fileLookup.size,
            sourceFileLookupSize: context.sourceFileLookup.size,
            marker: input.marker,
        }
    }
}

/**
 * Creates parsed source file fixture.
 *
 * @param filePath Repository-relative file path.
 * @returns Parsed source file DTO.
 */
function createParsedFile(filePath: string): IParsedSourceFileDTO {
    return {
        filePath,
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
}

/**
 * Asserts typed cross-file analyzer error shape.
 *
 * @param callback Action expected to throw.
 * @param code Expected typed error code.
 */
function expectAstCrossFileAnalyzerError(
    callback: () => unknown,
    code: (typeof AST_CROSS_FILE_ANALYZER_ERROR_CODE)[keyof typeof AST_CROSS_FILE_ANALYZER_ERROR_CODE],
): void {
    try {
        callback()
    } catch (error) {
        expect(error).toBeInstanceOf(AstCrossFileAnalyzerError)

        if (error instanceof AstCrossFileAnalyzerError) {
            expect(error.code).toBe(code)
            return
        }
    }

    throw new Error("Expected AstCrossFileAnalyzerError to be thrown")
}

describe("AstCrossFileAnalyzer", () => {
    test("normalizes and sorts files deterministically", async () => {
        const analyzer = new TestCrossFileAnalyzer()
        const result = await analyzer.analyze(
            [
                createParsedFile("src\\feature\\b.ts"),
                createParsedFile("src/a.ts"),
            ],
            {
                marker: "stable",
            },
        )

        expect(result.filePaths).toEqual(["src/a.ts", "src/feature/b.ts"])
        expect(result.sourceFilePaths).toEqual(["src/a.ts", "src/feature/b.ts"])
        expect(result.directoryPaths).toEqual(["src", "src/feature"])
        expect(result.fileLookupSize).toBe(2)
        expect(result.sourceFileLookupSize).toBe(2)
        expect(result.marker).toBe("stable")
    })

    test("applies source file-path filter with deduplication and normalization", async () => {
        const analyzer = new TestCrossFileAnalyzer()
        const result = await analyzer.analyze(
            [
                createParsedFile("src/a.ts"),
                createParsedFile("src\\feature\\b.ts"),
            ],
            {
                filePaths: ["src\\feature\\b.ts", "src/feature/b.ts"],
            },
        )

        expect(result.filePaths).toEqual(["src/a.ts", "src/feature/b.ts"])
        expect(result.sourceFilePaths).toEqual(["src/feature/b.ts"])
        expect(result.sourceFileLookupSize).toBe(1)
    })

    test("returns empty source files when file-path filter does not match parsed files", async () => {
        const analyzer = new TestCrossFileAnalyzer()
        const result = await analyzer.analyze(
            [
                createParsedFile("src/a.ts"),
                createParsedFile("src/b.ts"),
            ],
            {
                filePaths: ["src/missing.ts"],
            },
        )

        expect(result.filePaths).toEqual(["src/a.ts", "src/b.ts"])
        expect(result.sourceFilePaths).toEqual([])
        expect(result.fileLookupSize).toBe(2)
        expect(result.sourceFileLookupSize).toBe(0)
    })

    test("throws typed error for empty parsed file collection", () => {
        const analyzer = new TestCrossFileAnalyzer()

        expectAstCrossFileAnalyzerError(
            () => {
                void analyzer.analyze([], {})
            },
            AST_CROSS_FILE_ANALYZER_ERROR_CODE.EMPTY_FILES,
        )
    })

    test("throws typed error for duplicate normalized file paths", () => {
        const analyzer = new TestCrossFileAnalyzer()

        expectAstCrossFileAnalyzerError(
            () => {
                void analyzer.analyze(
                    [
                        createParsedFile("src/a.ts"),
                        createParsedFile("src\\a.ts"),
                    ],
                    {},
                )
            },
            AST_CROSS_FILE_ANALYZER_ERROR_CODE.DUPLICATE_FILE_PATH,
        )
    })

    test("throws typed error for invalid parsed file path", () => {
        const analyzer = new TestCrossFileAnalyzer()

        expectAstCrossFileAnalyzerError(
            () => {
                void analyzer.analyze([createParsedFile("   ")], {})
            },
            AST_CROSS_FILE_ANALYZER_ERROR_CODE.INVALID_FILE_PATH,
        )
    })

    test("throws typed error for empty file-path filter", () => {
        const analyzer = new TestCrossFileAnalyzer()

        expectAstCrossFileAnalyzerError(
            () => {
                void analyzer.analyze([createParsedFile("src/a.ts")], {
                    filePaths: [],
                })
            },
            AST_CROSS_FILE_ANALYZER_ERROR_CODE.EMPTY_FILE_PATHS,
        )
    })

    test("throws typed error for invalid filtered file path", () => {
        const analyzer = new TestCrossFileAnalyzer()

        expectAstCrossFileAnalyzerError(
            () => {
                void analyzer.analyze([createParsedFile("src/a.ts")], {
                    filePaths: ["  "],
                })
            },
            AST_CROSS_FILE_ANALYZER_ERROR_CODE.INVALID_FILE_PATH,
        )
    })
})
