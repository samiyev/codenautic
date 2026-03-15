import {describe, expect, test} from "bun:test"

import {
    AST_IMPORT_KIND,
    AST_LANGUAGE,
    type AstImportKind,
    type IAstImportDTO,
    type IAstSourceLocationDTO,
    type IParsedSourceFileDTO,
} from "@codenautic/core"

import {
    AST_IMPACT_RADIUS_CALCULATOR_ERROR_CODE,
    AST_IMPACT_RADIUS_DIRECTION,
    AstImpactRadiusCalculatorError,
    AstImpactRadiusCalculatorService,
} from "../../src/ast"

/**
 * Creates stable source location fixture.
 *
 * @returns Source location.
 */
function createLocation(): IAstSourceLocationDTO {
    return {
        lineStart: 1,
        lineEnd: 1,
        columnStart: 1,
        columnEnd: 1,
    }
}

/**
 * Creates import fixture.
 *
 * @param source Import source.
 * @param kind Import statement kind.
 * @returns Import DTO.
 */
function createImport(
    source: string,
    kind: AstImportKind = AST_IMPORT_KIND.STATIC,
): IAstImportDTO {
    return {
        source,
        kind,
        specifiers: [],
        typeOnly: false,
        location: createLocation(),
    }
}

/**
 * Creates parsed file fixture.
 *
 * @param filePath Repository-relative file path.
 * @param overrides Optional field overrides.
 * @returns Parsed source file DTO.
 */
function createParsedFile(
    filePath: string,
    overrides: Partial<IParsedSourceFileDTO> = {},
): IParsedSourceFileDTO {
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
        ...overrides,
    }
}

/**
 * Creates deterministic fixture set for import chain graph.
 *
 * @returns Parsed source files.
 */
function createDependencyChainFiles(): readonly IParsedSourceFileDTO[] {
    return [
        createParsedFile("src/core.ts"),
        createParsedFile("src/lib.ts", {
            imports: [createImport("./core")],
        }),
        createParsedFile("src/feature.ts", {
            imports: [createImport("./lib")],
        }),
        createParsedFile("src/app.ts", {
            imports: [createImport("./feature")],
        }),
    ]
}

/**
 * Asserts typed calculator error shape for synchronous action.
 *
 * @param callback Action expected to throw.
 * @param code Expected typed error code.
 */
function expectAstImpactRadiusCalculatorError(
    callback: () => unknown,
    code:
        (typeof AST_IMPACT_RADIUS_CALCULATOR_ERROR_CODE)[keyof typeof AST_IMPACT_RADIUS_CALCULATOR_ERROR_CODE],
): void {
    try {
        callback()
    } catch (error) {
        expect(error).toBeInstanceOf(AstImpactRadiusCalculatorError)

        if (error instanceof AstImpactRadiusCalculatorError) {
            expect(error.code).toBe(code)
            return
        }
    }

    throw new Error("Expected AstImpactRadiusCalculatorError to be thrown")
}

/**
 * Asserts typed calculator error shape for async action.
 *
 * @param callback Async action expected to reject.
 * @param code Expected typed error code.
 */
async function expectAstImpactRadiusCalculatorErrorAsync(
    callback: () => Promise<unknown>,
    code:
        (typeof AST_IMPACT_RADIUS_CALCULATOR_ERROR_CODE)[keyof typeof AST_IMPACT_RADIUS_CALCULATOR_ERROR_CODE],
): Promise<void> {
    try {
        await callback()
    } catch (error) {
        expect(error).toBeInstanceOf(AstImpactRadiusCalculatorError)

        if (error instanceof AstImpactRadiusCalculatorError) {
            expect(error.code).toBe(code)
            return
        }
    }

    throw new Error("Expected AstImpactRadiusCalculatorError to be thrown")
}

