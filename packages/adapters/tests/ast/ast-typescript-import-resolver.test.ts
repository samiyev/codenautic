import {describe, expect, test} from "bun:test"

import {
    AST_TYPESCRIPT_IMPORT_RESOLVER_ERROR_CODE,
    AstTypeScriptImportResolver,
    AstTypeScriptImportResolverError,
    type AstTypeScriptImportResolverReadDirectory,
    type AstTypeScriptImportResolverReadFile,
    type IAstTypeScriptImportResolverOptions,
} from "../../src/ast"

interface IDeferred<TValue> {
    readonly promise: Promise<TValue>
    resolve(value: TValue): void
}

/**
 * Creates deferred fixture.
 *
 * @returns Deferred fixture.
 */
function createDeferred<TValue>(): IDeferred<TValue> {
    let resolvePromise: ((value: TValue) => void) | undefined
    const promise = new Promise<TValue>((resolve) => {
        resolvePromise = resolve
    })

    return {
        promise,
        resolve(value: TValue): void {
            if (resolvePromise !== undefined) {
                resolvePromise(value)
            }
        },
    }
}

/**
 * Creates readFile fixture from in-memory map.
 *
 * @param filesByPath File map keyed by file-system path.
 * @param failingPaths Optional failing paths map.
 * @returns readFile fixture.
 */
function createReadFileFixture(
    filesByPath: Readonly<Record<string, string>>,
    failingPaths: Readonly<Record<string, string>> = {},
): AstTypeScriptImportResolverReadFile {
    return (filePath: string): Promise<string> => {
        if (failingPaths[filePath] !== undefined) {
            const error = new Error(failingPaths[filePath])
            Object.assign(error, {
                code: "EACCES",
            })
            return Promise.reject(error)
        }

        const file = filesByPath[filePath]
        if (file !== undefined) {
            return Promise.resolve(file)
        }

        const error = new Error(`File not found: ${filePath}`)
        Object.assign(error, {
            code: "ENOENT",
        })
        return Promise.reject(error)
    }
}

/**
 * Creates readDirectory fixture from in-memory map.
 *
 * @param entriesByDirectory Directory map keyed by file-system path.
 * @returns readDirectory fixture.
 */
function createReadDirectoryFixture(
    entriesByDirectory: Readonly<Record<string, readonly string[]>>,
): AstTypeScriptImportResolverReadDirectory {
    return (directoryPath: string): Promise<readonly string[]> => {
        const entries = entriesByDirectory[directoryPath]
        if (entries !== undefined) {
            return Promise.resolve(entries)
        }

        const error = new Error(`Directory not found: ${directoryPath}`)
        Object.assign(error, {
            code: "ENOENT",
        })
        return Promise.reject(error)
    }
}

/**
 * Asserts typed resolver error for sync action.
 *
 * @param callback Action expected to throw.
 * @param code Expected error code.
 */
function expectTypeScriptResolverError(
    callback: () => unknown,
    code:
        (typeof AST_TYPESCRIPT_IMPORT_RESOLVER_ERROR_CODE)[keyof typeof AST_TYPESCRIPT_IMPORT_RESOLVER_ERROR_CODE],
): void {
    try {
        callback()
    } catch (error) {
        expect(error).toBeInstanceOf(AstTypeScriptImportResolverError)

        if (error instanceof AstTypeScriptImportResolverError) {
            expect(error.code).toBe(code)
            return
        }
    }

    throw new Error("Expected AstTypeScriptImportResolverError to be thrown")
}

/**
 * Asserts typed resolver error for async action.
 *
 * @param callback Action expected to reject.
 * @param code Expected error code.
 * @returns Promise resolved when assertion passes.
 */
