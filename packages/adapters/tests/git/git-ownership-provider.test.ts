import {describe, expect, test} from "bun:test"

import type {IBlameData, ICommitInfo, IContributorStat, IGitProvider} from "@codenautic/core"

import {
    GIT_OWNERSHIP_PROVIDER_ERROR_CODE,
    GitOwnershipProvider,
    GitOwnershipProviderError,
    type IGitOwnershipProviderOptions,
} from "../../src/git"
import {createGitProviderMock} from "../helpers/provider-factories"

interface IOwnershipProviderFixture {
    readonly provider: GitOwnershipProvider
    readonly gitProvider: IGitProvider
}

/**
 * Creates ownership provider fixture with overridable git methods.
 *
 * @param overrides Git provider method overrides.
 * @param optionOverrides Ownership provider option overrides.
 * @returns Ownership provider fixture.
 */
function createOwnershipProviderFixture(
    overrides: Partial<Pick<IGitProvider, "getCommitHistory" | "getBlameData" | "getContributorStats">> = {},
    optionOverrides: Partial<Omit<IGitOwnershipProviderOptions, "gitProvider">> = {},
): IOwnershipProviderFixture {
    const base = createGitProviderMock()
    const gitProvider: IGitProvider = {
        ...base,
        ...overrides,
    }

    return {
        provider: new GitOwnershipProvider({
            gitProvider,
            ...optionOverrides,
        }),
        gitProvider,
    }
}

/**
 * Creates one commit fixture.
 *
 * @param authorName Author display name.
 * @param authorEmail Author email.
 * @param date Commit timestamp.
 * @returns Commit fixture.
 */
function createCommit(authorName: string, authorEmail: string, date: string): ICommitInfo {
    return {
        sha: `${authorName}-${date}`,
        message: "commit",
        authorName,
        authorEmail,
        date,
        filesChanged: ["src/file.ts"],
    }
}

/**
 * Creates one blame range fixture.
 *
 * @param authorName Author display name.
 * @param authorEmail Author email.
 * @param lineStart Range start.
 * @param lineEnd Range end.
 * @param date Commit timestamp.
 * @returns Blame range fixture.
 */
function createBlameRange(
    authorName: string,
    authorEmail: string,
    lineStart: number,
    lineEnd: number,
    date: string,
): IBlameData {
    return {
        lineStart,
        lineEnd,
        commitSha: `${authorName}-${date}`,
        authorName,
        authorEmail,
        date,
    }
}

/**
 * Creates one contributor stats fixture.
 *
 * @param name Contributor name.
 * @param email Contributor email.
 * @param commitCount Commit count.
 * @returns Contributor stats fixture.
 */
function createContributorStats(
    name: string,
    email: string,
    commitCount: number,
): IContributorStat {
    return {
        name,
        email,
        commitCount,
        additions: 0,
        deletions: 0,
        changes: 0,
        activePeriod: {
            startedAt: "2026-01-01T00:00:00.000Z",
            endedAt: "2026-01-01T00:00:00.000Z",
        },
        files: [],
    }
}

