import type {ICommitHistoryOptions} from "./commit-history.dto"

/**
 * Optional query filters for contributor statistics.
 */
export type IContributorStatsOptions = Omit<ICommitHistoryOptions, "author">

/**
 * Active contribution window for one repository contributor.
 */
export interface IContributorActivePeriod {
    /**
     * Earliest commit timestamp included in the aggregation.
     */
    readonly startedAt: string

    /**
     * Latest commit timestamp included in the aggregation.
     */
    readonly endedAt: string
}

/**
 * Per-file contribution breakdown for one contributor.
 */
export interface IContributorFileStat {
    /**
     * Repository-relative file path.
     */
    readonly filePath: string

    /**
     * Number of commits by this contributor that touched the file.
     */
    readonly commitCount: number

    /**
     * Added lines attributed to this contributor for the file.
     */
    readonly additions: number

    /**
     * Removed lines attributed to this contributor for the file.
     */
    readonly deletions: number

    /**
     * Total changed lines for the file.
     */
    readonly changes: number

    /**
     * Latest commit timestamp for this file by the contributor.
     */
    readonly lastCommitDate: string
}

/**
 * Aggregated contribution statistics for one repository contributor.
 */
export interface IContributorStat {
    /**
     * Contributor display name.
     */
    readonly name: string

    /**
     * Contributor email when available.
     */
    readonly email: string

    /**
     * Number of commits included in the aggregation.
     */
    readonly commitCount: number

    /**
     * Added lines across all touched files.
     */
    readonly additions: number

    /**
     * Removed lines across all touched files.
     */
    readonly deletions: number

    /**
     * Total changed lines across all touched files.
     */
    readonly changes: number

    /**
     * First and last contribution timestamps included in the result.
     */
    readonly activePeriod: IContributorActivePeriod

    /**
     * Per-file contribution breakdown sorted by adapter-defined stable order.
     */
    readonly files: readonly IContributorFileStat[]
}
