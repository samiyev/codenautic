import {describe, expect, test} from "bun:test"

import {
    AST_GO_IMPORT_RESOLVER_ERROR_CODE,
    AstGoImportResolver,
    AstGoImportResolverError,
    type AstGoImportResolverReadDirectory,
    type AstGoImportResolverReadFile,
    type IAstGoImportResolverOptions,
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
 * Creates readFile fixture from in-memory file map.
 *
 * @param filesByPath File map keyed by file-system path.
 * @param failingPaths Optional failing file paths.
 * @returns readFile fixture.
 */
function createReadFileFixture(
    filesByPath: Readonly<Record<string, string>>,
    failingPaths: Readonly<Record<string, string>> = {},
): AstGoImportResolverReadFile {
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
 * Creates readDirectory fixture from in-memory directory map.
 *
 * @param entriesByDirectory Directory map keyed by file-system path.
 * @param failingPaths Optional failing directory paths.
 * @returns readDirectory fixture.
 */
function createReadDirectoryFixture(
    entriesByDirectory: Readonly<Record<string, readonly string[]>>,
    failingPaths: Readonly<Record<string, string>> = {},
): AstGoImportResolverReadDirectory {
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
function expectGoResolverError(
    callback: () => unknown,
    code: (typeof AST_GO_IMPORT_RESOLVER_ERROR_CODE)[keyof typeof AST_GO_IMPORT_RESOLVER_ERROR_CODE],
): void {
    try {
        callback()
    } catch (error) {
        expect(error).toBeInstanceOf(AstGoImportResolverError)

        if (error instanceof AstGoImportResolverError) {
            expect(error.code).toBe(code)
            return
        }
    }

    throw new Error("Expected AstGoImportResolverError to be thrown")
}

/**
 * Asserts typed resolver error for async action.
 *
 * @param callback Action expected to reject.
 * @param code Expected error code.
 * @returns Promise resolved when assertion passes.
 */
async function expectGoResolverErrorAsync(
    callback: () => Promise<unknown>,
    code: (typeof AST_GO_IMPORT_RESOLVER_ERROR_CODE)[keyof typeof AST_GO_IMPORT_RESOLVER_ERROR_CODE],
): Promise<void> {
    try {
        await callback()
    } catch (error) {
        expect(error).toBeInstanceOf(AstGoImportResolverError)

        if (error instanceof AstGoImportResolverError) {
            expect(error.code).toBe(code)
            return
        }
    }

    throw new Error("Expected AstGoImportResolverError to be thrown")
}

/**
 * Creates resolver with repository-root defaults used by tests.
 *
 * @param overrides Optional options overrides.
 * @returns Resolver instance.
 */
function createResolver(overrides: Partial<IAstGoImportResolverOptions>): AstGoImportResolver {
    return new AstGoImportResolver({
        repositoryRootPath: "repo",
        workspacePackageRoots: [],
        readFile: createReadFileFixture({}),
        readDirectory: createReadDirectoryFixture({}),
        ...overrides,
    })
}

describe("AstGoImportResolver", () => {
    test("resolves imports from root go.mod module path", async () => {
        const resolver = createResolver({
            readFile: createReadFileFixture({
                "repo/go.mod": "module github.com/acme/project\n",
            }),
            readDirectory: createReadDirectoryFixture({
                "repo/internal/service": ["service.go", "service_test.go"],
            }),
            pathExists: (filePath) => Promise.resolve(filePath === "internal/service/service.go"),
        })

        const result = await resolver.resolveImport({
            sourceFilePath: "cmd/app/main.go",
            importSource: "github.com/acme/project/internal/service",
        })

        expect(result.isRelativeImport).toBe(false)
        expect(result.resolvedFilePath).toBe("internal/service/service.go")
        expect(result.candidateFilePaths).toContain("internal/service/service.go")
    })

    test("resolves local replace directives from go.mod", async () => {
        const resolver = createResolver({
            readFile: createReadFileFixture({
                "repo/go.mod":
                    "module github.com/acme/project\nreplace github.com/shared/lib => ./third_party/shared/lib\n",
            }),
            readDirectory: createReadDirectoryFixture({
                "repo/third_party/shared/lib/http": ["client.go"],
            }),
            pathExists: (filePath) =>
                Promise.resolve(filePath === "third_party/shared/lib/http/client.go"),
        })

        const result = await resolver.resolveImport({
            sourceFilePath: "cmd/app/main.go",
            importSource: "github.com/shared/lib/http",
        })

        expect(result.resolvedFilePath).toBe("third_party/shared/lib/http/client.go")
    })

    test("discovers workspace go modules and resolves package files", async () => {
        const resolver = new AstGoImportResolver({
            repositoryRootPath: "repo",
            readFile: createReadFileFixture({
                "repo/packages/billing/go.mod": "module github.com/acme/billing\n",
            }),
            readDirectory: createReadDirectoryFixture({
                "repo/packages": ["billing"],
                "repo/packages/billing/domain": ["aggregate.go"],
            }),
            pathExists: (filePath) =>
                Promise.resolve(filePath === "packages/billing/domain/aggregate.go"),
        })

        const result = await resolver.resolveImport({
            sourceFilePath: "cmd/app/main.go",
            importSource: "github.com/acme/billing/domain",
        })

        expect(result.resolvedFilePath).toBe("packages/billing/domain/aggregate.go")
    })

    test("deduplicates in-flight and cached resolution by idempotency key", async () => {
        const gate = createDeferred<void>()
        let pathExistsCallCount = 0
        const resolver = createResolver({
            readFile: createReadFileFixture({
                "repo/go.mod": "module github.com/acme/project\n",
            }),
            readDirectory: createReadDirectoryFixture({
                "repo/internal/clock": ["clock.go"],
            }),
            pathExists: async (filePath) => {
                pathExistsCallCount += 1
                await gate.promise
                return filePath === "internal/clock/clock.go"
            },
        })

        const firstResolution = resolver.resolveImport({
            sourceFilePath: "cmd/app/main.go",
            importSource: "github.com/acme/project/internal/clock",
            idempotencyKey: "go-same-key",
        })
        const duplicateInFlightResolution = resolver.resolveImport({
            sourceFilePath: "cmd/app/other.go",
            importSource: "github.com/acme/project/internal/other",
            idempotencyKey: "go-same-key",
        })

        expect(firstResolution).toBe(duplicateInFlightResolution)

        gate.resolve(undefined)
        const firstResult = await firstResolution
        const callCountAfterFirstResolution = pathExistsCallCount
        const cachedResult = await resolver.resolveImport({
            sourceFilePath: "cmd/app/another.go",
            importSource: "github.com/acme/project/internal/another",
            idempotencyKey: "go-same-key",
        })

        expect(firstResult).toEqual(cachedResult)
        expect(pathExistsCallCount).toBe(callCountAfterFirstResolution)
    })

    test("throws typed errors for invalid options and go.mod failures", async () => {
        expectGoResolverError(
            () => {
                void new AstGoImportResolver({
                    repositoryRootPath: "   ",
                })
            },
            AST_GO_IMPORT_RESOLVER_ERROR_CODE.INVALID_REPOSITORY_ROOT_PATH,
        )

        expectGoResolverError(
            () => {
                void new AstGoImportResolver({
                    workspacePackageRoots: ["/absolute/workspace/root"],
                })
            },
            AST_GO_IMPORT_RESOLVER_ERROR_CODE.INVALID_WORKSPACE_PACKAGE_ROOT,
        )

        const invalidGoModResolver = createResolver({
            readFile: createReadFileFixture({
                "repo/go.mod": "module \n",
            }),
            pathExists: () => Promise.resolve(false),
        })
        await expectGoResolverErrorAsync(
            async () =>
                invalidGoModResolver.resolveImport({
                    sourceFilePath: "cmd/app/main.go",
                    importSource: "github.com/acme/project/internal/service",
                }),
            AST_GO_IMPORT_RESOLVER_ERROR_CODE.INVALID_GO_MOD,
        )

        const failedGoModReadResolver = createResolver({
            readFile: createReadFileFixture(
                {},
                {
                    "repo/go.mod": "Permission denied",
                },
            ),
            pathExists: () => Promise.resolve(false),
        })
        await expectGoResolverErrorAsync(
            async () =>
                failedGoModReadResolver.resolveImport({
                    sourceFilePath: "cmd/app/main.go",
                    importSource: "github.com/acme/project/internal/service",
                }),
            AST_GO_IMPORT_RESOLVER_ERROR_CODE.GO_MOD_READ_FAILED,
        )

        const failedDiscoveryResolver = new AstGoImportResolver({
            repositoryRootPath: "repo",
            readFile: createReadFileFixture({}),
            readDirectory: createReadDirectoryFixture(
                {},
                {
                    "repo/packages": "Permission denied",
                },
            ),
            pathExists: () => Promise.resolve(false),
        })
        await expectGoResolverErrorAsync(
            async () =>
                failedDiscoveryResolver.resolveImport({
                    sourceFilePath: "cmd/app/main.go",
                    importSource: "github.com/acme/project/internal/service",
                }),
            AST_GO_IMPORT_RESOLVER_ERROR_CODE.GO_MOD_DISCOVERY_FAILED,
        )
    })
})
