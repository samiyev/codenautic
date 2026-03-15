import {describe, expect, test} from "bun:test"

import {
    AST_FUNCTION_KIND,
    type IAstFunctionDTO,
    type IAstSourceLocationDTO,
} from "@codenautic/core"

import {
    AST_FUNCTION_BODY_EXTRACTOR_ERROR_CODE,
    AstFunctionBodyExtractorError,
    AstFunctionBodyExtractorService,
} from "../../src/ast"

/**
 * Creates source location fixture.
 *
 * @param lineStart Start line.
 * @param lineEnd End line.
 * @returns Source location.
 */
function createLocation(lineStart: number, lineEnd: number): IAstSourceLocationDTO {
    return {
        lineStart,
        lineEnd,
        columnStart: 1,
        columnEnd: 1,
    }
}

/**
 * Creates function fixture.
 *
 * @param name Function name.
 * @param lineStart Start line.
 * @param lineEnd End line.
 * @param parentClassName Optional class name for methods.
 * @returns Function DTO.
 */
function createFunction(
    name: string,
    lineStart: number,
    lineEnd: number,
    parentClassName?: string,
): IAstFunctionDTO {
    return {
        name,
        kind: AST_FUNCTION_KIND.FUNCTION,
        exported: true,
        async: false,
        ...(parentClassName !== undefined ? {parentClassName} : {}),
        location: createLocation(lineStart, lineEnd),
    }
}

/**
 * Asserts typed function body extractor error for sync action.
 *
 * @param callback Action expected to throw.
 * @param code Expected typed error code.
 */
function expectFunctionBodyExtractorError(
    callback: () => unknown,
    code:
        (typeof AST_FUNCTION_BODY_EXTRACTOR_ERROR_CODE)[keyof typeof AST_FUNCTION_BODY_EXTRACTOR_ERROR_CODE],
): void {
    try {
        callback()
    } catch (error) {
        expect(error).toBeInstanceOf(AstFunctionBodyExtractorError)

        if (error instanceof AstFunctionBodyExtractorError) {
            expect(error.code).toBe(code)
            return
        }
    }

    throw new Error("Expected AstFunctionBodyExtractorError to be thrown")
}

/**
 * Asserts typed function body extractor error for async action.
 *
 * @param callback Async action expected to reject.
 * @param code Expected typed error code.
 * @returns Promise resolved when assertion passes.
 */
async function expectFunctionBodyExtractorErrorAsync(
    callback: () => Promise<unknown>,
    code:
        (typeof AST_FUNCTION_BODY_EXTRACTOR_ERROR_CODE)[keyof typeof AST_FUNCTION_BODY_EXTRACTOR_ERROR_CODE],
): Promise<void> {
    try {
        await callback()
    } catch (error) {
        expect(error).toBeInstanceOf(AstFunctionBodyExtractorError)

        if (error instanceof AstFunctionBodyExtractorError) {
            expect(error.code).toBe(code)
            return
        }
    }

    throw new Error("Expected AstFunctionBodyExtractorError to be thrown")
}

