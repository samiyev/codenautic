import {describe, expect, test} from "bun:test"

import {
    AST_JAVA_IMPORT_RESOLVER_ERROR_CODE,
    AstJavaImportResolver,
    AstJavaImportResolverError,
    type AstJavaImportResolverReadDirectory,
    type AstJavaImportResolverReadFile,
    type IAstJavaImportResolverOptions,
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
): AstJavaImportResolverReadFile {
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
): AstJavaImportResolverReadDirectory {
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
function expectJavaResolverError(
    callback: () => unknown,
    code:
        (typeof AST_JAVA_IMPORT_RESOLVER_ERROR_CODE)[keyof typeof AST_JAVA_IMPORT_RESOLVER_ERROR_CODE],
): void {
    try {
        callback()
    } catch (error) {
        expect(error).toBeInstanceOf(AstJavaImportResolverError)

        if (error instanceof AstJavaImportResolverError) {
            expect(error.code).toBe(code)
            return
        }
    }

    throw new Error("Expected AstJavaImportResolverError to be thrown")
}

/**
 * Asserts typed resolver error for async action.
 *
 * @param callback Action expected to reject.
 * @param code Expected error code.
 * @returns Promise resolved when assertion passes.
 */
async function expectJavaResolverErrorAsync(
    callback: () => Promise<unknown>,
    code:
        (typeof AST_JAVA_IMPORT_RESOLVER_ERROR_CODE)[keyof typeof AST_JAVA_IMPORT_RESOLVER_ERROR_CODE],
): Promise<void> {
    try {
        await callback()
    } catch (error) {
        expect(error).toBeInstanceOf(AstJavaImportResolverError)

        if (error instanceof AstJavaImportResolverError) {
            expect(error.code).toBe(code)
            return
        }
    }

    throw new Error("Expected AstJavaImportResolverError to be thrown")
}

/**
 * Creates resolver with repository-root defaults used by tests.
 *
 * @param overrides Optional options overrides.
 * @returns Resolver instance.
 */
function createResolver(overrides: Partial<IAstJavaImportResolverOptions>): AstJavaImportResolver {
    return new AstJavaImportResolver({
        repositoryRootPath: "repo",
        workspacePackageRoots: [],
        readFile: createReadFileFixture({}),
        readDirectory: createReadDirectoryFixture({}),
        ...overrides,
    })
}

describe("AstJavaImportResolver", () => {
    test("resolves direct and wildcard imports from classpath roots", async () => {
        const resolver = createResolver({
            readFile: createReadFileFixture({
                "repo/pom.xml": "<project><modelVersion>4.0.0</modelVersion></project>",
            }),
            readDirectory: createReadDirectoryFixture({
                "repo/src/main/java/com/acme/shared": ["ClockTest.java", "Clock.java", "README.md"],
            }),
            pathExists: (filePath) =>
                Promise.resolve(
                    filePath === "src/main/java/com/acme/shared/Clock.java" ||
                        filePath === "src/main/java/com/acme/shared/ClockTest.java",
                ),
        })

        const directResult = await resolver.resolveImport({
            sourceFilePath: "src/main/java/com/acme/app/Main.java",
            importSource: "com.acme.shared.Clock",
        })
        const wildcardResult = await resolver.resolveImport({
            sourceFilePath: "src/main/java/com/acme/app/Main.java",
            importSource: "com.acme.shared.*",
        })

        expect(directResult.resolvedFilePath).toBe("src/main/java/com/acme/shared/Clock.java")
        expect(wildcardResult.resolvedFilePath).toBe("src/main/java/com/acme/shared/Clock.java")
        expect(wildcardResult.candidateFilePaths).toContain(
            "src/main/java/com/acme/shared/ClockTest.java",
        )
    })

    test("resolves imports from nested module pom source directories", async () => {
        const resolver = createResolver({
            readFile: createReadFileFixture({
                "repo/pom.xml":
                    "<project><modules><module>packages/billing</module></modules></project>",
                "repo/packages/billing/pom.xml":
                    "<project><build><sourceDirectory>src/main/custom-java</sourceDirectory></build></project>",
            }),
            pathExists: (filePath) =>
                Promise.resolve(
                    filePath ===
                        "packages/billing/src/main/custom-java/com/acme/billing/InvoiceService.java",
                ),
        })

        const result = await resolver.resolveImport({
            sourceFilePath: "src/main/java/com/acme/app/Main.java",
            importSource: "com.acme.billing.InvoiceService",
        })

        expect(result.resolvedFilePath).toBe(
            "packages/billing/src/main/custom-java/com/acme/billing/InvoiceService.java",
        )
    })

    test("deduplicates in-flight and cached resolution by idempotency key", async () => {
        const gate = createDeferred<void>()
        let pathExistsCallCount = 0
        const resolver = createResolver({
            readFile: createReadFileFixture({
                "repo/pom.xml": "<project><modelVersion>4.0.0</modelVersion></project>",
            }),
            pathExists: async (filePath) => {
                pathExistsCallCount += 1
                await gate.promise
                return filePath === "src/main/java/com/acme/shared/Clock.java"
            },
        })

        const firstResolution = resolver.resolveImport({
            sourceFilePath: "src/main/java/com/acme/app/Main.java",
            importSource: "com.acme.shared.Clock",
            idempotencyKey: "java-same-key",
        })
        const duplicateInFlightResolution = resolver.resolveImport({
            sourceFilePath: "src/main/java/com/acme/app/Other.java",
            importSource: "com.acme.shared.Other",
            idempotencyKey: "java-same-key",
        })

        expect(firstResolution).toBe(duplicateInFlightResolution)

        gate.resolve(undefined)
        const firstResult = await firstResolution
        const callCountAfterFirstResolution = pathExistsCallCount
        const cachedResult = await resolver.resolveImport({
            sourceFilePath: "src/main/java/com/acme/app/Another.java",
            importSource: "com.acme.shared.Another",
            idempotencyKey: "java-same-key",
        })

        expect(firstResult).toEqual(cachedResult)
        expect(pathExistsCallCount).toBe(callCountAfterFirstResolution)
    })

    test("throws typed errors for invalid options and pom/directory failures", async () => {
        expectJavaResolverError(
            () => {
                void new AstJavaImportResolver({
                    repositoryRootPath: "   ",
                })
            },
            AST_JAVA_IMPORT_RESOLVER_ERROR_CODE.INVALID_REPOSITORY_ROOT_PATH,
        )

        expectJavaResolverError(
            () => {
                void new AstJavaImportResolver({
                    workspacePackageRoots: ["/absolute/workspace/root"],
                })
            },
            AST_JAVA_IMPORT_RESOLVER_ERROR_CODE.INVALID_WORKSPACE_PACKAGE_ROOT,
        )

        expectJavaResolverError(
            () => {
                void new AstJavaImportResolver({
                    classPathRoots: ["/absolute/classpath/root"],
                })
            },
            AST_JAVA_IMPORT_RESOLVER_ERROR_CODE.INVALID_CLASS_PATH_ROOT,
        )

        const invalidPomResolver = createResolver({
            readFile: createReadFileFixture({
                "repo/pom.xml": "<project>",
            }),
            pathExists: () => Promise.resolve(false),
        })
        await expectJavaResolverErrorAsync(
            async () =>
                invalidPomResolver.resolveImport({
                    sourceFilePath: "src/main/java/com/acme/app/Main.java",
                    importSource: "com.acme.shared.Clock",
                }),
            AST_JAVA_IMPORT_RESOLVER_ERROR_CODE.INVALID_POM,
        )

        const failedPomReadResolver = createResolver({
            readFile: createReadFileFixture(
                {},
                {
                    "repo/pom.xml": "Permission denied",
                },
            ),
            pathExists: () => Promise.resolve(false),
        })
        await expectJavaResolverErrorAsync(
            async () =>
                failedPomReadResolver.resolveImport({
                    sourceFilePath: "src/main/java/com/acme/app/Main.java",
                    importSource: "com.acme.shared.Clock",
                }),
            AST_JAVA_IMPORT_RESOLVER_ERROR_CODE.POM_READ_FAILED,
        )

        const failedPomDiscoveryResolver = new AstJavaImportResolver({
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
        await expectJavaResolverErrorAsync(
            async () =>
                failedPomDiscoveryResolver.resolveImport({
                    sourceFilePath: "src/main/java/com/acme/app/Main.java",
                    importSource: "com.acme.shared.Clock",
                }),
            AST_JAVA_IMPORT_RESOLVER_ERROR_CODE.POM_DISCOVERY_FAILED,
        )

        const failedPackageDiscoveryResolver = createResolver({
            classPathRoots: ["src/main/java"],
            readDirectory: createReadDirectoryFixture(
                {},
                {
                    "repo/src/main/java/com/acme/shared": "Permission denied",
                },
            ),
            pathExists: () => Promise.resolve(false),
        })
        await expectJavaResolverErrorAsync(
            async () =>
                failedPackageDiscoveryResolver.resolveImport({
                    sourceFilePath: "src/main/java/com/acme/app/Main.java",
                    importSource: "com.acme.shared.*",
                }),
            AST_JAVA_IMPORT_RESOLVER_ERROR_CODE.PACKAGE_DISCOVERY_FAILED,
        )
    })
})