async function expectTypeScriptResolverErrorAsync(
    callback: () => Promise<unknown>,
    code:
        (typeof AST_TYPESCRIPT_IMPORT_RESOLVER_ERROR_CODE)[keyof typeof AST_TYPESCRIPT_IMPORT_RESOLVER_ERROR_CODE],
): Promise<void> {
    try {
        await callback()
    } catch (error) {
        expect(error).toBeInstanceOf(AstTypeScriptImportResolverError)

        if (error instanceof AstTypeScriptImportResolverError) {
            expect(error.code).toBe(code)
            return
        }
    }

    throw new Error("Expected AstTypeScriptImportResolverError to be thrown")
}

/**
 * Creates resolver with repository-root defaults used by tests.
 *
 * @param overrides Optional options overrides.
 * @returns Resolver instance.
 */
function createResolver(
    overrides: Partial<IAstTypeScriptImportResolverOptions>,
): AstTypeScriptImportResolver {
    return new AstTypeScriptImportResolver({
        repositoryRootPath: "repo",
        workspacePackageRoots: [],
        readDirectory: createReadDirectoryFixture({}),
        ...overrides,
    })
}

describe("AstTypeScriptImportResolver", () => {
    test("resolves tsconfig paths aliases and baseUrl candidates", async () => {
        const resolver = createResolver({
            readFile: createReadFileFixture({
                "repo/tsconfig.json": JSON.stringify({
                    compilerOptions: {
                        baseUrl: ".",
                        paths: {
                            "@core/*": ["packages/core/src/*"],
                        },
                    },
                }),
            }),
            pathExists: (filePath) => Promise.resolve(filePath === "packages/core/src/math/add.ts"),
        })

        const result = await resolver.resolveImport({
            sourceFilePath: "packages/adapters/src/index.ts",
            importSource: "@core/math/add",
        })

        expect(result.isRelativeImport).toBe(false)
        expect(result.resolvedFilePath).toBe("packages/core/src/math/add.ts")
        expect(result.candidateFilePaths).toContain("packages/core/src/math/add.ts")
    })

    test("resolves workspace package exports and node_modules main entry", async () => {
        const resolver = createResolver({
            workspacePackageRoots: ["packages/shared"],
            readFile: createReadFileFixture({
                "repo/package.json": JSON.stringify({
                    name: "root",
                }),
                "repo/packages/shared/package.json": JSON.stringify({
                    name: "@codenautic/shared",
                    exports: {
                        ".": {
                            import: "./src/index.ts",
                        },
                        "./utils": "./src/utils/index.ts",
                    },
                }),
                "repo/node_modules/lodash/package.json": JSON.stringify({
                    name: "lodash",
                    main: "lodash.js",
                }),
            }),
            pathExists: (filePath) =>
                Promise.resolve(
                    filePath === "packages/shared/src/utils/index.ts" ||
                        filePath === "node_modules/lodash/lodash.js",
                ),
        })

        const workspaceResult = await resolver.resolveImport({
            sourceFilePath: "packages/adapters/src/index.ts",
            importSource: "@codenautic/shared/utils",
        })
        const nodeModulesResult = await resolver.resolveImport({
            sourceFilePath: "packages/adapters/src/index.ts",
            importSource: "lodash",
        })

        expect(workspaceResult.resolvedFilePath).toBe("packages/shared/src/utils/index.ts")
        expect(nodeModulesResult.resolvedFilePath).toBe("node_modules/lodash/lodash.js")
    })

    test("uses source fallback candidates when tsconfig and package manifests are absent", async () => {
        const resolver = createResolver({
            readFile: createReadFileFixture({}),
            sourceDirectoryCandidates: ["src", "lib"],
            pathExists: (filePath) =>
                Promise.resolve(
                    filePath === "src/features/navigation/router.ts" ||
                        filePath === "lib/features/navigation/router.ts",
                ),
        })

        const result = await resolver.resolveImport({
            sourceFilePath: "src/main.ts",
            importSource: "features/navigation/router",
        })

        expect(result.resolvedFilePath).toBe("src/features/navigation/router.ts")
        expect(result.candidateFilePaths).toContain("lib/features/navigation/router.ts")
    })

    test("deduplicates in-flight and cached resolution by idempotency key", async () => {
        const gate = createDeferred<void>()
        let pathExistsCallCount = 0
        const resolver = createResolver({
            readFile: createReadFileFixture({}),
            pathExists: async (filePath) => {
                pathExistsCallCount += 1
                await gate.promise
                return filePath === "src/shared/clock.ts"
            },
        })

        const firstResolution = resolver.resolveImport({
            sourceFilePath: "src/main.ts",
            importSource: "shared/clock",
            idempotencyKey: "same-key",
        })
        const duplicateInFlightResolution = resolver.resolveImport({
            sourceFilePath: "src/other.ts",
            importSource: "other/path",
            idempotencyKey: "same-key",
        })

        expect(firstResolution).toBe(duplicateInFlightResolution)

        gate.resolve(undefined)
        const firstResult = await firstResolution
        const callCountAfterFirstResolution = pathExistsCallCount
        const cachedResult = await resolver.resolveImport({
            sourceFilePath: "src/another.ts",
            importSource: "another/path",
            idempotencyKey: "same-key",
        })

        expect(firstResult).toEqual(cachedResult)
        expect(pathExistsCallCount).toBe(callCountAfterFirstResolution)
    })

    test("throws typed errors for invalid options and malformed config payloads", async () => {
        expectTypeScriptResolverError(
            () => {
                void new AstTypeScriptImportResolver({
                    repositoryRootPath: "   ",
                })
            },
            AST_TYPESCRIPT_IMPORT_RESOLVER_ERROR_CODE.INVALID_REPOSITORY_ROOT_PATH,
        )

        expectTypeScriptResolverError(
            () => {
                void new AstTypeScriptImportResolver({
                    workspacePackageRoots: ["/absolute/path"],
                })
            },
            AST_TYPESCRIPT_IMPORT_RESOLVER_ERROR_CODE.INVALID_WORKSPACE_PACKAGE_ROOT,
        )

        const invalidTsConfigResolver = createResolver({
            readFile: createReadFileFixture({
                "repo/tsconfig.json": "{ invalid json",
            }),
            pathExists: () => Promise.resolve(false),
        })
        await expectTypeScriptResolverErrorAsync(
            async () =>
                invalidTsConfigResolver.resolveImport({
                    sourceFilePath: "src/main.ts",
                    importSource: "unknown/module",
                }),
            AST_TYPESCRIPT_IMPORT_RESOLVER_ERROR_CODE.INVALID_TS_CONFIG,
        )

        const failedTsConfigReadResolver = createResolver({
            readFile: createReadFileFixture(
                {},
                {
                    "repo/tsconfig.json": "Permission denied",
                },
            ),
            pathExists: () => Promise.resolve(false),
        })
        await expectTypeScriptResolverErrorAsync(
            async () =>
                failedTsConfigReadResolver.resolveImport({
                    sourceFilePath: "src/main.ts",
                    importSource: "unknown/module",
                }),
            AST_TYPESCRIPT_IMPORT_RESOLVER_ERROR_CODE.TS_CONFIG_READ_FAILED,
        )

        const invalidPackageManifestResolver = createResolver({
            workspacePackageRoots: ["packages/shared"],
            readFile: createReadFileFixture({
                "repo/package.json": JSON.stringify({
                    name: "root",
                }),
                "repo/packages/shared/package.json": JSON.stringify({
                    name: "@codenautic/shared",
                    exports: 123,
                }),
            }),
            pathExists: () => Promise.resolve(false),
        })
        await expectTypeScriptResolverErrorAsync(
            async () =>
                invalidPackageManifestResolver.resolveImport({
                    sourceFilePath: "src/main.ts",
                    importSource: "@codenautic/shared",
                }),
            AST_TYPESCRIPT_IMPORT_RESOLVER_ERROR_CODE.INVALID_PACKAGE_MANIFEST,
        )
    })
})
