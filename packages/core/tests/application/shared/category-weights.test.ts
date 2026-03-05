import {readFileSync} from "node:fs"
import {resolve} from "node:path"

import {describe, expect, test} from "bun:test"

import {CATEGORY_WEIGHTS} from "../../../src/application/shared/category-weights"

interface ISettingsItem {
    readonly key: string
    readonly value: Record<string, number>
}

interface ISettingsFile {
    readonly items: readonly ISettingsItem[]
}

interface ICategoryItem {
    readonly slug: string
    readonly weight: number
}

interface ICategoryFile {
    readonly items: readonly ICategoryItem[]
}

function normalizeCategoryKey(category: string): string {
    return category
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "_")
        .replace(/_+/g, "_")
}

function readSettingsDefaults(): ISettingsFile {
    const settingsPath = resolve(
        process.cwd(),
        "../runtime/src/config/defaults/settings.json",
    )
    return JSON.parse(readFileSync(settingsPath, "utf8")) as ISettingsFile
}

function readCategoryDefaults(): ICategoryFile {
    const categoriesPath = resolve(
        process.cwd(),
        "../runtime/src/config/defaults/categories.json",
    )
    return JSON.parse(readFileSync(categoriesPath, "utf8")) as ICategoryFile
}

describe("CATEGORY_WEIGHTS", () => {
    test("includes llm category weights from defaults", () => {
        const settings = readSettingsDefaults()
        const entry = settings.items.find((item) => item.key === "llm_category_weights")
        if (entry === undefined) {
            throw new Error("llm_category_weights entry missing in settings defaults")
        }

        for (const [key, value] of Object.entries(entry.value)) {
            const normalized = normalizeCategoryKey(key)
            expect(CATEGORY_WEIGHTS[normalized]).toBe(value)
        }
    })

    test("includes config category weights from defaults", () => {
        const categories = readCategoryDefaults()
        for (const item of categories.items) {
            const normalized = normalizeCategoryKey(item.slug)
            expect(CATEGORY_WEIGHTS[normalized]).toBe(item.weight)
        }
    })

    test("includes stack category keys", () => {
        const categories = readCategoryDefaults()
        const stacks = categories.items.filter((item) => item.slug.startsWith("stack-"))
        expect(stacks).toHaveLength(7)

        for (const item of stacks) {
            const normalized = normalizeCategoryKey(item.slug)
            expect(CATEGORY_WEIGHTS[normalized]).toBe(0)
        }
    })

    test("normalizes hyphenated keys into underscore weights", () => {
        expect(CATEGORY_WEIGHTS["breaking_change"]).toBe(18)
        expect(CATEGORY_WEIGHTS["style_conventions"]).toBe(3)
    })
})
