import {describe, expect, test} from "bun:test"

import {
    PIPELINE_CONCLUSION,
    PIPELINE_STATUS,
    type IPipelineStatusDTO,
} from "../../../../src/application/dto/git/pipeline-status.dto"

describe("IPipelineStatusDTO", () => {
    test("supports generic review pipeline status payload", () => {
        const pipelineStatus: IPipelineStatusDTO = {
            id: "status-1",
            name: "CodeNautic Review",
            status: PIPELINE_STATUS.COMPLETED,
            conclusion: PIPELINE_CONCLUSION.SUCCESS,
            summary: "No blocking issues found",
            detailsUrl: "https://example.com/pipelines/1",
        }

        expect(pipelineStatus.status).toBe("completed")
        expect(pipelineStatus.conclusion).toBe("success")
        expect(pipelineStatus.detailsUrl).toContain("/pipelines/")
    })
})
