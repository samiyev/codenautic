import {describe, expect, test} from "bun:test"

import type {
    IFileOwnership,
    IFileOwnershipContributor,
    IOwnershipContributor,
} from "../../../../src/application/dto/knowledge/file-ownership.dto"

describe("IFileOwnership DTO contracts", () => {
    test("поддерживает ownership snapshot с bus factor и contributors", () => {
        const contributors: readonly IFileOwnershipContributor[] = [
            {
                name: "Alice",
                commitCount: 7,
                lastCommitDate: "2026-03-10T12:00:00.000Z",
                linesChanged: 180,
            },
            {
                name: "Bob",
                commitCount: 3,
                lastCommitDate: "2026-03-08T09:30:00.000Z",
                linesChanged: 70,
            },
        ]
        const ownership: IFileOwnership = {
            filePath: "src/services/review.ts",
            primaryOwner: "Alice",
            contributors,
            lastModifiedBy: "Alice",
            lastModifiedDate: "2026-03-10T12:00:00.000Z",
            busFactor: 1,
        }

        expect(ownership.filePath).toBe("src/services/review.ts")
        expect(ownership.primaryOwner).toBe("Alice")
        expect(ownership.contributors).toHaveLength(2)
        expect(ownership.contributors[1]?.linesChanged).toBe(70)
        expect(ownership.busFactor).toBe(1)
    })

    test("поддерживает contributor summary для ownership provider", () => {
        const contributors: readonly IOwnershipContributor[] = [
            {
                name: "Alice",
                email: "alice@example.com",
                commitCount: 12,
            },
            {
                name: "Bob",
                email: "bob@example.com",
                commitCount: 5,
            },
        ]

        expect(contributors[0]?.name).toBe("Alice")
        expect(contributors[0]?.email).toBe("alice@example.com")
        expect(contributors[1]?.commitCount).toBe(5)
    })
})
