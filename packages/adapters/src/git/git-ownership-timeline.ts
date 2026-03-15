import type {ICommitInfo, IOwnershipHandoff, IOwnershipPeriod, IOwnershipTimeline, IOwnershipTimelineEntry} from "@codenautic/core"

const OWNERSHIP_SHARE_PRECISION = 6

interface IContributorSnapshot {
    readonly contributorKey: string
    readonly ownerName: string
    readonly commitCount: number
    readonly lastSeenMs: number
}

/**
 * Input payload for ownership timeline builder.
 */
export interface IBuildOwnershipTimelineInput {
    /**
     * Repository-relative file path.
     */
    readonly filePath: string

    /**
     * File commit history.
     */
    readonly commits: readonly ICommitInfo[]
}

/**
 * Pure ownership timeline builder from per-file commit history.
 *
 * @param input Timeline build input.
 * @returns Ownership timeline with handoffs and periods.
 */
export function buildOwnershipTimeline(input: IBuildOwnershipTimelineInput): IOwnershipTimeline {
    const sortedCommits = [...input.commits].sort(compareChronologicalCommit)
    const entries = buildTimelineEntries(sortedCommits)
    const handoffs = buildOwnershipHandoffs(entries)
    const periods = buildOwnershipPeriods(entries)
    const currentOwner = entries.at(-1)?.dominantOwner ?? ""

    return {
        filePath: input.filePath,
        entries,
        handoffs,
        periods,
        currentOwner,
    }
}

/**
 * Builds timeline entries with running totals and dominant owner state.
 *
 * @param commits Chronologically sorted commit history.
 * @returns Ownership timeline entries.
 */
function buildTimelineEntries(commits: readonly ICommitInfo[]): readonly IOwnershipTimelineEntry[] {
    const entries: IOwnershipTimelineEntry[] = []
    const countByContributor = new Map<string, number>()
    const ownerNameByContributor = new Map<string, string>()
    const lastSeenMsByContributor = new Map<string, number>()
    let previousDominantOwner = ""

    for (const commit of commits) {
        const contributorKey = buildContributorKey(commit.authorName, commit.authorEmail)
        const ownerName = resolveOwnerName(commit.authorName, commit.authorEmail)
        ownerNameByContributor.set(contributorKey, ownerName)

        const nextCount = (countByContributor.get(contributorKey) ?? 0) + 1
        countByContributor.set(contributorKey, nextCount)

        const commitMs = resolveCommitDateMs(commit.date)
        lastSeenMsByContributor.set(contributorKey, commitMs)

        const totalCommits = entries.length + 1
        const dominantOwnerSnapshot = resolveDominantOwnerSnapshot({
            countByContributor,
            ownerNameByContributor,
            lastSeenMsByContributor,
        })
        const dominantOwner = dominantOwnerSnapshot.ownerName
        const isHandoff =
            previousDominantOwner.length > 0 &&
            dominantOwner.length > 0 &&
            dominantOwner !== previousDominantOwner

        entries.push({
            commitSha: commit.sha,
            committedAt: commit.date,
            authorName: ownerName,
            authorEmail: commit.authorEmail,
            totalCommits,
            authorCommitCount: nextCount,
            authorOwnershipShare: roundOwnershipShare(nextCount / totalCommits),
            dominantOwner,
            isHandoff,
        })

        previousDominantOwner = dominantOwner
    }

    return entries
}

/**
 * Builds ownership handoff events from timeline entries.
 *
 * @param entries Timeline entries.
 * @returns Ownership handoff events.
 */
function buildOwnershipHandoffs(
    entries: readonly IOwnershipTimelineEntry[],
): readonly IOwnershipHandoff[] {
    const handoffs: IOwnershipHandoff[] = []

    for (let index = 1; index < entries.length; index += 1) {
        const previousEntry = entries[index - 1]
        const currentEntry = entries[index]
        if (previousEntry === undefined || currentEntry === undefined) {
            continue
        }
        if (!currentEntry.isHandoff) {
            continue
        }

        handoffs.push({
            fromOwner: previousEntry.dominantOwner,
            toOwner: currentEntry.dominantOwner,
            commitSha: currentEntry.commitSha,
            committedAt: currentEntry.committedAt,
        })
    }

    return handoffs
}

/**
 * Builds dominant-owner periods from timeline entries.
 *
 * @param entries Timeline entries.
 * @returns Ownership periods.
 */
function buildOwnershipPeriods(
    entries: readonly IOwnershipTimelineEntry[],
): readonly IOwnershipPeriod[] {
    if (entries.length === 0) {
        return []
    }

    const periods: IOwnershipPeriod[] = []
    const firstEntry = entries[0]
    if (firstEntry === undefined) {
        return periods
    }

    let currentOwner = firstEntry.dominantOwner
    let periodStart = firstEntry.committedAt
    let periodEnd = firstEntry.committedAt
    let periodCount = 1

    for (const entry of entries.slice(1)) {
        if (entry.dominantOwner === currentOwner) {
            periodCount += 1
            periodEnd = entry.committedAt
            continue
        }

        periods.push(
            createOwnershipPeriod(currentOwner, periodStart, periodEnd, periodCount),
        )
        currentOwner = entry.dominantOwner
        periodStart = entry.committedAt
        periodEnd = entry.committedAt
        periodCount = 1
    }

    periods.push(createOwnershipPeriod(currentOwner, periodStart, periodEnd, periodCount))

    return periods
}

