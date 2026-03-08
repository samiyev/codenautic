import { readdirSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

function stripSuffix(value: string, suffix: string): string {
    return value.slice(0, value.length - suffix.length)
}

function listFileBasenames(directory: string, suffix: string): ReadonlyArray<string> {
    const items = readdirSync(directory, { withFileTypes: true })
    const fileBasenames: string[] = []

    for (const item of items) {
        if (item.isFile() === true && item.name.endsWith(suffix) === true) {
            fileBasenames.push(stripSuffix(item.name, suffix))
        }
    }

    return fileBasenames.sort()
}

describe("pages test coverage contract", (): void => {
    it("требует page-level test для каждой route page", (): void => {
        const packageRoot = resolve(import.meta.dirname, "..", "..")
        const pagesDirectory = resolve(packageRoot, "src/pages")
        const pageTestsDirectory = resolve(packageRoot, "tests/pages")

        const pageBasenames = listFileBasenames(pagesDirectory, ".page.tsx")
        const pageTestBasenames = new Set(listFileBasenames(pageTestsDirectory, ".page.test.tsx"))

        const missingPageTests = pageBasenames.filter((basename): boolean => {
            return pageTestBasenames.has(basename) === false
        })

        expect(missingPageTests).toStrictEqual([])
    })
})
