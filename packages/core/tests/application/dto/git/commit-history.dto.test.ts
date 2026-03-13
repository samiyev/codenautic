import {describe, expect, test} from "bun:test"

import {type ICommitHistoryOptions, type ICommitInfo} from "../../../../src/application/dto/git"

describe("ICommitHistory DTO contracts", () => {
    test("поддерживает информацию о коммите и его метаданных", () => {
        const commit: ICommitInfo = {
            sha: "abc123",
            message: "Add repository history support",
            authorName: "Alice",
            authorEmail: "alice@example.com",
            date: "2026-03-03T08:00:00.000Z",
            filesChanged: ["src/index.ts", "src/main.ts"],
        }

        expect(commit.sha).toBe("abc123")
        expect(commit.filesChanged).toHaveLength(2)
        expect(commit.filesChanged[0]).toBe("src/index.ts")
        expect(commit.authorEmail).toBe("alice@example.com")
    })

    test("поддерживает опции запроса истории", () => {
        const options: ICommitHistoryOptions = {
            author: "alice",
            since: "2026-01-01T00:00:00.000Z",
            until: "2026-03-03T00:00:00.000Z",
            maxCount: 25,
            path: "src/features",
            filePath: "src/index.ts",
        }

        expect(options.author).toBe("alice")
        expect(options.maxCount).toBe(25)
        expect(options.path).toBe("src/features")
        expect(options.filePath).toBe("src/index.ts")
    })
})
