import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

interface IScenarioSection {
    readonly heading: string
    readonly lineNumber: number
    readonly body: string
}

function collectScenarioSections(markdown: string): ReadonlyArray<IScenarioSection> {
    const headingPattern = /^##\s+Сценарий\s+S\d+\s+—\s+.+$/gm
    const matches = Array.from(markdown.matchAll(headingPattern))

    return matches.map((match, index): IScenarioSection => {
        const startIndex = match.index ?? 0
        const endIndex = matches.at(index + 1)?.index ?? markdown.length

        return {
            body: markdown.slice(startIndex, endIndex),
            heading: match.at(0) ?? "",
            lineNumber: markdown.slice(0, startIndex).split(/\r?\n/).length,
        }
    })
}

describe("SCREENS and scenarios metadata contract", (): void => {
    it("гарантирует, что каждый сценарий содержит цель, экраны и референсы", (): void => {
        const filePath = resolve(process.cwd(), "SCREENS-AND-SCENARIOS.md")
        const markdown = readFileSync(filePath, "utf8")
        const sections = collectScenarioSections(markdown)

        expect(sections.length).toBeGreaterThan(0)

        const issues: Array<string> = []

        sections.forEach((section): void => {
            if (/^- Цель:/m.test(section.body) === false) {
                issues.push(`${section.heading} at line ${String(section.lineNumber)} is missing goal metadata`)
            }
            if (/^- Экраны:/m.test(section.body) === false) {
                issues.push(`${section.heading} at line ${String(section.lineNumber)} is missing screens metadata`)
            }
            if (/^- Референсы:/m.test(section.body) === false) {
                issues.push(
                    `${section.heading} at line ${String(section.lineNumber)} is missing references metadata`,
                )
            }
        })

        expect(issues).toEqual([])
    })
})
