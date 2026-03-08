import { readdirSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

interface ITodoStatusMap {
    readonly [taskId: string]: string
}

function extractWebReferences(markdown: string): ReadonlyArray<string> {
    const matches = markdown.match(/`(WEB-[A-Z0-9-]+)`/g)
    if (matches === null) {
        return []
    }

    const uniqueReferences = new Set(
        matches.map((match): string => {
            return match.slice(1, -1)
        }),
    )

    return [...uniqueReferences].sort()
}

function parseTodoStatuses(markdown: string): ITodoStatusMap {
    const statusMap: Record<string, string> = {}

    markdown.split(/\r?\n/).forEach((line): void => {
        if (/^\|\s*WEB-[A-Z0-9-]+\s*\|/.test(line) === false) {
            return
        }

        const columns = line
            .split("|")
            .map((column): string => column.trim())
            .filter((column): boolean => column.length > 0)
        const taskId = columns[0]
        const status = columns[2]

        if (taskId === undefined || status === undefined) {
            return
        }

        statusMap[taskId] = status
    })

    return statusMap
}

function readTodoMarkdown(todoDirectory: string): string {
    const todoFiles = readdirSync(todoDirectory).filter((fileName): boolean =>
        fileName.endsWith(".md"),
    )

    return todoFiles
        .map((fileName): string => readFileSync(resolve(todoDirectory, fileName), "utf8"))
        .join("\n")
}

describe("scenario traceability contract", (): void => {
    it("требует, чтобы каждый WEB-* reference из SCREENS имел DONE-статус в todo", (): void => {
        const packageRoot = resolve(import.meta.dirname, "..", "..")
        const screensPath = resolve(packageRoot, "SCREENS-AND-SCENARIOS.md")
        const todoDirectory = resolve(packageRoot, "todo")

        const screensMarkdown = readFileSync(screensPath, "utf8")
        const todoMarkdown = readTodoMarkdown(todoDirectory)
        const webReferences = extractWebReferences(screensMarkdown)
        const todoStatuses = parseTodoStatuses(todoMarkdown)

        const missingReferences = webReferences.filter((taskId): boolean => {
            return todoStatuses[taskId] === undefined
        })
        const notDoneReferences = webReferences.filter((taskId): boolean => {
            const status = todoStatuses[taskId]
            return status !== undefined && status !== "DONE"
        })

        expect(missingReferences).toStrictEqual([])
        expect(notDoneReferences).toStrictEqual([])
    })
})
