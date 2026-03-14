import {
    CHECK_RUN_CONCLUSION,
    CHECK_RUN_STATUS,
    type CheckRunConclusion,
    type CheckRunStatus,
} from "./check-run.dto"

/**
 * Generic external pipeline status lifecycle states.
 */
export const PIPELINE_STATUS = CHECK_RUN_STATUS

/**
 * Generic external pipeline status state literal.
 */
export type PipelineStatus = CheckRunStatus

/**
 * Generic external pipeline conclusion states.
 */
export const PIPELINE_CONCLUSION = CHECK_RUN_CONCLUSION

/**
 * Generic external pipeline conclusion literal.
 */
export type PipelineConclusion = CheckRunConclusion

/**
 * Platform-agnostic external review pipeline status payload.
 */
export interface IPipelineStatusDTO {
    readonly id: string
    readonly name: string
    readonly status: PipelineStatus
    readonly conclusion: PipelineConclusion
    readonly summary?: string
    readonly detailsUrl?: string
}

/**
 * Creation payload for a review pipeline status/check.
 */
export interface ICreatePipelineStatusInput {
    readonly mergeRequestId: string
    readonly name: string
    readonly headCommitId?: string
}

/**
 * Update payload for an existing review pipeline status/check.
 */
export interface IUpdatePipelineStatusInput {
    readonly pipelineId?: string
    readonly mergeRequestId: string
    readonly name: string
    readonly status: PipelineStatus
    readonly conclusion: PipelineConclusion
    readonly summary?: string
    readonly headCommitId?: string
}
