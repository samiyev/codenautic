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
    AST_DEPENDENCY_CHAIN_RESOLVER_ERROR_CODE,
    AstDependencyChainResolverError,
    AstDependencyChainResolverService,
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
 * Creates import statement fixture.
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
 * Asserts typed dependency chain resolver error shape for synchronous action.
 *
 * @param callback Action expected to throw.
 * @param code Expected typed error code.
 */
function expectAstDependencyChainResolverError(
    callback: () => unknown,
    code:
        (typeof AST_DEPENDENCY_CHAIN_RESOLVER_ERROR_CODE)[keyof typeof AST_DEPENDENCY_CHAIN_RESOLVER_ERROR_CODE],
): void {
    try {
        callback()
    } catch (error) {
        expect(error).toBeInstanceOf(AstDependencyChainResolverError)

        if (error instanceof AstDependencyChainResolverError) {
            expect(error.code).toBe(code)
            return
        }
    }

    throw new Error("Expected AstDependencyChainResolverError to be thrown")
}

/**
 * Asserts typed dependency chain resolver error shape for async action.
 *
 * @param callback Async action expected to reject.
 * @param code Expected typed error code.
 */
async function expectAstDependencyChainResolverErrorAsync(
    callback: () => Promise<unknown>,
    code:
        (typeof AST_DEPENDENCY_CHAIN_RESOLVER_ERROR_CODE)[keyof typeof AST_DEPENDENCY_CHAIN_RESOLVER_ERROR_CODE],
): Promise<void> {
    try {
        await callback()
    } catch (error) {
        expect(error).toBeInstanceOf(AstDependencyChainResolverError)

        if (error instanceof AstDependencyChainResolverError) {
            expect(error.code).toBe(code)
            return
        }
    }

    throw new Error("Expected AstDependencyChainResolverError to be thrown")
}

describe("AstDependencyChainResolverService", () => {
    test("resolves full dependency chains for selected start files", async () => {
        const resolver = new AstDependencyChainResolverService()
        const result = await resolver.resolve({
            files: [
                createParsedFile("src/a.ts", {
                    imports: [createImport("./b")],
                }),
                createParsedFile("src/b.ts", {
                    imports: [createImport("./c")],
                }),
                createParsedFile("src/c.ts"),
                createParsedFile("src/d.ts", {
                    imports: [createImport("./c")],
                }),
            ],
            startFilePaths: ["src/a.ts", "src/d.ts"],
        })

        expect(result.chains).toEqual([
            {
                id: "src/a.ts->src/b.ts->src/c.ts",
                path: ["src/a.ts", "src/b.ts", "src/c.ts"],
                depth: 2,
            },
            {
                id: "src/d.ts->src/c.ts",
                path: ["src/d.ts", "src/c.ts"],
                depth: 1,
            },
        ])
        expect(result.summary).toEqual({
            analyzedNodeCount: 4,
            startFileCount: 2,
            targetFileCount: 0,
            chainCount: 2,
            longestChainDepth: 2,
            truncated: false,
        })
    })

    test("stops chain traversal when target file filter is reached", async () => {
        const resolver = new AstDependencyChainResolverService()
        const result = await resolver.resolve({
            files: [
                createParsedFile("src/a.ts", {
                    imports: [createImport("./b")],
                }),
                createParsedFile("src/b.ts", {
                    imports: [createImport("./c")],
                }),
                createParsedFile("src/c.ts", {
                    imports: [createImport("./d")],
                }),
                createParsedFile("src/d.ts"),
            ],
            startFilePaths: ["src/a.ts"],
            targetFilePaths: ["src/c.ts"],
        })

        expect(result.chains).toEqual([
            {
                id: "src/a.ts->src/b.ts->src/c.ts",
                path: ["src/a.ts", "src/b.ts", "src/c.ts"],
                depth: 2,
            },
        ])
        expect(result.summary.targetFileCount).toBe(1)
    })

    test("respects maximum traversal depth", async () => {
        const resolver = new AstDependencyChainResolverService()
        const result = await resolver.resolve({
            files: [
                createParsedFile("src/a.ts", {
                    imports: [createImport("./b")],
                }),
                createParsedFile("src/b.ts", {
                    imports: [createImport("./c")],
                }),
                createParsedFile("src/c.ts", {
                    imports: [createImport("./d")],
                }),
                createParsedFile("src/d.ts"),
            ],
            startFilePaths: ["src/a.ts"],
            maxDepth: 2,
        })

        expect(result.chains).toEqual([
            {
                id: "src/a.ts->src/b.ts->src/c.ts",
                path: ["src/a.ts", "src/b.ts", "src/c.ts"],
                depth: 2,
            },
        ])
    })

    test("truncates chain output by max chains limit", async () => {
        const resolver = new AstDependencyChainResolverService()
        const result = await resolver.resolve({
            files: [
                createParsedFile("src/a.ts", {
                    imports: [createImport("./b1"), createImport("./b2")],
                }),
                createParsedFile("src/b1.ts", {
                    imports: [createImport("./c1")],
                }),
                createParsedFile("src/b2.ts", {
                    imports: [createImport("./c2")],
                }),
                createParsedFile("src/c1.ts"),
                createParsedFile("src/c2.ts"),
            ],
            startFilePaths: ["src/a.ts"],
            maxChains: 1,
        })

        expect(result.chains).toEqual([
            {
                id: "src/a.ts->src/b1.ts->src/c1.ts",
                path: ["src/a.ts", "src/b1.ts", "src/c1.ts"],
                depth: 2,
            },
        ])
        expect(result.summary.truncated).toBe(true)
    })

    test("throws typed error for invalid constructor defaults", () => {
        expectAstDependencyChainResolverError(
            () => {
                void new AstDependencyChainResolverService({
                    defaultMaxDepth: 0,
                })
            },
            AST_DEPENDENCY_CHAIN_RESOLVER_ERROR_CODE.INVALID_MAX_DEPTH,
        )
    })

    test("throws typed error for invalid runtime filters and limits", async () => {
        const resolver = new AstDependencyChainResolverService()

        await expectAstDependencyChainResolverErrorAsync(
            async () =>
                resolver.resolve({
                files: [createParsedFile("src/a.ts")],
                startFilePaths: [],
            }),
            AST_DEPENDENCY_CHAIN_RESOLVER_ERROR_CODE.EMPTY_START_FILE_PATHS,
        )

        await expectAstDependencyChainResolverErrorAsync(
            async () =>
                resolver.resolve({
                files: [createParsedFile("src/a.ts")],
                targetFilePaths: ["  "],
            }),
            AST_DEPENDENCY_CHAIN_RESOLVER_ERROR_CODE.INVALID_FILE_PATH,
        )

        await expectAstDependencyChainResolverErrorAsync(
            async () =>
                resolver.resolve({
                files: [createParsedFile("src/a.ts")],
                maxChains: 0,
            }),
            AST_DEPENDENCY_CHAIN_RESOLVER_ERROR_CODE.INVALID_MAX_CHAINS,
        )
    })
})
