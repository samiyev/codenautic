import {describe, expect, test} from "bun:test"

import {
    AST_FUNCTION_KIND,
    AST_IMPORT_KIND,
    AST_LANGUAGE,
    type IAstCallDTO,
    type IAstFunctionDTO,
    type IAstImportDTO,
    type IAstSourceLocationDTO,
} from "@codenautic/core"

import {
    AST_FUNCTION_SIMILARITY_ERROR_CODE,
    AstFunctionSimilarityError,
    AstFunctionSimilarityService,
    type IAstFunctionSimilarityLlmValidationResult,
    type IAstFunctionSimilarityTarget,
} from "../../src/ast"

/**
 * Creates stable source location fixture.
 *
 * @returns Source location.
 */
function createLocation(): IAstSourceLocationDTO {
    return {
        lineStart: 1,
        lineEnd: 5,
        columnStart: 1,
        columnEnd: 10,
    }
}

/**
 * Creates function fixture.
 *
 * @param name Function name.
 * @param kind Function kind.
 * @returns Function fixture.
 */
function createFunction(
    name: string,
    kind: IAstFunctionDTO["kind"] = AST_FUNCTION_KIND.FUNCTION,
): IAstFunctionDTO {
    return {
        name,
        kind,
        exported: true,
        async: false,
        location: createLocation(),
    }
}

/**
 * Creates import fixture.
 *
 * @param source Import source.
 * @returns Import fixture.
 */
function createImport(source: string): IAstImportDTO {
    return {
        source,
        kind: AST_IMPORT_KIND.STATIC,
        specifiers: [],
        typeOnly: false,
        location: createLocation(),
    }
}

/**
 * Creates call fixture.
 *
 * @param callee Called symbol.
 * @param caller Optional caller symbol.
 * @returns Call fixture.
 */
function createCall(callee: string, caller?: string): IAstCallDTO {
    return {
        callee,
        caller,
        location: createLocation(),
    }
}

/**
 * Creates function similarity target fixture.
 *
 * @param filePath Repository-relative file path.
 * @param functionName Function name.
 * @param overrides Optional target overrides.
 * @returns Function similarity target fixture.
 */
function createTarget(
    filePath: string,
    functionName: string,
    overrides: Partial<IAstFunctionSimilarityTarget> = {},
): IAstFunctionSimilarityTarget {
    return {
        filePath,
        language: AST_LANGUAGE.TYPESCRIPT,
        function: createFunction(functionName),
        imports: [],
        calls: [],
        ...overrides,
    }
}

/**
 * Asserts typed function-similarity error shape.
 *
 * @param callback Action expected to throw.
 * @param code Expected typed error code.
 */
function expectAstFunctionSimilarityError(
    callback: () => unknown,
    code:
        (typeof AST_FUNCTION_SIMILARITY_ERROR_CODE)[keyof typeof AST_FUNCTION_SIMILARITY_ERROR_CODE],
): void {
    try {
        callback()
    } catch (error) {
        expect(error).toBeInstanceOf(AstFunctionSimilarityError)

        if (error instanceof AstFunctionSimilarityError) {
            expect(error.code).toBe(code)
            return
        }
    }

    throw new Error("Expected AstFunctionSimilarityError to be thrown")
}

/**
 * Asserts typed function-similarity error for async action.
 *
 * @param callback Action expected to reject.
 * @param code Expected typed error code.
 * @returns Promise resolved when assertion passes.
 */
async function expectAstFunctionSimilarityErrorAsync(
    callback: () => Promise<unknown>,
    code:
        (typeof AST_FUNCTION_SIMILARITY_ERROR_CODE)[keyof typeof AST_FUNCTION_SIMILARITY_ERROR_CODE],
): Promise<void> {
    try {
        await callback()
    } catch (error) {
        expect(error).toBeInstanceOf(AstFunctionSimilarityError)

        if (error instanceof AstFunctionSimilarityError) {
            expect(error.code).toBe(code)
            return
        }
    }

    throw new Error("Expected AstFunctionSimilarityError to be thrown")
}