describe("GitOwnershipProvider", () => {
    test("throws when defaultRef is empty", () => {
        expect(
            () =>
                new GitOwnershipProvider({
                    gitProvider: createGitProviderMock(),
                    defaultRef: "   ",
                }),
        ).toThrow(GitOwnershipProviderError)
    })

    test("throws when maxHistoryCount is not positive integer", () => {
        expect(
            () =>
                new GitOwnershipProvider({
                    gitProvider: createGitProviderMock(),
                    maxHistoryCount: 0,
                }),
        ).toThrow(GitOwnershipProviderError)
    })

    test("throws when busFactorThreshold is zero", () => {
        expect(
            () =>
                new GitOwnershipProvider({
                    gitProvider: createGitProviderMock(),
                    busFactorThreshold: 0,
                }),
        ).toThrow(GitOwnershipProviderError)
    })

    test("throws when busFactorThreshold is greater than one", () => {
        expect(
            () =>
                new GitOwnershipProvider({
                    gitProvider: createGitProviderMock(),
                    busFactorThreshold: 1.2,
                }),
        ).toThrow(GitOwnershipProviderError)
    })

    test("throws when repositoryId is empty for getFileOwnership", async () => {
        const {provider} = createOwnershipProviderFixture()

        try {
            await provider.getFileOwnership("   ", ["src/file.ts"])
        } catch (error) {
            expect(error).toBeInstanceOf(GitOwnershipProviderError)
            if (error instanceof GitOwnershipProviderError) {
                expect(error.code).toBe(GIT_OWNERSHIP_PROVIDER_ERROR_CODE.INVALID_REPOSITORY_ID)
            }
            return
        }

        throw new Error("Expected getFileOwnership to throw for empty repositoryId")
    })

    test("throws when file path is empty for getFileOwnership", async () => {
        const {provider} = createOwnershipProviderFixture()

        try {
            await provider.getFileOwnership("repo-1", ["   "])
        } catch (error) {
            expect(error).toBeInstanceOf(GitOwnershipProviderError)
            if (error instanceof GitOwnershipProviderError) {
                expect(error.code).toBe(GIT_OWNERSHIP_PROVIDER_ERROR_CODE.INVALID_FILE_PATH)
            }
            return
        }

        throw new Error("Expected getFileOwnership to throw for empty file path")
    })

    test("returns empty list when file path batch is empty", async () => {
        const {provider} = createOwnershipProviderFixture()

        const ownership = await provider.getFileOwnership("repo-1", [])

        expect(ownership).toEqual([])
    })

    test("passes default ref and max history count to provider calls", async () => {
        const commitRefs: string[] = []
        const commitOptions: Array<Parameters<IGitProvider["getCommitHistory"]>[1]> = []
        const blameRefs: string[] = []
        const {provider} = createOwnershipProviderFixture(
            {
                getCommitHistory(
                    ref: string,
                    options?: Parameters<IGitProvider["getCommitHistory"]>[1],
                ): Promise<readonly ICommitInfo[]> {
                    commitRefs.push(ref)
                    commitOptions.push(options)
                    return Promise.resolve([])
                },
                getBlameData(_filePath: string, ref: string): Promise<readonly IBlameData[]> {
                    blameRefs.push(ref)
                    return Promise.resolve([])
                },
            },
            {
                defaultRef: "main",
                maxHistoryCount: 50,
            },
        )

        await provider.getFileOwnership("repo-1", ["src/a.ts"])

        expect(commitRefs).toEqual(["main"])
        expect(blameRefs).toEqual(["main"])
        expect(commitOptions[0]?.maxCount).toBe(50)
        expect(commitOptions[0]?.path).toBe("src/a.ts")
    })

    test("aggregates contributors from history and blame", async () => {
        const {provider} = createOwnershipProviderFixture({
            getCommitHistory(): Promise<readonly ICommitInfo[]> {
                return Promise.resolve([
                    createCommit("Alice", "alice@example.com", "2026-03-10T12:00:00.000Z"),
                    createCommit("Alice", "alice@example.com", "2026-03-09T12:00:00.000Z"),
                    createCommit("Bob", "bob@example.com", "2026-03-08T12:00:00.000Z"),
                ])
            },
            getBlameData(): Promise<readonly IBlameData[]> {
                return Promise.resolve([
                    createBlameRange(
                        "Alice",
                        "alice@example.com",
                        1,
                        12,
                        "2026-03-10T12:00:00.000Z",
                    ),
                    createBlameRange(
                        "Bob",
                        "bob@example.com",
                        13,
                        20,
                        "2026-03-08T12:00:00.000Z",
                    ),
                ])
            },
        })

        const [ownership] = await provider.getFileOwnership("repo-1", ["src/file.ts"])
        expect(ownership).toBeDefined()
        if (ownership === undefined) {
            throw new Error("Expected ownership entry")
        }
        const contributors = ownership.contributors

        expect(contributors).toHaveLength(2)
        expect(contributors[0]?.name).toBe("Alice")
        expect(contributors[0]?.commitCount).toBe(2)
        expect(contributors[0]?.linesChanged).toBe(12)
        expect(contributors[1]?.name).toBe("Bob")
        expect(contributors[1]?.commitCount).toBe(1)
        expect(contributors[1]?.linesChanged).toBe(8)
    })

    test("deduplicates contributors by email ignoring case", async () => {
        const {provider} = createOwnershipProviderFixture({
            getCommitHistory(): Promise<readonly ICommitInfo[]> {
                return Promise.resolve([
                    createCommit("Alice", "alice@example.com", "2026-03-10T12:00:00.000Z"),
                ])
            },
            getBlameData(): Promise<readonly IBlameData[]> {
                return Promise.resolve([
                    createBlameRange(
                        "ALICE",
                        "ALICE@example.com",
                        1,
                        8,
                        "2026-03-10T12:00:00.000Z",
                    ),
                ])
            },
        })

        const [ownership] = await provider.getFileOwnership("repo-1", ["src/file.ts"])

        expect(ownership?.contributors).toHaveLength(1)
        expect(ownership?.contributors[0]?.name).toBe("Alice")
        expect(ownership?.contributors[0]?.commitCount).toBe(1)
        expect(ownership?.contributors[0]?.linesChanged).toBe(8)
    })

    test("uses latest history commit for lastModified metadata", async () => {
        const {provider} = createOwnershipProviderFixture({
            getCommitHistory(): Promise<readonly ICommitInfo[]> {
                return Promise.resolve([
                    createCommit("Bob", "bob@example.com", "2026-03-09T12:00:00.000Z"),
                    createCommit("Alice", "alice@example.com", "2026-03-11T12:00:00.000Z"),
                ])
            },
            getBlameData(): Promise<readonly IBlameData[]> {
                return Promise.resolve([])
            },
        })

        const [ownership] = await provider.getFileOwnership("repo-1", ["src/file.ts"])

        expect(ownership?.lastModifiedBy).toBe("Alice")
        expect(ownership?.lastModifiedDate).toBe("2026-03-11T12:00:00.000Z")
    })

    test("falls back to blame metadata when history is empty", async () => {
        const {provider} = createOwnershipProviderFixture({
            getCommitHistory(): Promise<readonly ICommitInfo[]> {
                return Promise.resolve([])
            },
            getBlameData(): Promise<readonly IBlameData[]> {
                return Promise.resolve([
                    createBlameRange(
                        "Alice",
                        "alice@example.com",
                        1,
                        3,
                        "2026-03-07T12:00:00.000Z",
                    ),
                    createBlameRange(
                        "Bob",
                        "bob@example.com",
                        4,
                        10,
                        "2026-03-12T12:00:00.000Z",
                    ),
                ])
            },
        })

        const [ownership] = await provider.getFileOwnership("repo-1", ["src/file.ts"])

        expect(ownership?.lastModifiedBy).toBe("Bob")
        expect(ownership?.lastModifiedDate).toBe("2026-03-12T12:00:00.000Z")
    })

    test("computes bus factor from commit counts when history exists", async () => {
        const {provider} = createOwnershipProviderFixture({
            getCommitHistory(): Promise<readonly ICommitInfo[]> {
                return Promise.resolve([
                    createCommit("Alice", "alice@example.com", "2026-03-10T12:00:00.000Z"),
                    createCommit("Alice", "alice@example.com", "2026-03-09T12:00:00.000Z"),
                    createCommit("Alice", "alice@example.com", "2026-03-08T12:00:00.000Z"),
                    createCommit("Bob", "bob@example.com", "2026-03-07T12:00:00.000Z"),
                    createCommit("Carol", "carol@example.com", "2026-03-06T12:00:00.000Z"),
                ])
            },
            getBlameData(): Promise<readonly IBlameData[]> {
                return Promise.resolve([])
            },
        })

        const [ownership] = await provider.getFileOwnership("repo-1", ["src/file.ts"])

        expect(ownership?.busFactor).toBe(2)
    })

    test("computes bus factor from line ownership when history is empty", async () => {
        const {provider} = createOwnershipProviderFixture({
            getCommitHistory(): Promise<readonly ICommitInfo[]> {
                return Promise.resolve([])
            },
            getBlameData(): Promise<readonly IBlameData[]> {
                return Promise.resolve([
                    createBlameRange(
                        "Alice",
                        "alice@example.com",
                        1,
                        8,
                        "2026-03-10T12:00:00.000Z",
                    ),
                    createBlameRange(
                        "Bob",
                        "bob@example.com",
                        9,
                        10,
                        "2026-03-09T12:00:00.000Z",
                    ),
                ])
            },
        })

        const [ownership] = await provider.getFileOwnership("repo-1", ["src/file.ts"])

        expect(ownership?.busFactor).toBe(1)
    })

    test("returns zero bus factor when contributors have no measurable contribution", async () => {
        const {provider} = createOwnershipProviderFixture({
            getCommitHistory(): Promise<readonly ICommitInfo[]> {
                return Promise.resolve([])
            },
            getBlameData(): Promise<readonly IBlameData[]> {
                return Promise.resolve([
                    createBlameRange(
                        "Alice",
                        "alice@example.com",
                        10,
                        5,
                        "2026-03-10T12:00:00.000Z",
                    ),
                ])
            },
        })

        const [ownership] = await provider.getFileOwnership("repo-1", ["src/file.ts"])

        expect(ownership?.busFactor).toBe(0)
    })

    test("orders ownership results by input file order", async () => {
        const {provider} = createOwnershipProviderFixture({
            getCommitHistory(
                _ref: string,
                options?: Parameters<IGitProvider["getCommitHistory"]>[1],
            ): Promise<readonly ICommitInfo[]> {
                const path = options?.path ?? "unknown"
                return Promise.resolve([
                    createCommit(path, `${path}@example.com`, "2026-03-10T12:00:00.000Z"),
                ])
            },
            getBlameData(
                filePath: string,
                _ref: string,
            ): Promise<readonly IBlameData[]> {
                return Promise.resolve([
                    createBlameRange(
                        filePath,
                        `${filePath}@example.com`,
                        1,
                        1,
                        "2026-03-10T12:00:00.000Z",
                    ),
                ])
            },
        })

        const ownership = await provider.getFileOwnership("repo-1", [
            "src/b.ts",
            "src/a.ts",
        ])

        expect(ownership[0]?.filePath).toBe("src/b.ts")
        expect(ownership[1]?.filePath).toBe("src/a.ts")
    })

    test("wraps history failures with ownership error code", async () => {
        const {provider} = createOwnershipProviderFixture({
            getCommitHistory(): Promise<readonly ICommitInfo[]> {
                return Promise.reject(new Error("history failed"))
            },
        })

        try {
            await provider.getFileOwnership("repo-1", ["src/file.ts"])
        } catch (error) {
            expect(error).toBeInstanceOf(GitOwnershipProviderError)
            if (error instanceof GitOwnershipProviderError) {
                expect(error.code).toBe(
                    GIT_OWNERSHIP_PROVIDER_ERROR_CODE.GET_FILE_OWNERSHIP_FAILED,
                )
                expect(error.repositoryId).toBe("repo-1")
                expect(error.filePath).toBe("src/file.ts")
                expect(error.causeMessage).toBe("history failed")
            }
            return
        }

        throw new Error("Expected getFileOwnership to wrap history failure")
    })

    test("sorts contributors by commit count then name", async () => {
        const {provider} = createOwnershipProviderFixture({
            getContributorStats(): Promise<readonly IContributorStat[]> {
                return Promise.resolve([
                    createContributorStats("Charlie", "charlie@example.com", 2),
                    createContributorStats("Alice", "alice@example.com", 5),
                    createContributorStats("Bob", "bob@example.com", 5),
                ])
            },
        })

        const contributors = await provider.getContributors("repo-1")

        expect(contributors.map((item): string => item.name)).toEqual([
            "Alice",
            "Bob",
            "Charlie",
        ])
    })

    test("passes default ref and history limit to contributor stats call", async () => {
        const refs: string[] = []
        const optionsBatch: Array<Parameters<IGitProvider["getContributorStats"]>[1]> = []
        const {provider} = createOwnershipProviderFixture(
            {
                getContributorStats(
                    ref: string,
                    options?: Parameters<IGitProvider["getContributorStats"]>[1],
                ): Promise<readonly IContributorStat[]> {
                    refs.push(ref)
                    optionsBatch.push(options)
                    return Promise.resolve([])
                },
            },
            {
                defaultRef: "develop",
                maxHistoryCount: 30,
            },
        )

        await provider.getContributors("repo-1")

        expect(refs).toEqual(["develop"])
        expect(optionsBatch[0]?.maxCount).toBe(30)
    })

    test("throws when repositoryId is empty for getContributors", async () => {
        const {provider} = createOwnershipProviderFixture()

        try {
            await provider.getContributors(" ")
        } catch (error) {
            expect(error).toBeInstanceOf(GitOwnershipProviderError)
            if (error instanceof GitOwnershipProviderError) {
                expect(error.code).toBe(GIT_OWNERSHIP_PROVIDER_ERROR_CODE.INVALID_REPOSITORY_ID)
            }
            return
        }

        throw new Error("Expected getContributors to throw for empty repository id")
    })

    test("wraps contributor stats failure with typed error", async () => {
        const {provider} = createOwnershipProviderFixture({
            getContributorStats(): Promise<readonly IContributorStat[]> {
                return Promise.reject(new Error("contributors failed"))
            },
        })

        try {
            await provider.getContributors("repo-1")
        } catch (error) {
            expect(error).toBeInstanceOf(GitOwnershipProviderError)
            if (error instanceof GitOwnershipProviderError) {
                expect(error.code).toBe(
                    GIT_OWNERSHIP_PROVIDER_ERROR_CODE.GET_CONTRIBUTORS_FAILED,
                )
                expect(error.repositoryId).toBe("repo-1")
                expect(error.causeMessage).toBe("contributors failed")
            }
            return
        }

        throw new Error("Expected getContributors to wrap provider failure")
    })

    test("builds ownership timeline from file history", async () => {
        const {provider} = createOwnershipProviderFixture({
            getCommitHistory(): Promise<readonly ICommitInfo[]> {
                return Promise.resolve([
                    createCommit("Alice", "alice@example.com", "2026-03-01T10:00:00.000Z"),
                    createCommit("Bob", "bob@example.com", "2026-03-02T10:00:00.000Z"),
                    createCommit("Alice", "alice@example.com", "2026-03-03T10:00:00.000Z"),
                ])
            },
        })

        const timeline = await provider.getOwnershipTimeline("repo-1", "src/file.ts")

        expect(timeline.filePath).toBe("src/file.ts")
        expect(timeline.entries).toHaveLength(3)
        expect(timeline.handoffs).toHaveLength(2)
        expect(timeline.currentOwner).toBe("Alice")
    })

    test("passes default ref and max history count to getOwnershipTimeline history call", async () => {
        const refs: string[] = []
        const optionsBatch: Array<Parameters<IGitProvider["getCommitHistory"]>[1]> = []
        const {provider} = createOwnershipProviderFixture(
            {
                getCommitHistory(
                    ref: string,
                    options?: Parameters<IGitProvider["getCommitHistory"]>[1],
                ): Promise<readonly ICommitInfo[]> {
                    refs.push(ref)
                    optionsBatch.push(options)
                    return Promise.resolve([])
                },
            },
            {
                defaultRef: "release",
                maxHistoryCount: 42,
            },
        )

        await provider.getOwnershipTimeline("repo-1", "src/file.ts")

        expect(refs).toEqual(["release"])
        expect(optionsBatch[0]?.path).toBe("src/file.ts")
        expect(optionsBatch[0]?.maxCount).toBe(42)
    })

    test("throws when file path is empty for getOwnershipTimeline", async () => {
        const {provider} = createOwnershipProviderFixture()

        try {
            await provider.getOwnershipTimeline("repo-1", " ")
        } catch (error) {
            expect(error).toBeInstanceOf(GitOwnershipProviderError)
            if (error instanceof GitOwnershipProviderError) {
                expect(error.code).toBe(GIT_OWNERSHIP_PROVIDER_ERROR_CODE.INVALID_FILE_PATH)
            }
            return
        }

        throw new Error("Expected getOwnershipTimeline to throw for empty file path")
    })

    test("wraps getOwnershipTimeline provider failure with typed error", async () => {
        const {provider} = createOwnershipProviderFixture({
            getCommitHistory(): Promise<readonly ICommitInfo[]> {
                return Promise.reject(new Error("timeline failed"))
            },
        })

        try {
            await provider.getOwnershipTimeline("repo-1", "src/file.ts")
        } catch (error) {
            expect(error).toBeInstanceOf(GitOwnershipProviderError)
            if (error instanceof GitOwnershipProviderError) {
                expect(error.code).toBe(
                    GIT_OWNERSHIP_PROVIDER_ERROR_CODE.GET_OWNERSHIP_TIMELINE_FAILED,
                )
                expect(error.repositoryId).toBe("repo-1")
                expect(error.filePath).toBe("src/file.ts")
                expect(error.causeMessage).toBe("timeline failed")
            }
            return
        }

        throw new Error("Expected getOwnershipTimeline to wrap provider failure")
    })
})
