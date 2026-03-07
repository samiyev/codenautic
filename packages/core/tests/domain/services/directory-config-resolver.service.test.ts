import {describe, expect, test} from "bun:test"

import type {IDirectoryConfig} from "../../../src/domain/value-objects/directory-config.value-object"
import {DirectoryConfigResolverService} from "../../../src/domain/services/directory-config-resolver.service"

type ITestConfig = Readonly<Record<string, unknown>> & {
    readonly id: string
}

describe("DirectoryConfigResolverService", () => {
    test("returns null when no directory config matches", () => {
        const resolver = createResolver([
            {
                path: "src/core",
                config: {
                    id: "core",
                },
            },
        ])

        const result = resolver.resolve("docs/readme.md")

        expect(result).toBeNull()
    })

    test("returns null when file path is blank", () => {
        const resolver = createResolver([
            {
                path: "src/core",
                config: {
                    id: "core",
                },
            },
        ])

        const result = resolver.resolve("   ")

        expect(result).toBeNull()
    })

    test("matches exact directory and deeper paths", () => {
        const resolver = createResolver([
            {
                path: "src/core",
                config: {
                    id: "core",
                },
            },
        ])

        const exactMatch = resolver.resolve("src/core")
        const nestedMatch = resolver.resolve("src/core/index.ts")

        expect(exactMatch?.config.id).toBe("core")
        expect(nestedMatch?.config.id).toBe("core")
    })

    test("matches glob pattern overrides", () => {
        const resolver = createResolver([
            {
                path: "src/core/**",
                config: {
                    id: "glob",
                },
            },
        ])

        const match = resolver.resolve("src/core/utils/helper.ts")

        expect(match?.config.id).toBe("glob")
    })

    test("prefers more specific directory match", () => {
        const resolver = createResolver([
            {
                path: "src",
                config: {
                    id: "root",
                },
            },
            {
                path: "src/core",
                config: {
                    id: "core",
                },
            },
        ])

        const match = resolver.resolve("src/core/app.ts")

        expect(match?.config.id).toBe("core")
    })

    test("uses later config when specificity ties", () => {
        const resolver = createResolver([
            {
                path: "src/*",
                config: {
                    id: "first",
                },
            },
            {
                path: "src/*",
                config: {
                    id: "second",
                },
            },
        ])

        const match = resolver.resolve("src/app.ts")

        expect(match?.config.id).toBe("second")
    })

    test("normalizes directory path entries", () => {
        const resolver = createResolver([
            {
                path: "./src/core/",
                config: {
                    id: "normalized",
                },
            },
        ])

        const match = resolver.resolve("src/core/file.ts")

        expect(match?.config.id).toBe("normalized")
    })
})

function createResolver(
    configs: readonly IDirectoryConfig<ITestConfig>[],
): DirectoryConfigResolverService {
    return new DirectoryConfigResolverService(configs)
}
