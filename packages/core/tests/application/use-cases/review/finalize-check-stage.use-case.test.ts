import {describe, expect, test} from "bun:test"

import type {
    IGitPipelineStatusProvider,
    IPipelineStatusDTO,
} from "../../../../src"
import {CHECK_RUN_CONCLUSION, CHECK_RUN_STATUS, PIPELINE_CONCLUSION} from "../../../../src"
import {ReviewPipelineState} from "../../../../src/application/types/review/review-pipeline-state"
import {FinalizeCheckStageUseCase} from "../../../../src/application/use-cases/review/finalize-check-stage.use-case"

const checkRunDefaults = {
    checkRunName: "CodeNautic Review",
}

class InMemoryGitPipelineStatusProvider implements IGitPipelineStatusProvider {
    public failAttempts = 0
    public updateAttempts = 0
    public lastConclusion: string | null = null

    public createPipelineStatus(_input: {
        readonly mergeRequestId: string
        readonly name: string
        readonly headCommitId?: string
    }): Promise<IPipelineStatusDTO> {
        return Promise.resolve({
            id: "check-1",
            name: "review",
            status: CHECK_RUN_STATUS.IN_PROGRESS,
            conclusion: PIPELINE_CONCLUSION.NEUTRAL,
        })
    }

    public updatePipelineStatus(input: {
        readonly pipelineId?: string
        readonly mergeRequestId: string
        readonly name: string
        readonly status: typeof CHECK_RUN_STATUS[keyof typeof CHECK_RUN_STATUS]
        readonly conclusion: typeof CHECK_RUN_CONCLUSION[keyof typeof CHECK_RUN_CONCLUSION]
        readonly summary?: string
        readonly headCommitId?: string
    }): Promise<IPipelineStatusDTO> {
        this.updateAttempts += 1
        this.lastConclusion = input.conclusion
        if (this.updateAttempts <= this.failAttempts) {
            return Promise.reject(new Error(`update failed ${this.updateAttempts}`))
        }

        return Promise.resolve({
            id: input.pipelineId ?? "check-1",
            name: "review",
            status: CHECK_RUN_STATUS.COMPLETED,
            conclusion: input.conclusion,
        })
    }
}

/**
 * Creates state for finalize-check stage tests.
 *
 * @param checkId Check run id.
 * @param externalContext External context payload.
 * @returns Pipeline state.
 */
function createState(
    checkId: string | null,
    externalContext: Readonly<Record<string, unknown>> | null,
): ReviewPipelineState {
    return ReviewPipelineState.create({
        runId: "run-finalize-check",
        definitionVersion: "v1",
        mergeRequest: {
            id: "mr-63",
            commits: [
                {
                    id: "head-63",
                },
            ],
        },
        config: {},
        checkId,
        externalContext,
    })
}

describe("FinalizeCheckStageUseCase", () => {
    test("finalizes check with success conclusion when review decision is approved", async () => {
        const pipelineStatusProvider = new InMemoryGitPipelineStatusProvider()
        const useCase = new FinalizeCheckStageUseCase({
            pipelineStatusProvider,
            defaults: checkRunDefaults,
        })
        const state = createState("check-63", {
            reviewDecision: {
                decision: "approved",
            },
            summary: {
                text: "All good",
            },
        })

        const result = await useCase.execute({
            state,
        })

        expect(result.isOk).toBe(true)
        expect(result.value.metadata?.checkpointHint).toBe("check:finalized")
        expect(pipelineStatusProvider.lastConclusion).toBe(CHECK_RUN_CONCLUSION.SUCCESS)
        const payload = result.value.state.externalContext?.["finalizeCheck"] as
            | Readonly<Record<string, unknown>>
            | undefined
        expect(payload?.["attempts"]).toBe(1)
        expect(payload?.["conclusion"]).toBe(CHECK_RUN_CONCLUSION.SUCCESS)
    })

    test("retries check update and succeeds on later attempt", async () => {
        const pipelineStatusProvider = new InMemoryGitPipelineStatusProvider()
        pipelineStatusProvider.failAttempts = 2
        const useCase = new FinalizeCheckStageUseCase({
            pipelineStatusProvider,
            defaults: checkRunDefaults,
        })
        const state = createState("check-63", {
            reviewDecision: {
                decision: "changes_requested",
            },
        })

        const result = await useCase.execute({
            state,
        })

        expect(result.isOk).toBe(true)
        expect(pipelineStatusProvider.updateAttempts).toBe(3)
        const payload = result.value.state.externalContext?.["finalizeCheck"] as
            | Readonly<Record<string, unknown>>
            | undefined
        expect(payload?.["attempts"]).toBe(3)
    })

    test("returns fail result when check id is missing", async () => {
        const pipelineStatusProvider = new InMemoryGitPipelineStatusProvider()
        const useCase = new FinalizeCheckStageUseCase({
            pipelineStatusProvider,
            defaults: checkRunDefaults,
        })
        const state = createState(null, null)

        const result = await useCase.execute({
            state,
        })

        expect(result.isFail).toBe(true)
        expect(result.error.recoverable).toBe(false)
        expect(result.error.message).toContain("check id")
    })

    test("returns recoverable stage error when retries are exhausted", async () => {
        const pipelineStatusProvider = new InMemoryGitPipelineStatusProvider()
        pipelineStatusProvider.failAttempts = 3
        const useCase = new FinalizeCheckStageUseCase({
            pipelineStatusProvider,
            defaults: checkRunDefaults,
        })
        const state = createState("check-63", {
            reviewDecision: {
                decision: "changes_requested",
            },
        })

        const result = await useCase.execute({
            state,
        })

        expect(result.isFail).toBe(true)
        expect(result.error.recoverable).toBe(true)
        expect(result.error.message).toContain("check run")
    })

    test("returns fail result when merge request id is missing", async () => {
        const pipelineStatusProvider = new InMemoryGitPipelineStatusProvider()
        const useCase = new FinalizeCheckStageUseCase({
            pipelineStatusProvider,
            defaults: checkRunDefaults,
        })
        const state = ReviewPipelineState.create({
            runId: "run-finalize-check",
            definitionVersion: "v1",
            mergeRequest: {},
            config: {},
            checkId: "check-63",
            externalContext: null,
        })

        const result = await useCase.execute({
            state,
        })

        expect(result.isFail).toBe(true)
        expect(result.error.recoverable).toBe(false)
        expect(result.error.message).toContain("merge request id")
    })
})
