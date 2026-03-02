import type {IUseCase} from "../../ports/inbound/use-case.port"
import {Result} from "../../../shared/result"
import {StageError} from "../../../domain/errors/stage.error"
import {ReviewPipelineState} from "./review-pipeline-state"

/**
 * Stage execution command payload.
 */
export interface IStageCommand {
    state: ReviewPipelineState
}

/**
 * Additional metadata returned by stage transition.
 */
export interface IStageTransitionMetadata {
    checkpointHint?: string
    notes?: string
}

/**
 * Stage execution transition payload.
 */
export interface IStageTransition {
    state: ReviewPipelineState
    metadata?: IStageTransitionMetadata
}

/**
 * Canonical stage contract implemented by use cases.
 */
export interface IPipelineStageUseCase extends IUseCase<IStageCommand, IStageTransition, StageError> {
    readonly stageId: string
    readonly stageName: string
}

/**
 * Backward-compatible stage adapter contract.
 */
export interface IPipelineStage {
    readonly name: string

    /**
     * Executes stage with direct state payload.
     *
     * @param ctx Current pipeline state.
     * @returns Updated state or stage error.
     */
    execute(ctx: ReviewPipelineState): Promise<Result<ReviewPipelineState, StageError>>
}

/**
 * Adapter that exposes legacy `IPipelineStage` from use case stage contract.
 */
export class PipelineStageUseCaseAdapter implements IPipelineStage {
    private readonly stageUseCase: IPipelineStageUseCase

    /**
     * Creates adapter for stage use case.
     *
     * @param stageUseCase Stage use case implementation.
     */
    public constructor(stageUseCase: IPipelineStageUseCase) {
        this.stageUseCase = stageUseCase
    }

    /**
     * Backward-compatible stage name.
     *
     * @returns Stage name.
     */
    public get name(): string {
        return this.stageUseCase.stageName
    }

    /**
     * Executes wrapped use case and returns next state.
     *
     * @param ctx Current pipeline state.
     * @returns Next state or stage error.
     */
    public async execute(ctx: ReviewPipelineState): Promise<Result<ReviewPipelineState, StageError>> {
        const transitionResult = await this.stageUseCase.execute({
            state: ctx,
        })

        if (transitionResult.isFail) {
            return Result.fail<ReviewPipelineState, StageError>(transitionResult.error)
        }

        return Result.ok<ReviewPipelineState, StageError>(transitionResult.value.state)
    }
}