/**
 * Creates one ownership period entry.
 *
 * @param owner Dominant owner for period.
 * @param startedAt Period start timestamp.
 * @param endedAt Period end timestamp.
 * @param commitCount Commit count in period.
 * @returns Ownership period entry.
 */
function createOwnershipPeriod(
    owner: string,
    startedAt: string,
    endedAt: string,
    commitCount: number,
): IOwnershipPeriod {
    return {
        owner,
        startedAt,
        endedAt,
        commitCount,
    }
}

interface IDominantOwnerInput {
    readonly countByContributor: ReadonlyMap<string, number>
    readonly ownerNameByContributor: ReadonlyMap<string, string>
    readonly lastSeenMsByContributor: ReadonlyMap<string, number>
}

/**
 * Resolves dominant owner snapshot with deterministic tie-breaking.
 *
 * @param input Dominant owner inputs.
 * @returns Dominant owner snapshot.
 */
function resolveDominantOwnerSnapshot(input: IDominantOwnerInput): IContributorSnapshot {
    let dominant: IContributorSnapshot = {
        contributorKey: "",
        ownerName: "",
        commitCount: 0,
        lastSeenMs: Number.NEGATIVE_INFINITY,
    }

    for (const [contributorKey, commitCount] of input.countByContributor.entries()) {
        const ownerName = input.ownerNameByContributor.get(contributorKey) ?? contributorKey
        const lastSeenMs =
            input.lastSeenMsByContributor.get(contributorKey) ?? Number.NEGATIVE_INFINITY
        const candidate: IContributorSnapshot = {
            contributorKey,
            ownerName,
            commitCount,
            lastSeenMs,
        }

        if (isBetterDominantOwner(candidate, dominant)) {
            dominant = candidate
        }
    }

    return dominant
}

/**
 * Compares dominant owner candidates by count, recency, and lexical owner name.
 *
 * @param candidate Candidate snapshot.
 * @param current Current dominant snapshot.
 * @returns True when candidate should replace current.
 */
function isBetterDominantOwner(
    candidate: IContributorSnapshot,
    current: IContributorSnapshot,
): boolean {
    if (candidate.commitCount !== current.commitCount) {
        return candidate.commitCount > current.commitCount
    }

    if (candidate.lastSeenMs !== current.lastSeenMs) {
        return candidate.lastSeenMs > current.lastSeenMs
    }

    return candidate.ownerName.localeCompare(current.ownerName) < 0
}

/**
 * Resolves contributor key using email when available.
 *
 * @param authorName Author display name.
 * @param authorEmail Author email.
 * @returns Stable contributor key.
 */
function buildContributorKey(authorName: string, authorEmail: string): string {
    const normalizedEmail = authorEmail.trim().toLowerCase()
    if (normalizedEmail.length > 0) {
        return `email:${normalizedEmail}`
    }
    return `name:${authorName.trim().toLowerCase()}`
}

/**
 * Resolves display owner name from author metadata.
 *
 * @param authorName Author display name.
 * @param authorEmail Author email.
 * @returns Stable owner name.
 */
function resolveOwnerName(authorName: string, authorEmail: string): string {
    const normalizedName = authorName.trim()
    if (normalizedName.length > 0) {
        return normalizedName
    }
    return authorEmail.trim()
}

/**
 * Parses commit date into finite timestamp.
 *
 * @param commitDate Commit date.
 * @returns Parsed timestamp or negative infinity for invalid values.
 */
function resolveCommitDateMs(commitDate: string): number {
    const parsed = Date.parse(commitDate)
    if (Number.isFinite(parsed)) {
        return parsed
    }
    return Number.NEGATIVE_INFINITY
}

/**
 * Rounds ownership share to stable precision.
 *
 * @param share Raw ownership share.
 * @returns Rounded ownership share.
 */
function roundOwnershipShare(share: number): number {
    return Number(share.toFixed(OWNERSHIP_SHARE_PRECISION))
}

/**
 * Sorts commits chronologically with deterministic SHA tie-breaker.
 *
 * @param left Left commit.
 * @param right Right commit.
 * @returns Negative when left should be first.
 */
function compareChronologicalCommit(left: ICommitInfo, right: ICommitInfo): number {
    const leftMs = resolveCommitDateMs(left.date)
    const rightMs = resolveCommitDateMs(right.date)

    if (leftMs !== rightMs) {
        return leftMs - rightMs
    }

    return left.sha.localeCompare(right.sha)
}
