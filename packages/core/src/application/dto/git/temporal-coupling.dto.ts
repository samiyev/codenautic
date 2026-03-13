import type {ICommitHistoryOptions} from "./commit-history.dto"

/**
 * Optional query filters for temporal coupling aggregation.
 */
export type ITemporalCouplingOptions = Omit<ICommitHistoryOptions, "author"> & {
    /**
     * Optional batch filter that keeps only edges touching any listed file path.
     */
    readonly filePaths?: readonly string[]
}

/**
 * One normalized temporal coupling edge between two repository-relative files.
 */
export interface ITemporalCouplingEdge {
    /**
     * Deterministic source path of the edge.
     *
     * Canonical providers may order symmetric file pairs lexicographically.
     */
    readonly sourcePath: string

    /**
     * Deterministic target path of the edge.
     */
    readonly targetPath: string

    /**
     * Normalized coupling strength in the `[0, 1]` range.
     */
    readonly strength: number

    /**
     * Number of commits where both files changed together.
     */
    readonly sharedCommitCount: number

    /**
     * Latest commit timestamp where the pair co-changed.
     */
    readonly lastSeenAt: string
}
