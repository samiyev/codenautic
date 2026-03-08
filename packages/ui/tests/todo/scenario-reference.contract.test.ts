import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

interface IScenarioSection {
    readonly heading: string
    readonly body: string
    readonly lineNumber: number
}

function collectScenarioSections(markdown: string): ReadonlyArray<IScenarioSection> {
    const headingPattern = /^##\s+Сценарий\s+S\d+\s+—\s+.+$/gm
    const matches = Array.from(markdown.matchAll(headingPattern))

    return matches.map((match, index): IScenarioSection => {
        const startIndex = match.index ?? 0
        const endIndex = matches.at(index + 1)?.index ?? markdown.length
        const heading = match.at(0) ?? ""
        const lineNumber = markdown.slice(0, startIndex).split(/\r?\n/).length

        return {
            body: markdown.slice(startIndex, endIndex),
            heading,
            lineNumber,
        }
    })
}

function extractWebRefs(input: string): ReadonlyArray<string> {
    const matches = input.match(/`(WEB-[^`]+)`/g)
    if (matches === null) {
        return []
    }

    return matches
        .map((value): string => value.replaceAll("`", ""))
        .filter((value, index, list): boolean => list.indexOf(value) === index)
}

describe("SCREENS and scenarios references contract", (): void => {
    it("гарантирует, что каждый сценарий имеет WEB-референсы", (): void => {
        const filePath = resolve(process.cwd(), "SCREENS-AND-SCENARIOS.md")
        const markdown = readFileSync(filePath, "utf8")
        const sections = collectScenarioSections(markdown)

        expect(sections.length).toBeGreaterThan(0)

        const issues: Array<string> = []

        sections.forEach((section): void => {
            const refs = extractWebRefs(section.body)
            if (refs.length === 0) {
                issues.push(
                    `${section.heading} at line ${String(section.lineNumber)} has no WEB references`,
                )
            }
        })

        expect(issues).toEqual([])
    })
})
