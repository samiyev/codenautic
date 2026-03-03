import type {ITreemapNodeDTO} from "./treemap-node.dto"

/**
 * Supported numeric file metric keys for temporal diff.
 */
export type IFileMetricField =
    "loc"
    | "complexity"
    | "churn"
    | "issueCount"
    | "coverage"

/**
 * Metric delta payload for temporal file diff.
 */
export type ITemporalDiffMetricDelta = Partial<
    Record<IFileMetricField, number>
>

/**
 * Unit of temporal diff output for file-level tree map rows.
 */
export interface ITemporalDiffFileNode extends ITreemapNodeDTO {}

/**
 * Metric delta for changed file between graph snapshots.
 */
export interface ITemporalDiffChangedFile {
    /**
     * File treemap node in target snapshot.
     */
    readonly node: ITemporalDiffFileNode

    /**
     * Partial file-metrics delta between snapshots.
     */
    readonly metricsDelta: ITemporalDiffMetricDelta
}

/**
 * Input for temporal diff by commits.
 */
export interface IGetTemporalDiffInput {
    /**
     * Repository identifier in `<platform>:<id>` format.
     */
    readonly repoId: string

    /**
     * Source commit or branch ref.
     */
    readonly fromCommit: string

    /**
     * Target commit or branch ref.
     */
    readonly toCommit: string
}

/**
 * Temporal diff output payload.
 */
export interface ITemporalDiffResult {
    /**
     * Files added in `toCommit`.
     */
    readonly added: readonly ITemporalDiffFileNode[]

    /**
     * Files removed from `fromCommit`.
     */
    readonly removed: readonly ITemporalDiffFileNode[]

    /**
     * Files present in both commits with metric delta.
     */
    readonly changed: readonly ITemporalDiffChangedFile[]
}
