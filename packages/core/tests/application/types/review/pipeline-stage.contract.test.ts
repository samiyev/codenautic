import {describe, expect, test} from "bun:test"

import type {
    IPipelineStageUseCase,
    IStageCommand,
    IStageTransition,
} from "../../../../src/application/types/review/pipeline-stage.contract"
import {PipelineStageUseCaseAdapter} from "../../../../src/application/types/review/pipeline-stage.contract"
import {ReviewPipelineState} from "../../../../src/application/types/review/review-pipeline-state"
import {StageError} from "../../../../src/domain/errors/stage.error"
import {Result} from "../../../../src/shared/result"

class SuccessStageUseCase implements IPipelineStageUseCase {
    public readonly stageId = "stage-success"
    public readonly stageName = "Stage Success"

    public execute(_input: IStageCommand): Promise<Result<IStageTransition, StageError>> {
        const nextState = ReviewPipelineState.create({
            runId: "run-1",
            definitionVersion: "v1",
            mergeRequest: {},
            config: {},
            currentStageId: this.stageId,
        })

        return Promise.resolve(
            Result.ok<IStageTransition, StageError>({
                state: nextState,
            }),
        )
    }
}

class FailedStageUseCase implements IPipelineStageUseCase {
    public readonly stageId = "stage-failed"
    public readonly stageName = "Stage Failed"

    public execute(_input: IStageCommand): Promise<Result<IStageTransition, StageError>> {
        return Promise.resolve(
            Result.fail<IStageTransition, StageError>(
                new StageError({
                    runId: "run-1",
                    definitionVersion: "v1",
                    stageId: this.stageId,
                    attempt: 1,
                    recoverable: true,
                    message: "failed stage",
                }),
            ),
        )
    }
}

describe("PipelineStageUseCaseAdapter", () => {
    test("returns wrapped stage name and maps successful transition", async () => {
        const adapter = new PipelineStageUseCaseAdapter(new SuccessStageUseCase())
        const state = ReviewPipelineState.create({
            runId: "run-1",
            definitionVersion: "v1",
            mergeRequest: {},
            config: {},
        })

        const result = await adapter.execute(state)

        expect(adapter.name).toBe("Stage Success")
        expect(result.isOk).toBe(true)
        expect(result.value.currentStageId).toBe("stage-success")
    })

    test("passes through stage errors from wrapped use case", async () => {
        const adapter = new PipelineStageUseCaseAdapter(new FailedStageUseCase())
        const state = ReviewPipelineState.create({
            runId: "run-1",
            definitionVersion: "v1",
            mergeRequest: {},
            config: {},
        })

        const result = await adapter.execute(state)

        expect(result.isFail).toBe(true)
        expect(result.error.code).toBe("STAGE_ERROR")
        expect(result.error.stageId).toBe("stage-failed")
    })
})
