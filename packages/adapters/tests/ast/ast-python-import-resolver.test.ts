import {describe, expect, test} from "bun:test"

import {
    AST_PYTHON_IMPORT_RESOLVER_ERROR_CODE,
    AstPythonImportResolver,
    AstPythonImportResolverError,
    type AstPythonImportResolverReadDirectory,
    type IAstPythonImportResolverOptions,
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
 * Creates readDirectory fixture from in-memory map.
 *
 * @param entriesByDirectory Directory map keyed by file-system path.
 * @param failingPaths Optional failing paths map.
 * @returns readDirectory fixture.
 */
function createReadDirectoryFixture(
    entriesByDirectory: Readonly<Record<string, readonly string[]>>,
    failingPaths: Readonly<Record<string, string>> = {},
): AstPythonImportResolverReadDirectory {
    return (directoryPath: string): Promise<readonly string[]> => {
        if (failingPaths[directoryPath] !== undefined) {
            const error = new Error(failingPaths[directoryPath])
            Object.assign(error, {
                code: "EACCES",
            })
            return Promise.reject(error)
        }

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
function expectPythonResolverError(
    callback: () => unknown,
    code: (typeof AST_PYTHON_IMPORT_RESOLVER_ERROR_CODE)[keyof typeof AST_PYTHON_IMPORT_RESOLVER_ERROR_CODE],
): void {
    try {
        callback()
    } catch (error) {
        expect(error).toBeInstanceOf(AstPythonImportResolverError)

        if (error instanceof AstPythonImportResolverError) {
            expect(error.code).toBe(code)
            return
        }
    }

    throw new Error("Expected AstPythonImportResolverError to be thrown")
}

/**
 * Asserts typed resolver error for async action.
 *
 * @param callback Action expected to reject.
 * @param code Expected error code.
 * @returns Promise resolved when assertion passes.
 */
async function expectPythonResolverErrorAsync(
    callback: () => Promise<unknown>,
    code: (typeof AST_PYTHON_IMPORT_RESOLVER_ERROR_CODE)[keyof typeof AST_PYTHON_IMPORT_RESOLVER_ERROR_CODE],
): Promise<void> {
    try {
        await callback()
    } catch (error) {
        expect(error).toBeInstanceOf(AstPythonImportResolverError)

        if (error instanceof AstPythonImportResolverError) {
            expect(error.code).toBe(code)
            return
        }
    }

    throw new Error("Expected AstPythonImportResolverError to be thrown")
}

/**
 * Creates resolver with repository-root defaults used by tests.
 *
 * @param overrides Optional options overrides.
 * @returns Resolver instance.
 */
function createResolver(
    overrides: Partial<IAstPythonImportResolverOptions>,
): AstPythonImportResolver {
    return new AstPythonImportResolver({
        repositoryRootPath: "repo",
        workspacePackageRoots: [],
        readDirectory: createReadDirectoryFixture({}),
        ...overrides,
    })
}

describe("AstPythonImportResolver", () => {
    test("resolves module imports through explicit pythonPath roots", async () => {
        const resolver = createResolver({
            pythonPathRoots: ["python"],
            pathExists: (filePath) => Promise.resolve(filePath === "python/app/service.py"),
        })

        const result = await resolver.resolveImport({
            sourceFilePath: "src/main.py",
            importSource: "app.service",
        })

        expect(result.isRelativeImport).toBe(false)
        expect(result.resolvedFilePath).toBe("python/app/service.py")
        expect(result.candidateFilePaths).toContain("python/app/service.py")
    })

    test("resolves package __init__.py for absolute and relative imports", async () => {
        const resolver = createResolver({
            sourceDirectoryCandidates: ["src"],
            pathExists: (filePath) => Promise.resolve(filePath === "src/pkg/subpkg/__init__.py"),
        })

        const absoluteImportResult = await resolver.resolveImport({
            sourceFilePath: "src/main.py",
            importSource: "pkg.subpkg",
        })
        const relativeImportResult = await resolver.resolveImport({
            sourceFilePath: "src/pkg/module.py",
            importSource: ".subpkg",
        })

        expect(absoluteImportResult.resolvedFilePath).toBe("src/pkg/subpkg/__init__.py")
        expect(relativeImportResult.resolvedFilePath).toBe("src/pkg/subpkg/__init__.py")
    })

    test("discovers workspace package roots and resolves import under package src", async () => {
        const resolver = new AstPythonImportResolver({
            repositoryRootPath: "repo",
            readDirectory: createReadDirectoryFixture({
                "repo/packages": ["analytics"],
            }),
            pathExists: (filePath) =>
                Promise.resolve(filePath === "packages/analytics/src/domain/model.py"),
        })

        const result = await resolver.resolveImport({
            sourceFilePath: "src/main.py",
            importSource: "domain.model",
        })

        expect(result.resolvedFilePath).toBe("packages/analytics/src/domain/model.py")
    })

    test("deduplicates in-flight and cached resolution by idempotency key", async () => {
        const gate = createDeferred<void>()
        let pathExistsCallCount = 0
        const resolver = createResolver({
            pathExists: async (filePath) => {
                pathExistsCallCount += 1
                await gate.promise
                return filePath === "src/core/clock.py"
            },
        })

        const firstResolution = resolver.resolveImport({
            sourceFilePath: "src/main.py",
            importSource: "core.clock",
            idempotencyKey: "python-same-key",
        })
        const duplicateInFlightResolution = resolver.resolveImport({
            sourceFilePath: "src/ignored.py",
            importSource: "ignored.path",
            idempotencyKey: "python-same-key",
        })

        expect(firstResolution).toBe(duplicateInFlightResolution)

        gate.resolve(undefined)
        const firstResult = await firstResolution
        const callCountAfterFirstResolution = pathExistsCallCount
        const cachedResult = await resolver.resolveImport({
            sourceFilePath: "src/another.py",
            importSource: "another.path",
            idempotencyKey: "python-same-key",
        })

        expect(firstResult).toEqual(cachedResult)
        expect(pathExistsCallCount).toBe(callCountAfterFirstResolution)
    })

    test("throws typed errors for invalid options and workspace discovery failures", async () => {
        expectPythonResolverError(
            () => {
                void new AstPythonImportResolver({
                    repositoryRootPath: "   ",
                })
            },
            AST_PYTHON_IMPORT_RESOLVER_ERROR_CODE.INVALID_REPOSITORY_ROOT_PATH,
        )

        expectPythonResolverError(
            () => {
                void new AstPythonImportResolver({
                    pythonPathRoots: ["/external/python/lib"],
                })
            },
            AST_PYTHON_IMPORT_RESOLVER_ERROR_CODE.INVALID_PYTHON_PATH_ROOT,
        )

        const failingDiscoveryResolver = new AstPythonImportResolver({
            repositoryRootPath: "repo",
            readDirectory: createReadDirectoryFixture(
                {},
                {
                    "repo/packages": "Permission denied",
                },
            ),
            pathExists: () => Promise.resolve(false),
        })

        await expectPythonResolverErrorAsync(
            async () =>
                failingDiscoveryResolver.resolveImport({
                    sourceFilePath: "src/main.py",
                    importSource: "domain.model",
                }),
            AST_PYTHON_IMPORT_RESOLVER_ERROR_CODE.PYTHON_PATH_DISCOVERY_FAILED,
        )
    })
})
