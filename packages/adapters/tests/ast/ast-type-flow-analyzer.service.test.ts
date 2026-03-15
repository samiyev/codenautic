import {describe, expect, test} from "bun:test"

import {
    AST_IMPORT_KIND,
    AST_LANGUAGE,
    type AstImportKind,
    type IAstClassDTO,
    type IAstImportDTO,
    type IAstInterfaceDTO,
    type IAstSourceLocationDTO,
    type IParsedSourceFileDTO,
} from "@codenautic/core"

import {
    AST_TYPE_FLOW_ANALYZER_ERROR_CODE,
    AstTypeFlowAnalyzerError,
    AstTypeFlowAnalyzerService,
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
 * @param kind Import kind.
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
 * Creates interface declaration fixture.
 *
 * @param name Interface name.
 * @param extendsTypes Interface extends list.
 * @returns Interface DTO.
 */
function createInterface(
    name: string,
    extendsTypes: readonly string[] = [],
): IAstInterfaceDTO {
    return {
        name,
        exported: true,
        extendsTypes: [...extendsTypes],
        location: createLocation(),
    }
}

/**
 * Creates class declaration fixture.
 *
 * @param name Class name.
 * @param implementsTypes Class implements list.
 * @returns Class DTO.
 */
function createClass(
    name: string,
    implementsTypes: readonly string[] = [],
): IAstClassDTO {
    return {
        name,
        exported: true,
        extendsTypes: [],
        implementsTypes: [...implementsTypes],
        location: createLocation(),
    }
}

/**
 * Creates parsed source file fixture.
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
 * Asserts typed analyzer error shape for synchronous action.
 *
 * @param callback Action expected to throw.
 * @param code Expected typed error code.
 */
function expectAstTypeFlowAnalyzerError(
    callback: () => unknown,
    code:
        (typeof AST_TYPE_FLOW_ANALYZER_ERROR_CODE)[keyof typeof AST_TYPE_FLOW_ANALYZER_ERROR_CODE],
): void {
    try {
        callback()
    } catch (error) {
        expect(error).toBeInstanceOf(AstTypeFlowAnalyzerError)

        if (error instanceof AstTypeFlowAnalyzerError) {
            expect(error.code).toBe(code)
            return
        }
    }

    throw new Error("Expected AstTypeFlowAnalyzerError to be thrown")
}

/**
 * Asserts typed analyzer error shape for async action.
 *
 * @param callback Async action expected to reject.
 * @param code Expected typed error code.
 */
async function expectAstTypeFlowAnalyzerErrorAsync(
    callback: () => Promise<unknown>,
    code:
        (typeof AST_TYPE_FLOW_ANALYZER_ERROR_CODE)[keyof typeof AST_TYPE_FLOW_ANALYZER_ERROR_CODE],
): Promise<void> {
    try {
        await callback()
    } catch (error) {
        expect(error).toBeInstanceOf(AstTypeFlowAnalyzerError)

        if (error instanceof AstTypeFlowAnalyzerError) {
            expect(error.code).toBe(code)
            return
        }
    }

    throw new Error("Expected AstTypeFlowAnalyzerError to be thrown")
}

describe("AstTypeFlowAnalyzerService", () => {
    test("builds deterministic resolved type flows", async () => {
        const analyzer = new AstTypeFlowAnalyzerService()
        const result = await analyzer.analyze({
            files: [
                createParsedFile("src/contracts/base.ts", {
                    interfaces: [createInterface("IBase")],
                }),
                createParsedFile("src/contracts/service.ts", {
                    imports: [createImport("./base")],
                    interfaces: [createInterface("IService", ["IBase"])],
                }),
                createParsedFile("src/impl/service-impl.ts", {
                    imports: [createImport("../contracts/service")],
                    classes: [createClass("ServiceImpl", ["IService"])],
                }),
            ],
        })

        expect(result.flows).toEqual([
            {
                id: "src/contracts/service.ts|src/contracts/base.ts|IBase|IBase",
                sourceFilePath: "src/contracts/service.ts",
                targetFilePath: "src/contracts/base.ts",
                sourceType: "IBase",
                targetType: "IBase",
                confidence: 0.9,
            },
            {
                id: "src/impl/service-impl.ts|src/contracts/service.ts|IService|IService",
                sourceFilePath: "src/impl/service-impl.ts",
                targetFilePath: "src/contracts/service.ts",
                sourceType: "IService",
                targetType: "IService",
                confidence: 0.9,
            },
        ])
        expect(result.unresolvedFlows).toEqual([])
        expect(result.summary).toEqual({
            scannedFileCount: 3,
            resolvedFlowCount: 2,
            unresolvedFlowCount: 0,
            highConfidenceFlowCount: 2,
            truncated: false,
            truncatedFlowCount: 0,
        })
    })

    test("returns unresolved type flows and truncates resolved flow output", async () => {
        const analyzer = new AstTypeFlowAnalyzerService()
        const result = await analyzer.analyze({
            files: [
                createParsedFile("src/types/first.ts", {
                    interfaces: [createInterface("IFirst")],
                }),
                createParsedFile("src/types/second.ts", {
                    interfaces: [createInterface("ISecond")],
                }),
                createParsedFile("src/impl/a.ts", {
                    imports: [createImport("../types/first"), createImport("../types/second")],
                    classes: [createClass("A", ["IFirst", "ISecond", "IMissing"])],
                }),
            ],
            maxFlows: 1,
        })

        expect(result.flows).toEqual([
            {
                id: "src/impl/a.ts|src/types/first.ts|IFirst|IFirst",
                sourceFilePath: "src/impl/a.ts",
                targetFilePath: "src/types/first.ts",
                sourceType: "IFirst",
                targetType: "IFirst",
                confidence: 0.9,
            },
        ])
        expect(result.unresolvedFlows).toEqual([
            {
                sourceFilePath: "src/impl/a.ts",
                typeName: "IMissing",
                candidateFilePaths: [],
                reason: "SYMBOL_NOT_FOUND",
            },
        ])
        expect(result.summary).toEqual({
            scannedFileCount: 3,
            resolvedFlowCount: 1,
            unresolvedFlowCount: 1,
            highConfidenceFlowCount: 1,
            truncated: true,
            truncatedFlowCount: 1,
        })
    })

    test("applies source file path filter", async () => {
        const analyzer = new AstTypeFlowAnalyzerService()
        const result = await analyzer.analyze({
            files: [
                createParsedFile("src/types/first.ts", {
                    interfaces: [createInterface("IFirst")],
                }),
                createParsedFile("src/types/second.ts", {
                    interfaces: [createInterface("ISecond")],
                }),
                createParsedFile("src/impl/a.ts", {
                    imports: [createImport("../types/first"), createImport("../types/second")],
                    classes: [createClass("A", ["IFirst", "ISecond"])],
                }),
            ],
            filePaths: ["src/impl/a.ts"],
        })

        expect(result.flows).toHaveLength(2)
        expect(result.summary.scannedFileCount).toBe(1)
    })

    test("throws typed errors for invalid options", async () => {
        expectAstTypeFlowAnalyzerError(
            () => {
                void new AstTypeFlowAnalyzerService({
                    defaultMinimumConfidence: 2,
                })
            },
            AST_TYPE_FLOW_ANALYZER_ERROR_CODE.INVALID_MINIMUM_CONFIDENCE,
        )

        expectAstTypeFlowAnalyzerError(
            () => {
                void new AstTypeFlowAnalyzerService({
                    defaultMaxFlows: 0,
                })
            },
            AST_TYPE_FLOW_ANALYZER_ERROR_CODE.INVALID_MAX_FLOWS,
        )

        const analyzer = new AstTypeFlowAnalyzerService()

        await expectAstTypeFlowAnalyzerErrorAsync(
            async () =>
                analyzer.analyze({
                    files: [createParsedFile("src/a.ts")],
                    filePaths: [],
                }),
            AST_TYPE_FLOW_ANALYZER_ERROR_CODE.EMPTY_FILE_PATHS,
        )

        await expectAstTypeFlowAnalyzerErrorAsync(
            async () =>
                analyzer.analyze({
                    files: [createParsedFile("src/a.ts")],
                    filePaths: ["   "],
                }),
            AST_TYPE_FLOW_ANALYZER_ERROR_CODE.INVALID_FILE_PATH,
        )

        await expectAstTypeFlowAnalyzerErrorAsync(
            async () =>
                analyzer.analyze({
                    files: [createParsedFile("src/a.ts")],
                    minimumConfidence: -0.1,
                }),
            AST_TYPE_FLOW_ANALYZER_ERROR_CODE.INVALID_MINIMUM_CONFIDENCE,
        )

        await expectAstTypeFlowAnalyzerErrorAsync(
            async () =>
                analyzer.analyze({
                    files: [createParsedFile("src/a.ts")],
                    maxFlows: 0,
                }),
            AST_TYPE_FLOW_ANALYZER_ERROR_CODE.INVALID_MAX_FLOWS,
        )
    })
})
