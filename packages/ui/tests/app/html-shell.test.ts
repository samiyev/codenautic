import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

const UI_PACKAGE_ROOT = path.resolve(__dirname, "../..")
const HTML_SHELL_PATH = path.join(UI_PACKAGE_ROOT, "index.html")

describe("html shell", (): void => {
    it("не дублирует security headers через meta http-equiv", (): void => {
        const htmlShell = readFileSync(HTML_SHELL_PATH, "utf8")

        expect(htmlShell.includes('http-equiv="Content-Security-Policy"')).toBe(false)
        expect(htmlShell.includes('http-equiv="X-Frame-Options"')).toBe(false)
        expect(htmlShell.includes('http-equiv="Strict-Transport-Security"')).toBe(false)
    })

    it("объявляет favicon через public asset", (): void => {
        const htmlShell = readFileSync(HTML_SHELL_PATH, "utf8")

        expect(htmlShell.includes('href="/favicon.svg"')).toBe(true)
        expect(htmlShell.includes('rel="icon"')).toBe(true)
    })
})
