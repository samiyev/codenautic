import {describe, expect, test} from "bun:test"

import {FilePath} from "../../../src/domain/value-objects/file-path.value-object"

describe("FilePath", () => {
    test("normalizes slashes and trims spaces", () => {
        const filePath = FilePath.create("  src\\domain\\review.aggregate.ts  ")

        expect(filePath.toString()).toBe("src/domain/review.aggregate.ts")
    })

    test("throws for empty path", () => {
        expect(() => {
            FilePath.create("   ")
        }).toThrow("FilePath cannot be empty")
    })

    test("returns extension, fileName and directory", () => {
        const filePath = FilePath.create("src/domain/review.aggregate.ts")

        expect(filePath.extension()).toBe(".ts")
        expect(filePath.fileName()).toBe("review.aggregate.ts")
        expect(filePath.directory()).toBe("src/domain")
    })

    test("returns empty extension for extensionless file", () => {
        const filePath = FilePath.create("Dockerfile")

        expect(filePath.extension()).toBe("")
        expect(filePath.fileName()).toBe("Dockerfile")
        expect(filePath.directory()).toBe("")
    })

    test("matches glob patterns", () => {
        const filePath = FilePath.create("src/domain/review.aggregate.ts")

        expect(filePath.matchesGlob("src/**/*.ts")).toBe(true)
        expect(filePath.matchesGlob("src/domain/*.ts")).toBe(true)
        expect(filePath.matchesGlob("src/domain/*.js")).toBe(false)
        expect(filePath.matchesGlob("**/*.aggregate.t?")).toBe(true)
    })

    test("supports glob patterns with windows separators", () => {
        const filePath = FilePath.create("src/domain/review.aggregate.ts")

        expect(filePath.matchesGlob("src\\**\\*.ts")).toBe(true)
    })

    test("returns false for empty glob pattern", () => {
        const filePath = FilePath.create("src/domain/review.aggregate.ts")

        expect(filePath.matchesGlob("   ")).toBe(false)
    })
})
