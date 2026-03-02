/**
 * Checkpoint statuses captured by pipeline orchestrator.
 */
export const PIPELINE_CHECKPOINT_STATUS = {
    STARTED: "started",
    COMPLETED: "completed",
    FAILED: "failed",
} as const

/**
 * Checkpoint status literal.
 */
export type PipelineCheckpointStatus =
    (typeof PIPELINE_CHECKPOINT_STATUS)[keyof typeof PIPELINE_CHECKPOINT_STATUS]

/**
 * Snapshot of pipeline execution progress.
 */
export interface IPipelineStageCheckpoint {
    runId: string
    definitionVersion: string
    currentStageId: string
    lastCompletedStageId: string | null
    attempt: number
    status: PipelineCheckpointStatus
    occurredAt: Date
}

/**
 * Outbound contract for checkpoint persistence.
 */
export interface IPipelineCheckpointStore {
    /**
     * Persists stage checkpoint.
     *
     * @param checkpoint Checkpoint payload.
     * @returns Promise resolved after persistence.
     */
    save(checkpoint: IPipelineStageCheckpoint): Promise<void>
}
