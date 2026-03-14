import type {
    ICreatePipelineStatusInput,
    IPipelineStatusDTO,
    IUpdatePipelineStatusInput,
} from "../../../dto/git/pipeline-status.dto"

/**
 * Outbound contract for external review pipeline/check status integration.
 */
export interface IGitPipelineStatusProvider {
    /**
     * Creates a new review pipeline status for the current merge request head.
     *
     * @param input Creation payload.
     * @returns Created pipeline status payload.
     */
    createPipelineStatus(
        input: ICreatePipelineStatusInput,
    ): Promise<IPipelineStatusDTO>

    /**
     * Updates an existing review pipeline status to a new lifecycle state.
     *
     * @param input Update payload.
     * @returns Updated pipeline status payload.
     */
    updatePipelineStatus(
        input: IUpdatePipelineStatusInput,
    ): Promise<IPipelineStatusDTO>
}
