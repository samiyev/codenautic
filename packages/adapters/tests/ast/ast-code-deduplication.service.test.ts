import {describe, expect, test} from "bun:test"

import {
    AST_FUNCTION_KIND,
    AST_IMPORT_KIND,
    AST_LANGUAGE,
    type IAstCallDTO,
    type IAstClassDTO,
    type IAstEnumDTO,
    type IAstFunctionDTO,
    type IAstImportDTO,
    type IAstInterfaceDTO,
    type IAstSourceLocationDTO,
    type IAstTypeAliasDTO,
    type IParsedSourceFileDTO,
} from "@codenautic/core"

import {
    AST_CODE_DEDUPLICATION_ERROR_CODE,
    AstCodeDeduplicationError,
    AstCodeDeduplicationService,
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
 * Creates normalized import fixture.
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
 * Creates normalized class fixture.
 *
 * @param name Class name.
 * @returns Class fixture.
 */
function createClass(name: string): IAstClassDTO {
    return {
        name,
        exported: true,
        extendsTypes: ["BaseService"],
        implementsTypes: ["IWorker"],
        location: createLocation(),
    }
}

/**
 * Creates normalized interface fixture.
 *
 * @param name Interface name.
 * @returns Interface fixture.
 */
function createInterface(name: string): IAstInterfaceDTO {
    return {
        name,
        exported: true,
        extendsTypes: [],
        location: createLocation(),
    }
}

/**
 * Creates normalized type alias fixture.
 *
 * @param name Type alias name.
 * @returns Type alias fixture.
 */
function createTypeAlias(name: string): IAstTypeAliasDTO {
    return {
        name,
        exported: true,
        location: createLocation(),
    }
}

/**
 * Creates normalized enum fixture.
 *
 * @param name Enum name.
 * @returns Enum fixture.
 */
function createEnum(name: string): IAstEnumDTO {
    return {
        name,
        exported: true,
        members: [
            "STARTED",
            "DONE",
        ],
        location: createLocation(),
    }
}

/**
 * Creates normalized function fixture.
 *
 * @param name Function name.
 * @param kind Function kind.
 * @returns Function fixture.
 */
function createFunction(name: string, kind: IAstFunctionDTO["kind"]): IAstFunctionDTO {
    return {
        name,
        kind,
        exported: true,
        async: false,
        location: createLocation(),
    }
}

/**
 * Creates normalized call fixture.
 *
 * @param callee Called symbol.
 * @param caller Calling symbol.
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
 * Creates parsed source-file fixture.
 *
 * @param filePath Repository-relative file path.
 * @param overrides Optional field overrides.
 * @returns Parsed source-file fixture.
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
 * Asserts typed deduplication error shape.
 *
 * @param callback Action expected to throw.
 * @param code Expected typed error code.
 */
function expectAstCodeDeduplicationError(
    callback: () => unknown,
    code:
        (typeof AST_CODE_DEDUPLICATION_ERROR_CODE)[keyof typeof AST_CODE_DEDUPLICATION_ERROR_CODE],
): void {
    try {
        callback()
    } catch (error) {
        expect(error).toBeInstanceOf(AstCodeDeduplicationError)

        if (error instanceof AstCodeDeduplicationError) {
            expect(error.code).toBe(code)
            return
        }
    }

    throw new Error("Expected AstCodeDeduplicationError to be thrown")
}

describe("AstCodeDeduplicationService", () => {
    test("detects duplicate files by structural AST similarity", async () => {
        const service = new AstCodeDeduplicationService()
        const files: readonly IParsedSourceFileDTO[] = [
            createParsedFile("src/a.ts", {
                imports: [
                    createImport("react"),
                    createImport("lodash"),
                ],
                classes: [createClass("UserService")],
                interfaces: [createInterface("Reviewable")],
                typeAliases: [createTypeAlias("UserPayload")],
                enums: [createEnum("ReviewStatus")],
                functions: [
                    createFunction("run", AST_FUNCTION_KIND.METHOD),
                    createFunction("transform", AST_FUNCTION_KIND.FUNCTION),
                ],
                calls: [
                    createCall("validate", "run"),
                    createCall("map", "transform"),
                ],
            }),
            createParsedFile("src/b.ts", {
                imports: [
                    createImport("react"),
                    createImport("lodash"),
                ],
                classes: [createClass("UserService")],
                interfaces: [createInterface("Reviewable")],
                typeAliases: [createTypeAlias("UserPayload")],
                enums: [createEnum("ReviewStatus")],
                functions: [
                    createFunction("run", AST_FUNCTION_KIND.METHOD),
                    createFunction("transform", AST_FUNCTION_KIND.FUNCTION),
                ],
                calls: [
                    createCall("validate", "run"),
                    createCall("map", "transform"),
                ],
            }),
            createParsedFile("src/c.ts", {
                imports: [createImport("fs")],
                functions: [createFunction("bootstrap", AST_FUNCTION_KIND.FUNCTION)],
                calls: [createCall("readFileSync", "bootstrap")],
            }),
        ]

        const result = await service.findDuplicates(files)

        expect(result.duplicatePairs).toHaveLength(1)
        expect(result.duplicatePairs[0]?.sourceFilePath).toBe("src/a.ts")
        expect(result.duplicatePairs[0]?.targetFilePath).toBe("src/b.ts")
        expect(result.duplicatePairs[0]?.similarity).toBeGreaterThanOrEqual(0.9)
        expect(result.summary).toEqual({
            comparedPairs: 3,
            duplicatePairCount: 1,
            scannedFileCount: 3,
        })
    })

    test("respects file-path filter for batch deduplication", async () => {
        const service = new AstCodeDeduplicationService()
        const files: readonly IParsedSourceFileDTO[] = [
            createParsedFile("src/a.ts", {
                imports: [createImport("react")],
                functions: [createFunction("run", AST_FUNCTION_KIND.FUNCTION)],
            }),
            createParsedFile("src/b.ts", {
                imports: [createImport("react")],
                functions: [createFunction("run", AST_FUNCTION_KIND.FUNCTION)],
            }),
            createParsedFile("src/c.ts", {
                imports: [createImport("fs")],
                functions: [createFunction("bootstrap", AST_FUNCTION_KIND.FUNCTION)],
            }),
        ]

        const result = await service.findDuplicates(files, {
            filePaths: [
                "src/a.ts",
                "src/c.ts",
            ],
        })

        expect(result.duplicatePairs).toHaveLength(0)
        expect(result.summary.comparedPairs).toBe(1)
        expect(result.summary.scannedFileCount).toBe(2)
    })

    test("returns deterministic output for repeated calls with identical input", async () => {
        const service = new AstCodeDeduplicationService({
            defaultMinimumSimilarity: 0.6,
        })
        const files: readonly IParsedSourceFileDTO[] = [
            createParsedFile("src/a.ts", {
                imports: [createImport("react")],
                functions: [createFunction("run", AST_FUNCTION_KIND.FUNCTION)],
            }),
            createParsedFile("src/b.ts", {
                imports: [createImport("react")],
                functions: [createFunction("run", AST_FUNCTION_KIND.FUNCTION)],
            }),
        ]
        const options = {
            minimumSimilarity: 0.6,
            minimumFeatureCount: 2,
        }

        const first = await service.findDuplicates(files, options)
        const second = await service.findDuplicates(files, options)

        expect(second).toEqual(first)
    })

    test("throws typed error for invalid constructor threshold", () => {
        expectAstCodeDeduplicationError(
            () => {
                void new AstCodeDeduplicationService({
                    defaultMinimumSimilarity: 2,
                })
            },
            AST_CODE_DEDUPLICATION_ERROR_CODE.INVALID_MINIMUM_SIMILARITY,
        )
    })

    test("throws typed error for invalid runtime threshold", () => {
        const service = new AstCodeDeduplicationService()

        expectAstCodeDeduplicationError(
            () => {
                void service.findDuplicates([], {
                    minimumSimilarity: -0.2,
                })
            },
            AST_CODE_DEDUPLICATION_ERROR_CODE.INVALID_MINIMUM_SIMILARITY,
        )
    })

    test("throws typed error for duplicate normalized file paths", () => {
        const service = new AstCodeDeduplicationService()

        expectAstCodeDeduplicationError(
            () => {
                void service.findDuplicates([
                    createParsedFile("src/a.ts"),
                    createParsedFile("src/a.ts"),
                ])
            },
            AST_CODE_DEDUPLICATION_ERROR_CODE.DUPLICATE_FILE_PATH,
        )
    })

    test("throws typed error for invalid file path in filter", () => {
        const service = new AstCodeDeduplicationService()

        expectAstCodeDeduplicationError(
            () => {
                void service.findDuplicates([createParsedFile("src/a.ts")], {
                    filePaths: ["  "],
                })
            },
            AST_CODE_DEDUPLICATION_ERROR_CODE.INVALID_FILE_PATH,
        )
    })

    test("throws typed error for empty file path filter set", () => {
        const service = new AstCodeDeduplicationService()

        expectAstCodeDeduplicationError(
            () => {
                void service.findDuplicates([createParsedFile("src/a.ts")], {
                    filePaths: [],
                })
            },
            AST_CODE_DEDUPLICATION_ERROR_CODE.EMPTY_FILE_PATHS,
        )
    })

    test("throws typed error for empty parsed file input", () => {
        const service = new AstCodeDeduplicationService()

        expectAstCodeDeduplicationError(
            () => {
                void service.findDuplicates([])
            },
            AST_CODE_DEDUPLICATION_ERROR_CODE.EMPTY_FILES,
        )
    })
})
