/**
 * Running ownership state at one commit point on a file timeline.
 */
export interface IOwnershipTimelineEntry {
    /**
     * Commit SHA for this timeline checkpoint.
     */
    readonly commitSha: string

    /**
     * Commit timestamp in ISO 8601 format.
     */
    readonly committedAt: string

    /**
     * Author display name for the commit.
     */
    readonly authorName: string

    /**
     * Author email for the commit.
     */
    readonly authorEmail: string

    /**
     * Running total commits processed for the timeline.
     */
    readonly totalCommits: number

    /**
     * Running commit count for this author on the file.
     */
    readonly authorCommitCount: number

    /**
     * Running ownership share for this author in range [0, 1].
     */
    readonly authorOwnershipShare: number

    /**
     * Dominant owner after processing this commit.
     */
    readonly dominantOwner: string

    /**
     * Indicates ownership handoff at this checkpoint.
     */
    readonly isHandoff: boolean
}

/**
 * One ownership handoff event between dominant owners.
 */
export interface IOwnershipHandoff {
    /**
     * Previous dominant owner.
     */
    readonly fromOwner: string

    /**
     * New dominant owner.
     */
    readonly toOwner: string

    /**
     * Commit SHA where handoff became effective.
     */
    readonly commitSha: string

    /**
     * Commit timestamp for handoff event.
     */
    readonly committedAt: string
}

/**
 * Continuous period where one owner remained dominant.
 */
export interface IOwnershipPeriod {
    /**
     * Dominant owner for this period.
     */
    readonly owner: string

    /**
     * Period start timestamp.
     */
    readonly startedAt: string

    /**
     * Period end timestamp.
     */
    readonly endedAt: string

    /**
     * Number of timeline entries in this period.
     */
    readonly commitCount: number
}

/**
 * File-level ownership timeline with handoffs and dominant-owner periods.
 */
export interface IOwnershipTimeline {
    /**
     * Repository-relative file path.
     */
    readonly filePath: string

    /**
     * Commit-level running ownership timeline.
     */
    readonly entries: readonly IOwnershipTimelineEntry[]

    /**
     * Handoff events extracted from dominant owner transitions.
     */
    readonly handoffs: readonly IOwnershipHandoff[]

    /**
     * Dominant-owner periods over the timeline.
     */
    readonly periods: readonly IOwnershipPeriod[]

    /**
     * Current dominant owner at the end of timeline.
     */
    readonly currentOwner: string
}
