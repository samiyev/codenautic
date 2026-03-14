import {describe, expect, test} from "bun:test"

import type {
    IGitPipelineStatusProvider,
    IPipelineStatusDTO,
} from "../../../../src"
import {PIPELINE_CONCLUSION, PIPELINE_STATUS} from "../../../../src"
import {CreateCheckStageUseCase} from "../../../../src/application/use-cases/review/create-check-stage.use-case"
import {ReviewPipelineState} from "../../../../src/application/types/review/review-pipeline-state"

const checkRunDefaults = {
    checkRunName: "CodeNautic Review",
}

class InMemoryGitPipelineStatusProvider implements IGitPipelineStatusProvider {
    public lastMergeRequestId: string | null = null
    public lastCheckName: string | null = null
    public lastHeadCommitId: string | null = null
    public shouldThrowOnCreateCheck = false

    public createPipelineStatus(input: {
        readonly mergeRequestId: string
        readonly name: string
        readonly headCommitId?: string
    }): Promise<IPipelineStatusDTO> {
        if (this.shouldThrowOnCreateCheck) {
            return Promise.reject(new Error("provider unavailable"))
        }

        this.lastMergeRequestId = input.mergeRequestId
        this.lastCheckName = input.name
        this.lastHeadCommitId = input.headCommitId ?? null
        return Promise.resolve({
            id: "check-1",
            name: input.name,
            status: PIPELINE_STATUS.QUEUED,
            conclusion: PIPELINE_CONCLUSION.NEUTRAL,
        })
    }

    public updatePipelineStatus(_input: {
        readonly pipelineId?: string
        readonly mergeRequestId: string
        readonly name: string
        readonly status: typeof PIPELINE_STATUS[keyof typeof PIPELINE_STATUS]
        readonly conclusion: typeof PIPELINE_CONCLUSION[keyof typeof PIPELINE_CONCLUSION]
        readonly summary?: string
        readonly headCommitId?: string
    }): Promise<IPipelineStatusDTO> {
        return Promise.reject(new Error("not implemented in test"))
    }
}

/**
 * Creates state for create-check stage tests.
 *
 * @param mergeRequest Merge request payload.
 * @returns Pipeline state.
 */
function createState(mergeRequest: Readonly<Record<string, unknown>>): ReviewPipelineState {
    return ReviewPipelineState.create({
        runId: "run-create-check",
        definitionVersion: "v1",
        mergeRequest,
        config: {},
    })
}

describe("CreateCheckStageUseCase", () => {
    test("creates pending check and stores check id in state", async () => {
        const pipelineStatusProvider = new InMemoryGitPipelineStatusProvider()
        const useCase = new CreateCheckStageUseCase({
            pipelineStatusProvider,
            defaults: checkRunDefaults,
        })
        const state = createState({
            id: "mr-10",
            commits: [
                {
                    id: "head-commit-1",
                },
            ],
        })

        const result = await useCase.execute({
            state,
        })

        expect(result.isOk).toBe(true)
        expect(result.value.state.checkId).toBe("check-1")
        expect(result.value.metadata?.checkpointHint).toBe("check:created")
        expect(pipelineStatusProvider.lastMergeRequestId).toBe("mr-10")
        expect(pipelineStatusProvider.lastCheckName).toBe("CodeNautic Review")
        expect(pipelineStatusProvider.lastHeadCommitId).toBe("head-commit-1")
    })

    test("returns fail result when merge request id is missing", async () => {
        const useCase = new CreateCheckStageUseCase({
            pipelineStatusProvider: new InMemoryGitPipelineStatusProvider(),
            defaults: checkRunDefaults,
        })
        const state = createState({})

        const result = await useCase.execute({
            state,
        })

        expect(result.isFail).toBe(true)
        expect(result.error.recoverable).toBe(false)
        expect(result.error.originalError?.name).toBe("NotFoundError")
    })

    test("returns recoverable stage error when provider throws", async () => {
        const pipelineStatusProvider = new InMemoryGitPipelineStatusProvider()
        pipelineStatusProvider.shouldThrowOnCreateCheck = true

        const useCase = new CreateCheckStageUseCase({
            pipelineStatusProvider,
            defaults: {
                checkRunName: "Custom Check Name",
            },
        })
        const state = createState({
            id: "mr-10",
        })

        const result = await useCase.execute({
            state,
        })

        expect(result.isFail).toBe(true)
        expect(result.error.recoverable).toBe(true)
        expect(result.error.message).toContain("Failed to create check run")
    })
})
