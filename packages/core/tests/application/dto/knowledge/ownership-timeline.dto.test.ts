import {describe, expect, test} from "bun:test"

import type {
    IOwnershipHandoff,
    IOwnershipPeriod,
    IOwnershipTimeline,
    IOwnershipTimelineEntry,
} from "../../../../src/application/dto/knowledge/ownership-timeline.dto"

describe("IOwnershipTimeline DTO contracts", () => {
    test("поддерживает timeline entries c running ownership snapshot", () => {
        const entries: readonly IOwnershipTimelineEntry[] = [
            {
                commitSha: "c1",
                committedAt: "2026-03-01T10:00:00.000Z",
                authorName: "Alice",
                authorEmail: "alice@example.com",
                totalCommits: 1,
                authorCommitCount: 1,
                authorOwnershipShare: 1,
                dominantOwner: "Alice",
                isHandoff: false,
            },
            {
                commitSha: "c2",
                committedAt: "2026-03-02T10:00:00.000Z",
                authorName: "Bob",
                authorEmail: "bob@example.com",
                totalCommits: 2,
                authorCommitCount: 1,
                authorOwnershipShare: 0.5,
                dominantOwner: "Alice",
                isHandoff: false,
            },
        ]

        expect(entries[0]?.authorOwnershipShare).toBe(1)
        expect(entries[1]?.totalCommits).toBe(2)
        expect(entries[1]?.dominantOwner).toBe("Alice")
    })

    test("поддерживает handoffs и periods в одном timeline", () => {
        const handoffs: readonly IOwnershipHandoff[] = [
            {
                fromOwner: "Alice",
                toOwner: "Bob",
                commitSha: "c5",
                committedAt: "2026-03-05T10:00:00.000Z",
            },
        ]
        const periods: readonly IOwnershipPeriod[] = [
            {
                owner: "Alice",
                startedAt: "2026-03-01T10:00:00.000Z",
                endedAt: "2026-03-04T10:00:00.000Z",
                commitCount: 4,
            },
            {
                owner: "Bob",
                startedAt: "2026-03-05T10:00:00.000Z",
                endedAt: "2026-03-06T10:00:00.000Z",
                commitCount: 2,
            },
        ]
        const timeline: IOwnershipTimeline = {
            filePath: "src/git/provider.ts",
            entries: [],
            handoffs,
            periods,
            currentOwner: "Bob",
        }

        expect(timeline.handoffs[0]?.toOwner).toBe("Bob")
        expect(timeline.periods[0]?.commitCount).toBe(4)
        expect(timeline.currentOwner).toBe("Bob")
    })
})
