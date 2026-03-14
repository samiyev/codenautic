import {describe, expect, test} from "bun:test"

import {
    PIPELINE_CONCLUSION,
    PIPELINE_STATUS,
    type ICreatePipelineStatusInput,
    type IGitPipelineStatusProvider,
    type IPipelineStatusDTO,
    type IUpdatePipelineStatusInput,
} from "../../../../src"

class InMemoryGitPipelineStatusProvider implements IGitPipelineStatusProvider {
    public createPipelineStatus(
        input: ICreatePipelineStatusInput,
    ): Promise<IPipelineStatusDTO> {
        return Promise.resolve({
            id: "pipeline-1",
            name: input.name,
            status: PIPELINE_STATUS.QUEUED,
            conclusion: PIPELINE_CONCLUSION.NEUTRAL,
        })
    }

    public updatePipelineStatus(
        input: IUpdatePipelineStatusInput,
    ): Promise<IPipelineStatusDTO> {
        return Promise.resolve({
            id: input.pipelineId ?? "pipeline-1",
            name: input.name,
            status: input.status,
            conclusion: input.conclusion,
            summary: input.summary,
        })
    }
}

describe("IGitPipelineStatusProvider contract", () => {
    test("creates and updates review pipeline statuses", async () => {
        const provider = new InMemoryGitPipelineStatusProvider()

        const created = await provider.createPipelineStatus({
            mergeRequestId: "mr-1",
            name: "CodeNautic Review",
            headCommitId: "head-1",
        })
        const updated = await provider.updatePipelineStatus({
            pipelineId: created.id,
            mergeRequestId: "mr-1",
            name: created.name,
            headCommitId: "head-1",
            status: PIPELINE_STATUS.COMPLETED,
            conclusion: PIPELINE_CONCLUSION.SUCCESS,
            summary: "Completed successfully",
        })

        expect(created.status).toBe("queued")
        expect(updated.id).toBe("pipeline-1")
        expect(updated.status).toBe("completed")
        expect(updated.summary).toContain("Completed")
    })
})
