import {describe, expect, test} from "bun:test"

import type {
    IFileOwnership,
    IOwnershipContributor,
} from "../../../../src/application/dto/knowledge/file-ownership.dto"
import type {IOwnershipProvider} from "../../../../src/application/ports/outbound/knowledge/ownership-provider.port"

class InMemoryOwnershipProvider implements IOwnershipProvider {
    public getFileOwnership(
        _repositoryId: string,
        filePaths: readonly string[],
    ): Promise<readonly IFileOwnership[]> {
        return Promise.resolve(
            filePaths.map((filePath): IFileOwnership => {
                return {
                    filePath,
                    primaryOwner: "Alice",
                    contributors: [
                        {
                            name: "Alice",
                            commitCount: 4,
                            lastCommitDate: "2026-03-11T12:00:00.000Z",
                            linesChanged: 120,
                        },
                    ],
                    lastModifiedBy: "Alice",
                    lastModifiedDate: "2026-03-11T12:00:00.000Z",
                    busFactor: 1,
                }
            }),
        )
    }

    public getContributors(_repositoryId: string): Promise<readonly IOwnershipContributor[]> {
        return Promise.resolve([
            {
                name: "Alice",
                email: "alice@example.com",
                commitCount: 10,
            },
            {
                name: "Bob",
                email: "bob@example.com",
                commitCount: 4,
            },
        ])
    }
}

describe("IOwnershipProvider contract", () => {
    test("returns ownership entries for requested file paths", async () => {
        const provider = new InMemoryOwnershipProvider()

        const ownership = await provider.getFileOwnership("repo-1", [
            "src/main.ts",
            "src/lib.ts",
        ])

        expect(ownership).toHaveLength(2)
        expect(ownership[0]?.filePath).toBe("src/main.ts")
        expect(ownership[1]?.contributors[0]?.name).toBe("Alice")
    })

    test("returns repository contributor summaries", async () => {
        const provider = new InMemoryOwnershipProvider()

        const contributors = await provider.getContributors("repo-1")

        expect(contributors).toHaveLength(2)
        expect(contributors[0]?.name).toBe("Alice")
        expect(contributors[1]?.commitCount).toBe(4)
    })
})