describe("AstImpactRadiusCalculatorService", () => {
    test("calculates incoming impact radius by default", async () => {
        const calculator = new AstImpactRadiusCalculatorService()
        const result = await calculator.calculate({
            files: createDependencyChainFiles(),
            changedFilePaths: ["src/core.ts"],
        })

        expect(result.affectedFiles).toEqual([
            {
                filePath: "src/lib.ts",
                distance: 1,
            },
            {
                filePath: "src/feature.ts",
                distance: 2,
            },
            {
                filePath: "src/app.ts",
                distance: 3,
            },
        ])
        expect(result.summary).toEqual({
            scannedFileCount: 4,
            changedFileCount: 1,
            missingChangedFileCount: 0,
            affectedFileCount: 3,
            impactRadius: 3,
            direction: AST_IMPACT_RADIUS_DIRECTION.INCOMING,
            truncated: false,
            truncatedAffectedFileCount: 0,
        })
    })

    test("supports outgoing and both traversal directions", async () => {
        const calculator = new AstImpactRadiusCalculatorService()

        const outgoing = await calculator.calculate({
            files: createDependencyChainFiles(),
            changedFilePaths: ["src/lib.ts"],
            direction: AST_IMPACT_RADIUS_DIRECTION.OUTGOING,
        })

        expect(outgoing.affectedFiles).toEqual([
            {
                filePath: "src/core.ts",
                distance: 1,
            },
        ])
        expect(outgoing.summary.direction).toBe(AST_IMPACT_RADIUS_DIRECTION.OUTGOING)
        expect(outgoing.summary.impactRadius).toBe(1)

        const both = await calculator.calculate({
            files: createDependencyChainFiles(),
            changedFilePaths: ["src/lib.ts"],
            direction: AST_IMPACT_RADIUS_DIRECTION.BOTH,
        })

        expect(both.affectedFiles).toEqual([
            {
                filePath: "src/core.ts",
                distance: 1,
            },
            {
                filePath: "src/feature.ts",
                distance: 1,
            },
            {
                filePath: "src/app.ts",
                distance: 2,
            },
        ])
        expect(both.summary.direction).toBe(AST_IMPACT_RADIUS_DIRECTION.BOTH)
        expect(both.summary.impactRadius).toBe(2)
    })

    test("tracks missing changed files and truncates affected output", async () => {
        const calculator = new AstImpactRadiusCalculatorService()
        const result = await calculator.calculate({
            files: createDependencyChainFiles(),
            changedFilePaths: ["src/missing.ts", "src/core.ts", "src/core.ts"],
            maxAffectedFiles: 2,
        })

        expect(result.affectedFiles).toEqual([
            {
                filePath: "src/lib.ts",
                distance: 1,
            },
            {
                filePath: "src/feature.ts",
                distance: 2,
            },
        ])
        expect(result.summary).toEqual({
            scannedFileCount: 4,
            changedFileCount: 1,
            missingChangedFileCount: 1,
            affectedFileCount: 2,
            impactRadius: 3,
            direction: AST_IMPACT_RADIUS_DIRECTION.INCOMING,
            truncated: true,
            truncatedAffectedFileCount: 1,
        })
    })

    test("returns empty impact when changed files are absent in graph", async () => {
        const calculator = new AstImpactRadiusCalculatorService()
        const result = await calculator.calculate({
            files: createDependencyChainFiles(),
            changedFilePaths: ["src/unknown.ts"],
        })

        expect(result.affectedFiles).toEqual([])
        expect(result.summary.changedFileCount).toBe(0)
        expect(result.summary.missingChangedFileCount).toBe(1)
        expect(result.summary.impactRadius).toBe(0)
    })

    test("throws typed errors for invalid options", async () => {
        expectAstImpactRadiusCalculatorError(
            () => {
                void new AstImpactRadiusCalculatorService({
                    defaultMaxDepth: 0,
                })
            },
            AST_IMPACT_RADIUS_CALCULATOR_ERROR_CODE.INVALID_MAX_DEPTH,
        )

        expectAstImpactRadiusCalculatorError(
            () => {
                void new AstImpactRadiusCalculatorService({
                    defaultMaxAffectedFiles: 0,
                })
            },
            AST_IMPACT_RADIUS_CALCULATOR_ERROR_CODE.INVALID_MAX_AFFECTED_FILES,
        )

        expectAstImpactRadiusCalculatorError(
            () => {
                void new AstImpactRadiusCalculatorService({
                    defaultDirection: "SIDEWAYS" as never,
                })
            },
            AST_IMPACT_RADIUS_CALCULATOR_ERROR_CODE.INVALID_DIRECTION,
        )

        const calculator = new AstImpactRadiusCalculatorService()

        await expectAstImpactRadiusCalculatorErrorAsync(
            async () =>
                calculator.calculate({
                    files: createDependencyChainFiles(),
                    changedFilePaths: [],
                }),
            AST_IMPACT_RADIUS_CALCULATOR_ERROR_CODE.EMPTY_CHANGED_FILE_PATHS,
        )

        await expectAstImpactRadiusCalculatorErrorAsync(
            async () =>
                calculator.calculate({
                    files: createDependencyChainFiles(),
                    changedFilePaths: ["   "],
                }),
            AST_IMPACT_RADIUS_CALCULATOR_ERROR_CODE.INVALID_FILE_PATH,
        )

        await expectAstImpactRadiusCalculatorErrorAsync(
            async () =>
                calculator.calculate({
                    files: createDependencyChainFiles(),
                    changedFilePaths: ["src/core.ts"],
                    direction: "SIDEWAYS" as never,
                }),
            AST_IMPACT_RADIUS_CALCULATOR_ERROR_CODE.INVALID_DIRECTION,
        )

        await expectAstImpactRadiusCalculatorErrorAsync(
            async () =>
                calculator.calculate({
                    files: createDependencyChainFiles(),
                    changedFilePaths: ["src/core.ts"],
                    maxDepth: 0,
                }),
            AST_IMPACT_RADIUS_CALCULATOR_ERROR_CODE.INVALID_MAX_DEPTH,
        )

        await expectAstImpactRadiusCalculatorErrorAsync(
            async () =>
                calculator.calculate({
                    files: createDependencyChainFiles(),
                    changedFilePaths: ["src/core.ts"],
                    maxAffectedFiles: 0,
                }),
            AST_IMPACT_RADIUS_CALCULATOR_ERROR_CODE.INVALID_MAX_AFFECTED_FILES,
        )
    })
})
