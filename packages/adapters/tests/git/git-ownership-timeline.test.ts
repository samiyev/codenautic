import {describe, expect, test} from "bun:test"

import type {ICommitInfo} from "@codenautic/core"

import {buildOwnershipTimeline} from "../../src/git"

/**
 * Creates one commit fixture for ownership timeline tests.
 *
 * @param sha Commit SHA.
 * @param authorName Author display name.
 * @param authorEmail Author email.
 * @param date Commit timestamp.
 * @returns Commit fixture.
 */
function createCommit(
    sha: string,
    authorName: string,
    authorEmail: string,
    date: string,
): ICommitInfo {
    return {
        sha,
        message: "commit",
        authorName,
        authorEmail,
        date,
        filesChanged: ["src/file.ts"],
    }
}

describe("buildOwnershipTimeline", () => {
    test("returns empty timeline when commit history is empty", () => {
        const timeline = buildOwnershipTimeline({
            filePath: "src/file.ts",
            commits: [],
        })

        expect(timeline.filePath).toBe("src/file.ts")
        expect(timeline.entries).toEqual([])
        expect(timeline.handoffs).toEqual([])
        expect(timeline.periods).toEqual([])
        expect(timeline.currentOwner).toBe("")
    })

    test("sorts commits chronologically before timeline construction", () => {
        const timeline = buildOwnershipTimeline({
            filePath: "src/file.ts",
            commits: [
                createCommit("c2", "Bob", "bob@example.com", "2026-03-02T10:00:00.000Z"),
                createCommit("c1", "Alice", "alice@example.com", "2026-03-01T10:00:00.000Z"),
            ],
        })

        expect(timeline.entries[0]?.commitSha).toBe("c1")
        expect(timeline.entries[1]?.commitSha).toBe("c2")
        expect(timeline.entries[1]?.totalCommits).toBe(2)
    })

    test("computes running author commit counts and ownership share", () => {
        const timeline = buildOwnershipTimeline({
            filePath: "src/file.ts",
            commits: [
                createCommit("c1", "Alice", "alice@example.com", "2026-03-01T10:00:00.000Z"),
                createCommit("c2", "Alice", "alice@example.com", "2026-03-02T10:00:00.000Z"),
                createCommit("c3", "Bob", "bob@example.com", "2026-03-03T10:00:00.000Z"),
            ],
        })

        expect(timeline.entries[0]?.authorCommitCount).toBe(1)
        expect(timeline.entries[1]?.authorCommitCount).toBe(2)
        expect(timeline.entries[2]?.authorCommitCount).toBe(1)
        expect(timeline.entries[1]?.authorOwnershipShare).toBe(1)
        expect(timeline.entries[2]?.authorOwnershipShare).toBeCloseTo(1 / 3)
    })

    test("keeps dominant owner with highest running commit count", () => {
        const timeline = buildOwnershipTimeline({
            filePath: "src/file.ts",
            commits: [
                createCommit("c1", "Alice", "alice@example.com", "2026-03-01T10:00:00.000Z"),
                createCommit("c2", "Bob", "bob@example.com", "2026-03-02T10:00:00.000Z"),
                createCommit("c3", "Alice", "alice@example.com", "2026-03-03T10:00:00.000Z"),
            ],
        })

        expect(timeline.entries[0]?.dominantOwner).toBe("Alice")
        expect(timeline.entries[1]?.dominantOwner).toBe("Bob")
        expect(timeline.entries[2]?.dominantOwner).toBe("Alice")
    })

    test("breaks dominant owner ties by last seen timestamp", () => {
        const timeline = buildOwnershipTimeline({
            filePath: "src/file.ts",
            commits: [
                createCommit("c1", "Alice", "alice@example.com", "2026-03-01T10:00:00.000Z"),
                createCommit("c2", "Bob", "bob@example.com", "2026-03-02T10:00:00.000Z"),
                createCommit("c3", "Bob", "bob@example.com", "2026-03-03T10:00:00.000Z"),
                createCommit("c4", "Alice", "alice@example.com", "2026-03-04T10:00:00.000Z"),
            ],
        })

        expect(timeline.entries[3]?.dominantOwner).toBe("Alice")
    })

    test("breaks dominant owner ties lexicographically when recency is equal", () => {
        const timeline = buildOwnershipTimeline({
            filePath: "src/file.ts",
            commits: [
                createCommit("c1", "Bob", "bob@example.com", "2026-03-01T10:00:00.000Z"),
                createCommit("c2", "Alice", "alice@example.com", "2026-03-01T10:00:00.000Z"),
            ],
        })

        expect(timeline.entries[1]?.dominantOwner).toBe("Alice")
    })

    test("emits handoff entries when dominant owner changes", () => {
        const timeline = buildOwnershipTimeline({
            filePath: "src/file.ts",
            commits: [
                createCommit("c1", "Alice", "alice@example.com", "2026-03-01T10:00:00.000Z"),
                createCommit("c2", "Bob", "bob@example.com", "2026-03-02T10:00:00.000Z"),
                createCommit("c3", "Alice", "alice@example.com", "2026-03-03T10:00:00.000Z"),
            ],
        })

        expect(timeline.handoffs).toHaveLength(2)
        expect(timeline.handoffs[0]?.fromOwner).toBe("Alice")
        expect(timeline.handoffs[0]?.toOwner).toBe("Bob")
        expect(timeline.handoffs[1]?.toOwner).toBe("Alice")
    })

    test("builds contiguous dominant-owner periods with commit counts", () => {
        const timeline = buildOwnershipTimeline({
            filePath: "src/file.ts",
            commits: [
                createCommit("c1", "Alice", "alice@example.com", "2026-03-01T10:00:00.000Z"),
                createCommit("c2", "Bob", "bob@example.com", "2026-03-02T10:00:00.000Z"),
                createCommit("c3", "Alice", "alice@example.com", "2026-03-03T10:00:00.000Z"),
                createCommit("c4", "Alice", "alice@example.com", "2026-03-04T10:00:00.000Z"),
            ],
        })

        expect(timeline.periods).toHaveLength(3)
        expect(timeline.periods[0]?.owner).toBe("Alice")
        expect(timeline.periods[0]?.commitCount).toBe(1)
        expect(timeline.periods[2]?.owner).toBe("Alice")
        expect(timeline.periods[2]?.commitCount).toBe(2)
        expect(timeline.currentOwner).toBe("Alice")
    })

    test("falls back to email when author name is empty", () => {
        const timeline = buildOwnershipTimeline({
            filePath: "src/file.ts",
            commits: [
                createCommit("c1", "", "alice@example.com", "2026-03-01T10:00:00.000Z"),
            ],
        })

        expect(timeline.entries[0]?.authorName).toBe("alice@example.com")
        expect(timeline.entries[0]?.dominantOwner).toBe("alice@example.com")
    })

    test("sorts invalid-date commits by sha tie-breaker", () => {
        const timeline = buildOwnershipTimeline({
            filePath: "src/file.ts",
            commits: [
                createCommit("b", "Bob", "bob@example.com", "not-a-date"),
                createCommit("a", "Alice", "alice@example.com", "not-a-date"),
            ],
        })

        expect(timeline.entries[0]?.commitSha).toBe("a")
        expect(timeline.entries[1]?.commitSha).toBe("b")
    })
})
