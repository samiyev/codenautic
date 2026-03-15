import {describe, expect, test} from "bun:test"

import {
    AST_FUNCTION_KIND,
    AST_IMPORT_KIND,
    AST_LANGUAGE,
    type IAstCallDTO,
    type IAstClassDTO,
    type IAstFunctionDTO,
    type IAstImportDTO,
    type IAstInterfaceDTO,
    type IAstSourceLocationDTO,
    type IParsedSourceFileDTO,
} from "@codenautic/core"

import {
    AST_CROSS_FILE_REFERENCE_RESOLUTION_ERROR_CODE,
    AST_CROSS_FILE_REFERENCE_TYPE,
    AstCrossFileReferenceResolutionError,
    AstCrossFileReferenceResolutionService,
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
 * @returns Import DTO.
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
 * Creates class fixture.
 *
 * @param name Class name.
 * @param extendsTypes Extended types.
 * @returns Class DTO.
 */
function createClass(name: string, extendsTypes: readonly string[] = []): IAstClassDTO {
    return {
        name,
        exported: true,
        extendsTypes,
        implementsTypes: [],
        location: createLocation(),
    }
}

/**
 * Creates interface fixture.
 *
 * @param name Interface name.
 * @param extendsTypes Extended interfaces.
 * @returns Interface DTO.
 */
function createInterface(name: string, extendsTypes: readonly string[] = []): IAstInterfaceDTO {
    return {
        name,
        exported: true,
        extendsTypes,
        location: createLocation(),
    }
}

/**
 * Creates function fixture.
 *
 * @param name Function name.
 * @returns Function DTO.
 */
function createFunction(name: string): IAstFunctionDTO {
    return {
        name,
        kind: AST_FUNCTION_KIND.FUNCTION,
        exported: true,
        async: false,
        location: createLocation(),
    }
}

/**
 * Creates call fixture.
 *
 * @param callee Called symbol.
 * @returns Call DTO.
 */
function createCall(callee: string): IAstCallDTO {
    return {
        callee,
        location: createLocation(),
    }
}

/**
 * Creates parsed file fixture.
 *
 * @param filePath Repository-relative file path.
 * @param overrides Optional field overrides.
 * @returns Parsed file DTO.
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
 * Asserts typed cross-file resolution error shape.
 *
 * @param callback Action expected to throw.
 * @param code Expected typed error code.
 */
function expectAstCrossFileReferenceResolutionError(
    callback: () => unknown,
    code:
        (typeof AST_CROSS_FILE_REFERENCE_RESOLUTION_ERROR_CODE)[keyof typeof AST_CROSS_FILE_REFERENCE_RESOLUTION_ERROR_CODE],
): void {
    try {
        callback()
    } catch (error) {
        expect(error).toBeInstanceOf(AstCrossFileReferenceResolutionError)

        if (error instanceof AstCrossFileReferenceResolutionError) {
            expect(error.code).toBe(code)
            return
        }
    }

    throw new Error("Expected AstCrossFileReferenceResolutionError to be thrown")
}

describe("AstCrossFileReferenceResolutionService", () => {
    test("resolves cross-file import, call, and type references", async () => {
        const service = new AstCrossFileReferenceResolutionService()
        const result = await service.resolve([
            createParsedFile("src/a.ts", {
                classes: [createClass("BaseService")],
                functions: [createFunction("run")],
            }),
            createParsedFile("src/b.ts", {
                imports: [createImport("./a")],
                classes: [createClass("WorkerService", ["BaseService"])],
                interfaces: [createInterface("WorkerContract", ["BaseService"])],
                functions: [createFunction("runWorker")],
                calls: [createCall("run")],
            }),
        ])

        expect(result.references.map((reference) => reference.type)).toEqual([
            AST_CROSS_FILE_REFERENCE_TYPE.CALL,
            AST_CROSS_FILE_REFERENCE_TYPE.IMPORT,
            AST_CROSS_FILE_REFERENCE_TYPE.TYPE,
        ])
        expect(result.references.map((reference) => reference.sourceFilePath)).toEqual([
            "src/b.ts",
            "src/b.ts",
            "src/b.ts",
        ])
        expect(result.references.map((reference) => reference.targetFilePath)).toEqual([
            "src/a.ts",
            "src/a.ts",
            "src/a.ts",
        ])
        expect(result.summary.resolvedReferenceCount).toBe(3)
        expect(result.summary.unresolvedReferenceCount).toBe(0)
        expect(result.summary.byType).toEqual({
            CALL: 1,
            IMPORT: 1,
            TYPE: 1,
        })
    })

    test("uses import context to disambiguate call targets", async () => {
        const service = new AstCrossFileReferenceResolutionService()
        const result = await service.resolve([
            createParsedFile("src/a.ts", {
                functions: [createFunction("execute")],
            }),
            createParsedFile("src/c.ts", {
                functions: [createFunction("execute")],
            }),
            createParsedFile("src/b.ts", {
                imports: [createImport("./a")],
                calls: [createCall("execute")],
            }),
        ])

        const callReference = result.references.find(
            (reference) => reference.type === AST_CROSS_FILE_REFERENCE_TYPE.CALL,
        )

        expect(callReference?.targetFilePath).toBe("src/a.ts")
    })

    test("respects source file-path batch filter", async () => {
        const service = new AstCrossFileReferenceResolutionService()
        const result = await service.resolve(
            [
                createParsedFile("src/a.ts", {
                    functions: [createFunction("run")],
                }),
                createParsedFile("src/b.ts", {
                    imports: [createImport("./a")],
                    calls: [createCall("run")],
                }),
                createParsedFile("src/c.ts", {
                    imports: [createImport("./a")],
                    calls: [createCall("run")],
                }),
            ],
            {
                filePaths: ["src/b.ts"],
            },
        )

        expect(result.references.every((reference) => reference.sourceFilePath === "src/b.ts")).toBe(
            true,
        )
    })

    test("returns deterministic output for repeated runs", async () => {
        const service = new AstCrossFileReferenceResolutionService()
        const files = [
            createParsedFile("src/a.ts", {
                functions: [createFunction("run")],
            }),
            createParsedFile("src/b.ts", {
                imports: [createImport("./a")],
                calls: [createCall("run")],
            }),
        ]

        const first = await service.resolve(files)
        const second = await service.resolve(files)

        expect(second).toEqual(first)
    })

    test("collects unresolved references with deterministic ordering and deduplication", async () => {
        const service = new AstCrossFileReferenceResolutionService()
        const result = await service.resolve(
            [
                createParsedFile("src/a.ts", {
                    functions: [createFunction("run")],
                    classes: [createClass("BaseContract")],
                }),
                createParsedFile("src/c.ts", {
                    functions: [createFunction("run")],
                    classes: [createClass("BaseContract")],
                }),
                createParsedFile("src/b.ts", {
                    imports: [createImport("./missing"), createImport("./missing")],
                    calls: [createCall("run"), createCall("run")],
                    classes: [createClass("Worker", ["BaseContract"])],
                    interfaces: [createInterface("WorkerContract", ["BaseContract"])],
                }),
            ],
            {
                maxCandidatesPerReference: 1,
            },
        )

        expect(result.references).toEqual([])
        expect(result.unresolvedReferences.map((reference) => reference.type)).toEqual([
            AST_CROSS_FILE_REFERENCE_TYPE.CALL,
            AST_CROSS_FILE_REFERENCE_TYPE.IMPORT,
            AST_CROSS_FILE_REFERENCE_TYPE.TYPE,
        ])
        expect(result.unresolvedReferences.map((reference) => reference.reason)).toEqual([
            "AMBIGUOUS_SYMBOL",
            "RELATIVE_IMPORT_NOT_FOUND",
            "AMBIGUOUS_SYMBOL",
        ])
        expect(
            result.unresolvedReferences.map((reference) => reference.candidateFilePaths.length),
        ).toEqual([1, 24, 1])
        expect(result.summary.resolvedReferenceCount).toBe(0)
        expect(result.summary.unresolvedReferenceCount).toBe(3)
    })

    test("throws typed error for invalid constructor thresholds", () => {
        expectAstCrossFileReferenceResolutionError(
            () => {
                void new AstCrossFileReferenceResolutionService({
                    defaultMinimumConfidence: 2,
                })
            },
            AST_CROSS_FILE_REFERENCE_RESOLUTION_ERROR_CODE.INVALID_MINIMUM_CONFIDENCE,
        )
    })

    test("throws typed error for invalid max candidates threshold", () => {
        expectAstCrossFileReferenceResolutionError(
            () => {
                void new AstCrossFileReferenceResolutionService({
                    defaultMaxCandidatesPerReference: 0,
                })
            },
            AST_CROSS_FILE_REFERENCE_RESOLUTION_ERROR_CODE.INVALID_MAX_CANDIDATES_PER_REFERENCE,
        )
    })

    test("throws typed error for duplicate normalized file paths", () => {
        const service = new AstCrossFileReferenceResolutionService()

        expectAstCrossFileReferenceResolutionError(
            () => {
                void service.resolve([
                    createParsedFile("src/a.ts"),
                    createParsedFile("src/a.ts"),
                ])
            },
            AST_CROSS_FILE_REFERENCE_RESOLUTION_ERROR_CODE.DUPLICATE_FILE_PATH,
        )
    })

    test("throws typed error for invalid file path filter", () => {
        const service = new AstCrossFileReferenceResolutionService()

        expectAstCrossFileReferenceResolutionError(
            () => {
                void service.resolve([createParsedFile("src/a.ts")], {
                    filePaths: ["   "],
                })
            },
            AST_CROSS_FILE_REFERENCE_RESOLUTION_ERROR_CODE.INVALID_FILE_PATH,
        )
    })

    test("throws typed error for empty input file set", () => {
        const service = new AstCrossFileReferenceResolutionService()

        expectAstCrossFileReferenceResolutionError(
            () => {
                void service.resolve([])
            },
            AST_CROSS_FILE_REFERENCE_RESOLUTION_ERROR_CODE.EMPTY_FILES,
        )
    })
})