describe("AstFunctionSimilarityService", () => {
    test("marks functions similar when structural Jaccard score meets threshold", async () => {
        const service = new AstFunctionSimilarityService()
        const left = createTarget("src/left.ts", "buildPlan", {
            imports: [
                createImport("lodash"),
                createImport("zod"),
            ],
            calls: [
                createCall("map", "buildPlan"),
                createCall("parse", "buildPlan"),
            ],
        })
        const right = createTarget("src/right.ts", "preparePlan", {
            imports: [
                createImport("lodash"),
                createImport("zod"),
            ],
            calls: [
                createCall("map", "preparePlan"),
                createCall("parse", "preparePlan"),
            ],
        })

        const result = await service.areFunctionsSimilar({
            left,
            right,
        })

        expect(result.isSimilar).toBe(true)
        expect(result.similarity).toBeGreaterThanOrEqual(0.5)
        expect(result.usedLlmValidation).toBe(false)
        expect(result.explanation.includes("Jaccard similarity")).toBe(true)
    })

    test("marks functions not similar when structural score is below threshold", async () => {
        const service = new AstFunctionSimilarityService()
        const left = createTarget("src/left.ts", "buildPlan", {
            imports: [createImport("lodash")],
            calls: [createCall("map", "buildPlan")],
        })
        const right = createTarget("src/right.ts", "bootstrap", {
            function: createFunction("bootstrap", AST_FUNCTION_KIND.METHOD),
            imports: [createImport("node:fs")],
            calls: [createCall("readFileSync", "bootstrap")],
        })

        const result = await service.areFunctionsSimilar({
            left,
            right,
        })

        expect(result.isSimilar).toBe(false)
        expect(result.similarity).toBeLessThan(0.5)
        expect(result.usedLlmValidation).toBe(false)
    })

    test("uses llm validator to reject structurally similar functions", async () => {
        let validatorCallCount = 0
        const service = new AstFunctionSimilarityService({
            llmValidator: () => {
                validatorCallCount += 1
                return Promise.resolve({
                    isSimilar: false,
                    explanation: "Different business intent despite similar structure.",
                })
            },
        })
        const left = createTarget("src/left.ts", "buildPlan", {
            imports: [createImport("lodash")],
            calls: [createCall("map", "buildPlan")],
        })
        const right = createTarget("src/right.ts", "preparePlan", {
            imports: [createImport("lodash")],
            calls: [createCall("map", "preparePlan")],
        })

        const result = await service.areFunctionsSimilar({
            left,
            right,
        })

        expect(result.isSimilar).toBe(false)
        expect(result.usedLlmValidation).toBe(true)
        expect(validatorCallCount).toBe(1)
        expect(result.explanation.includes("LLM validation")).toBe(true)
    })

    test("uses llm validator approval when structural threshold passes", async () => {
        const service = new AstFunctionSimilarityService({
            llmValidator: () =>
                Promise.resolve({
                    isSimilar: true,
                    explanation: "Both functions implement equivalent normalization pipeline.",
                }),
        })
        const left = createTarget("src/left.ts", "normalizeReview", {
            imports: [createImport("zod")],
            calls: [createCall("parse", "normalizeReview")],
        })
        const right = createTarget("src/right.ts", "sanitizeReview", {
            imports: [createImport("zod")],
            calls: [createCall("parse", "sanitizeReview")],
        })

        const result = await service.areFunctionsSimilar({
            left,
            right,
        })

        expect(result.isSimilar).toBe(true)
        expect(result.usedLlmValidation).toBe(true)
    })

    test("throws typed errors for invalid thresholds and malformed targets", async () => {
        expectAstFunctionSimilarityError(
            () => {
                void new AstFunctionSimilarityService({
                    defaultMinimumSimilarity: 2,
                })
            },
            AST_FUNCTION_SIMILARITY_ERROR_CODE.INVALID_MINIMUM_SIMILARITY,
        )

        const service = new AstFunctionSimilarityService()

        await expectAstFunctionSimilarityErrorAsync(
            async () =>
                service.areFunctionsSimilar({
                    left: createTarget("src/left.ts", "left"),
                    right: createTarget("src/right.ts", "right"),
                    minimumSimilarity: -0.1,
                }),
            AST_FUNCTION_SIMILARITY_ERROR_CODE.INVALID_MINIMUM_SIMILARITY,
        )

        await expectAstFunctionSimilarityErrorAsync(
            async () =>
                service.areFunctionsSimilar({
                    left: createTarget("   ", "left"),
                    right: createTarget("src/right.ts", "right"),
                }),
            AST_FUNCTION_SIMILARITY_ERROR_CODE.INVALID_FILE_PATH,
        )

        await expectAstFunctionSimilarityErrorAsync(
            async () =>
                service.areFunctionsSimilar({
                    left: createTarget("src/left.ts", "  "),
                    right: createTarget("src/right.ts", "right"),
                }),
            AST_FUNCTION_SIMILARITY_ERROR_CODE.INVALID_FUNCTION_NAME,
        )
    })

    test("throws typed errors for llm failures and malformed llm payload", async () => {
        const failingService = new AstFunctionSimilarityService({
            llmValidator: () => Promise.reject(new Error("Rate limit")),
        })
        const malformedService = new AstFunctionSimilarityService({
            llmValidator: () =>
                Promise.resolve({
                    isSimilar: true,
                    explanation: "   ",
                } as unknown as IAstFunctionSimilarityLlmValidationResult),
        })

        await expectAstFunctionSimilarityErrorAsync(
            async () =>
                failingService.areFunctionsSimilar({
                    left: createTarget("src/left.ts", "left"),
                    right: createTarget("src/right.ts", "right"),
                }),
            AST_FUNCTION_SIMILARITY_ERROR_CODE.LLM_VALIDATION_FAILED,
        )

        await expectAstFunctionSimilarityErrorAsync(
            async () =>
                malformedService.areFunctionsSimilar({
                    left: createTarget("src/left.ts", "left"),
                    right: createTarget("src/right.ts", "right"),
                }),
            AST_FUNCTION_SIMILARITY_ERROR_CODE.INVALID_LLM_VALIDATION_RESULT,
        )
    })
})
