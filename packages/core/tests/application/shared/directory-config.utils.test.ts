import {describe, expect, test} from "bun:test"

import {
    buildConfigFingerprint,
    mergeConfigWithOverride,
    parseDirectoryConfigs,
} from "../../../src/application/shared/directory-config.utils"

const baseConfig = {
    severityThreshold: "LOW",
    promptOverrides: {
        categories: {
            descriptions: {
                bug: "BUG",
            },
        },
    },
    directories: [
        {
            path: "src/core",
            config: {
                severityThreshold: "HIGH",
            },
        },
    ],
} as const

describe("directory-config utils", () => {
    test("parses directory configs and filters invalid entries", () => {
        const configs = parseDirectoryConfigs({
            directories: [
                null,
                [],
                {
                    path: "src/core",
                    config: {
                        severityThreshold: "HIGH",
                    },
                },
                {
                    path: " ",
                    config: {
                        severityThreshold: "LOW",
                    },
                },
                {
                    path: 123,
                    config: {
                        severityThreshold: "LOW",
                    },
                },
                {
                    path: "src/app",
                },
                {
                    path: "src/array-config",
                    config: [],
                },
                {
                    path: "src/null-config",
                    config: null,
                },
                "invalid",
            ],
        })

        expect(configs).toHaveLength(1)
        expect(configs[0]?.path).toBe("src/core")
    })

    test("returns empty list when no directories configured", () => {
        const configs = parseDirectoryConfigs({
            severityThreshold: "LOW",
        })

        expect(configs).toEqual([])
    })

    test("deep merges directory overrides and removes directories field", () => {
        const merged = mergeConfigWithOverride(baseConfig, {
            severityThreshold: "HIGH",
            promptOverrides: {
                categories: {
                    descriptions: {
                        performance: "PERF",
                    },
                },
            },
        })

        expect(merged["directories"]).toBeUndefined()
        expect(merged["severityThreshold"]).toBe("HIGH")
        const overrides = merged["promptOverrides"] as Record<string, unknown>
        const categories = overrides["categories"] as Record<string, unknown>
        const descriptions = categories["descriptions"] as Record<string, unknown>
        expect(descriptions["bug"]).toBe("BUG")
        expect(descriptions["performance"]).toBe("PERF")
    })

    test("produces stable fingerprint regardless of key order", () => {
        const first = buildConfigFingerprint({
            b: 1,
            a: {
                z: true,
                y: [2, 1],
            },
        })
        const second = buildConfigFingerprint({
            a: {
                y: [2, 1],
                z: true,
            },
            b: 1,
        })

        expect(first).toBe(second)
    })
})
