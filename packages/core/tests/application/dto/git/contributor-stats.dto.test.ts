import {describe, expect, test} from "bun:test"

import {
    type IContributorStat,
    type IContributorStatsOptions,
} from "../../../../src/application/dto/git"

describe("IContributorStat DTO contracts", () => {
    test("поддерживает агрегированные contributor statistics и file breakdown", () => {
        const contributor: IContributorStat = {
            name: "Alice",
            email: "alice@example.com",
            commitCount: 3,
            additions: 18,
            deletions: 7,
            changes: 25,
            activePeriod: {
                startedAt: "2026-03-01T09:00:00.000Z",
                endedAt: "2026-03-08T18:00:00.000Z",
            },
            files: [
                {
                    filePath: "src/app.ts",
                    commitCount: 2,
                    additions: 12,
                    deletions: 4,
                    changes: 16,
                    lastCommitDate: "2026-03-08T18:00:00.000Z",
                },
                {
                    filePath: "src/lib.ts",
                    commitCount: 1,
                    additions: 6,
                    deletions: 3,
                    changes: 9,
                    lastCommitDate: "2026-03-04T12:00:00.000Z",
                },
            ],
        }

        expect(contributor.commitCount).toBe(3)
        expect(contributor.activePeriod.startedAt).toBe("2026-03-01T09:00:00.000Z")
        expect(contributor.files[0]?.filePath).toBe("src/app.ts")
        expect(contributor.files[1]?.changes).toBe(9)
    })

    test("поддерживает опции запроса contributor statistics", () => {
        const options: IContributorStatsOptions = {
            since: "2026-01-01T00:00:00.000Z",
            until: "2026-03-03T00:00:00.000Z",
            maxCount: 50,
            path: "src/features",
            filePath: "src/index.ts",
        }

        expect(options.maxCount).toBe(50)
        expect(options.path).toBe("src/features")
        expect(options.filePath).toBe("src/index.ts")
    })
})