describe("AstFunctionBodyExtractorService", () => {
    test("extracts full function text by line ranges", async () => {
        const service = new AstFunctionBodyExtractorService()
        const sourceCode = [
            "export function outer() {",
            "    const value = prepare()",
            "    return value",
            "}",
            "",
            "function helper() {",
            "    return 42",
            "}",
        ].join("\n")
        const result = await service.extract({
            filePath: "src/file.ts",
            sourceCode,
            functions: [
                createFunction("outer", 1, 4),
                createFunction("helper", 6, 8),
            ],
        })

        expect(result.bodies).toEqual([
            {
                id: "src/file.ts:outer:1:4",
                filePath: "src/file.ts",
                functionName: "outer",
                lineStart: 1,
                lineEnd: 4,
                lineCount: 4,
                fullText: [
                    "export function outer() {",
                    "    const value = prepare()",
                    "    return value",
                    "}",
                ].join("\n"),
            },
            {
                id: "src/file.ts:helper:6:8",
                filePath: "src/file.ts",
                functionName: "helper",
                lineStart: 6,
                lineEnd: 8,
                lineCount: 3,
                fullText: [
                    "function helper() {",
                    "    return 42",
                    "}",
                ].join("\n"),
            },
        ])
        expect(result.summary).toEqual({
            functionCount: 2,
            extractedCount: 2,
            longestBodyLineCount: 4,
        })
    })

    test("handles nested function ranges without truncation", async () => {
        const service = new AstFunctionBodyExtractorService()
        const sourceCode = [
            "function outer() {",
            "    function inner() {",
            "        return 1",
            "    }",
            "",
            "    return inner()",
            "}",
        ].join("\n")
        const result = await service.extract({
            filePath: "src/nested.ts",
            sourceCode,
            functions: [
                createFunction("outer", 1, 7),
                createFunction("inner", 2, 4),
            ],
        })

        expect(result.bodies[0]?.functionName).toBe("outer")
        expect(result.bodies[0]?.fullText).toContain("function inner() {")
        expect(result.bodies[1]?.functionName).toBe("inner")
        expect(result.bodies[1]?.fullText).toEqual([
            "    function inner() {",
            "        return 1",
            "    }",
        ].join("\n"))
    })

    test("returns deterministic payload for repeated extraction", async () => {
        const service = new AstFunctionBodyExtractorService()
        const input = {
            filePath: "src/deterministic.ts",
            sourceCode: [
                "function b() {",
                "    return 2",
                "}",
                "",
                "function a() {",
                "    return 1",
                "}",
            ].join("\n"),
            functions: [
                createFunction("a", 5, 7),
                createFunction("b", 1, 3),
            ],
        }
        const first = await service.extract(input)
        const second = await service.extract(input)

        expect(second).toEqual(first)
    })

    test("throws typed errors for invalid input", async () => {
        const service = new AstFunctionBodyExtractorService()

        expectFunctionBodyExtractorError(
            () => {
                void service.extract({
                    filePath: "  ",
                    sourceCode: "function x() { return 1 }",
                    functions: [createFunction("x", 1, 1)],
                })
            },
            AST_FUNCTION_BODY_EXTRACTOR_ERROR_CODE.INVALID_FILE_PATH,
        )

        await expectFunctionBodyExtractorErrorAsync(
            async () =>
                service.extract({
                    filePath: "src/file.ts",
                    sourceCode: "",
                    functions: [createFunction("x", 1, 1)],
                }),
            AST_FUNCTION_BODY_EXTRACTOR_ERROR_CODE.INVALID_SOURCE_CODE,
        )

        await expectFunctionBodyExtractorErrorAsync(
            async () =>
                service.extract({
                    filePath: "src/file.ts",
                    sourceCode: "function x() { return 1 }",
                    functions: [],
                }),
            AST_FUNCTION_BODY_EXTRACTOR_ERROR_CODE.EMPTY_FUNCTIONS,
        )

        await expectFunctionBodyExtractorErrorAsync(
            async () =>
                service.extract({
                    filePath: "src/file.ts",
                    sourceCode: "function x() { return 1 }",
                    functions: [createFunction("   ", 1, 1)],
                }),
            AST_FUNCTION_BODY_EXTRACTOR_ERROR_CODE.INVALID_FUNCTION_NAME,
        )

        await expectFunctionBodyExtractorErrorAsync(
            async () =>
                service.extract({
                    filePath: "src/file.ts",
                    sourceCode: "function x() {\n    return 1\n}",
                    functions: [createFunction("x", 1, 5)],
                }),
            AST_FUNCTION_BODY_EXTRACTOR_ERROR_CODE.INVALID_FUNCTION_RANGE,
        )

        await expectFunctionBodyExtractorErrorAsync(
            async () =>
                service.extract({
                    filePath: "src/file.ts",
                    sourceCode: "function x() {\n    return 1\n}",
                    functions: [
                        createFunction("x", 1, 3),
                        createFunction("x", 1, 3),
                    ],
                }),
            AST_FUNCTION_BODY_EXTRACTOR_ERROR_CODE.DUPLICATE_FUNCTION_REFERENCE,
        )
    })
})
