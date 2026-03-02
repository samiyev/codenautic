import type {IUseCase} from "../../ports/inbound/use-case.port"
import type {ILogger} from "../../ports/outbound/common/logger.port"
import type {IDomainEventBus} from "../../ports/outbound/domain-event-bus.port"
import {
    PIPELINE_CHECKPOINT_STATUS,
    type IPipelineCheckpointStore,
} from "../../ports/outbound/review/pipeline-checkpoint-store.port"
import type {IPipelineDefinition, IPipelineDefinitionStage} from "../../types/review/pipeline-definition.type"
import {
    PIPELINE_STAGE_RESULT_STATUS,
    type IPipelineResult,
    type IPipelineStageExecutionResult,
} from "../../types/review/pipeline-result.type"
import type {IPipelineStageUseCase} from "../../types/review/pipeline-stage.contract"
import {ReviewPipelineState} from "../../types/review/review-pipeline-state"
import {PipelineCompleted} from "../../../domain/events/pipeline-completed"
import {PipelineFailed} from "../../../domain/events/pipeline-failed"
import {PipelineStarted} from "../../../domain/events/pipeline-started"
import {StageCompleted} from "../../../domain/events/stage-completed"
import {StageFailed} from "../../../domain/events/stage-failed"
import {StageStarted} from "../../../domain/events/stage-started"
import {StageError} from "../../../domain/errors/stage.error"
import {Result} from "../../../shared/result"

/**
 * Pipeline run command payload.
 */
export interface IPipelineRunCommand {
    initialState: ReviewPipelineState
    definition: IPipelineDefinition
    startFromStageId?: string
}

/**
 * Constructor dependencies for pipeline orchestrator.
 */
export interface IPipelineOrchestratorDependencies {
    stages: Readonly<Record<string, IPipelineStageUseCase>>
    domainEventBus: IDomainEventBus
    checkpointStore: IPipelineCheckpointStore
    logger: ILogger
    now?: () => Date
}

/**
 * Stage failure handler context.
 */
interface IStageFailureContext {
    stageDefinition: IPipelineDefinitionStage
    attempt: number
    durationMs: number
}

/**
 * Review pipeline orchestrator use case.
 */
export class PipelineOrchestratorUseCase
    implements IUseCase<IPipelineRunCommand, IPipelineResult, StageError>
{
    private readonly stages: Readonly<Record<string, IPipelineStageUseCase>>
    private readonly domainEventBus: IDomainEventBus
    private readonly checkpointStore: IPipelineCheckpointStore
    private readonly logger: ILogger
    private readonly nowProvider: () => Date

    /**
     * Creates orchestrator instance.
     *
     * @param dependencies Use case dependencies.
     */
    public constructor(dependencies: IPipelineOrchestratorDependencies) {
        this.stages = dependencies.stages
        this.domainEventBus = dependencies.domainEventBus
        this.checkpointStore = dependencies.checkpointStore
        this.logger = dependencies.logger
        this.nowProvider = dependencies.now ?? (() => new Date())
    }

    /**
     * Executes pipeline definition over immutable state.
     *
     * @param input Run command payload.
     * @returns Pipeline result or stage error.
     */
    public async execute(input: IPipelineRunCommand): Promise<Result<IPipelineResult, StageError>> {
        const pinnedStateResult = this.pinDefinitionVersion(input.initialState, input.definition)
        if (pinnedStateResult.isFail) {
            return Result.fail<IPipelineResult, StageError>(pinnedStateResult.error)
        }

        const startIndexResult = this.resolveStartIndex(
            pinnedStateResult.value,
            input.definition,
            input.startFromStageId,
        )
        if (startIndexResult.isFail) {
            return Result.fail<IPipelineResult, StageError>(startIndexResult.error)
        }

        const startedAt = this.nowProvider()
        const firstStage = input.definition.stages[startIndexResult.value]
        if (firstStage === undefined) {
            return Result.fail<IPipelineResult, StageError>(
                this.createPipelineError(
                    pinnedStateResult.value,
                    input.definition.definitionVersion,
                    "missing-start-stage",
                    "Pipeline definition has no stage at resolved start index",
                ),
            )
        }

        await this.publishPipelineStarted(pinnedStateResult.value, input.definition, firstStage.stageId)

        const skippedResults = this.createSkippedResults(
            pinnedStateResult.value,
            input.definition.stages,
            startIndexResult.value,
        )
        const runResult = await this.runStages(
            pinnedStateResult.value,
            input.definition,
            startIndexResult.value,
            skippedResults,
            startedAt,
        )

        if (runResult.isFail) {
            return Result.fail<IPipelineResult, StageError>(runResult.error)
        }

        return Result.ok<IPipelineResult, StageError>(runResult.value)
    }

    /**
     * Resolves start index from optional stage id.
     *
     * @param state Current state.
     * @param definition Pipeline definition.
     * @param startFromStageId Optional stage id.
     * @returns Start index or stage error.
     */
    private resolveStartIndex(
        state: ReviewPipelineState,
        definition: IPipelineDefinition,
        startFromStageId: string | undefined,
    ): Result<number, StageError> {
        if (definition.stages.length === 0) {
            return Result.fail<number, StageError>(
                this.createPipelineError(
                    state,
                    definition.definitionVersion,
                    "pipeline-definition",
                    "Pipeline definition must contain at least one stage",
                ),
            )
        }

        if (startFromStageId === undefined) {
            return Result.ok<number, StageError>(0)
        }

        const startIndex = definition.stages.findIndex((stage): boolean => {
            return stage.stageId === startFromStageId
        })

        if (startIndex < 0) {
            return Result.fail<number, StageError>(
                this.createPipelineError(
                    state,
                    definition.definitionVersion,
                    startFromStageId,
                    "startFromStageId does not exist in pipeline definition",
                ),
            )
        }

        return Result.ok<number, StageError>(startIndex)
    }

    /**
     * Pins definition version into state.
     *
     * @param state Current state.
     * @param definition Pipeline definition.
     * @returns Pinned state or stage error.
     */
    private pinDefinitionVersion(
        state: ReviewPipelineState,
        definition: IPipelineDefinition,
    ): Result<ReviewPipelineState, StageError> {
        if (state.definitionVersion === definition.definitionVersion) {
            return Result.ok<ReviewPipelineState, StageError>(state)
        }

        if (state.hasProgress) {
            return Result.fail<ReviewPipelineState, StageError>(
                this.createPipelineError(
                    state,
                    definition.definitionVersion,
                    "pipeline-definition",
                    "Cannot change definitionVersion for in-flight pipeline run",
                ),
            )
        }

        return Result.ok<ReviewPipelineState, StageError>(
            state.with({
                definitionVersion: definition.definitionVersion,
            }),
        )
    }

    /**
     * Runs stages and accumulates execution result.
     *
     * @param initialState Initial run state.
     * @param definition Pipeline definition.
     * @param startIndex Stage start index.
     * @param stageResults Initial stage results.
     * @param startedAt Run start time.
     * @returns Pipeline result or stage error.
     */
    private async runStages(
        initialState: ReviewPipelineState,
        definition: IPipelineDefinition,
        startIndex: number,
        stageResults: IPipelineStageExecutionResult[],
        startedAt: Date,
    ): Promise<Result<IPipelineResult, StageError>> {
        let state = initialState

        for (const stage of definition.stages.slice(startIndex)) {
            const stageResult = await this.executeOneStage(state, definition, stage)
            if (stageResult.isFail) {
                return Result.fail<IPipelineResult, StageError>(stageResult.error)
            }

            state = stageResult.value.state
            stageResults.push(stageResult.value.execution)
        }

        const finishedAt = this.nowProvider()
        const totalDurationMs = this.calculateDurationMs(startedAt, finishedAt)

        await this.publishPipelineCompleted(state, definition, totalDurationMs, stageResults.length)
        await this.logger.info("Pipeline execution completed", {
            runId: state.runId,
            definitionVersion: definition.definitionVersion,
            stageCount: stageResults.length,
            totalDurationMs,
        })

        return Result.ok<IPipelineResult, StageError>({
            runId: state.runId,
            definitionVersion: definition.definitionVersion,
            context: state,
            stageResults,
            totalDurationMs,
            success: true,
        })
    }

    /**
     * Executes one stage with lifecycle and checkpoint side effects.
     *
     * @param state Current state.
     * @param definition Pipeline definition.
     * @param stageDefinition Stage definition entry.
     * @returns Updated state + stage result or stage error.
     */
    private async executeOneStage(
        state: ReviewPipelineState,
        definition: IPipelineDefinition,
        stageDefinition: IPipelineDefinitionStage,
    ): Promise<Result<{state: ReviewPipelineState; execution: IPipelineStageExecutionResult}, StageError>> {
        const stageUseCase = this.stages[stageDefinition.stageId]
        if (stageUseCase === undefined) {
            return Result.fail<{state: ReviewPipelineState; execution: IPipelineStageExecutionResult}, StageError>(
                this.createPipelineError(
                    state,
                    definition.definitionVersion,
                    stageDefinition.stageId,
                    "No stage implementation registered for stageId",
                ),
            )
        }

        const attempt = state.getStageAttempt(stageDefinition.stageId) + 1
        const startedState = state
            .incrementStageAttempt(stageDefinition.stageId)
            .with({
                currentStageId: stageDefinition.stageId,
            })
        const stageStartedAt = this.nowProvider()

        await this.saveCheckpoint(startedState, stageDefinition.stageId, attempt, PIPELINE_CHECKPOINT_STATUS.STARTED)
        await this.publishStageStarted(startedState, definition, stageDefinition.stageId, attempt)

        const transitionResult = await stageUseCase.execute({
            state: startedState,
        })
        const stageFinishedAt = this.nowProvider()
        const durationMs = this.calculateDurationMs(stageStartedAt, stageFinishedAt)

        if (transitionResult.isFail) {
            return this.handleStageFailure(
                startedState,
                definition,
                {
                    stageDefinition,
                    attempt,
                    durationMs,
                },
                transitionResult.error,
            )
        }

        return this.handleStageSuccess(
            transitionResult.value.state,
            definition,
            stageDefinition,
            attempt,
            durationMs,
        )
    }

    /**
     * Creates skipped stage records before resume start index.
     *
     * @param state Current state.
     * @param stages All pipeline stages.
     * @param startIndex Resume start index.
     * @returns Skipped stage records.
     */
    private createSkippedResults(
        state: ReviewPipelineState,
        stages: readonly IPipelineDefinitionStage[],
        startIndex: number,
    ): IPipelineStageExecutionResult[] {
        const skippedResults: IPipelineStageExecutionResult[] = []

        for (const skippedStage of stages.slice(0, startIndex)) {
            skippedResults.push({
                stageId: skippedStage.stageId,
                stageName: skippedStage.stageName,
                durationMs: 0,
                status: PIPELINE_STAGE_RESULT_STATUS.SKIPPED,
                attempt: state.getStageAttempt(skippedStage.stageId),
            })
        }

        return skippedResults
    }

    /**
     * Handles stage failure side effects.
     *
     * @param state State at stage start.
     * @param definition Pipeline definition.
     * @param stageDefinition Stage definition entry.
     * @param attempt Attempt number.
     * @param durationMs Stage duration.
     * @param error Stage error.
     * @returns Failed result.
     */
    private async handleStageFailure(
        state: ReviewPipelineState,
        definition: IPipelineDefinition,
        context: IStageFailureContext,
        error: StageError,
    ): Promise<Result<{state: ReviewPipelineState; execution: IPipelineStageExecutionResult}, StageError>> {
        const normalizedError = this.normalizeStageError(
            error,
            state,
            definition.definitionVersion,
            context.stageDefinition.stageId,
            context.attempt,
        )

        await this.saveCheckpoint(
            state,
            context.stageDefinition.stageId,
            context.attempt,
            PIPELINE_CHECKPOINT_STATUS.FAILED,
        )
        await this.publishStageFailed(
            state,
            definition,
            context.stageDefinition.stageId,
            context.attempt,
            normalizedError,
        )
        await this.publishPipelineFailed(state, definition, context.stageDefinition.stageId, normalizedError)
        await this.logger.error("Pipeline stage failed", {
            runId: state.runId,
            definitionVersion: definition.definitionVersion,
            stageId: context.stageDefinition.stageId,
            attempt: context.attempt,
            durationMs: context.durationMs,
            errorCode: normalizedError.code,
            recoverable: normalizedError.recoverable,
        })

        return Result.fail<{state: ReviewPipelineState; execution: IPipelineStageExecutionResult}, StageError>(
            normalizedError,
        )
    }

    /**
     * Handles successful stage completion side effects.
     *
     * @param state Stage transition state.
     * @param definition Pipeline definition.
     * @param stageDefinition Stage definition entry.
     * @param attempt Attempt number.
     * @param durationMs Stage duration.
     * @returns Successful stage execution result.
     */
    private async handleStageSuccess(
        state: ReviewPipelineState,
        definition: IPipelineDefinition,
        stageDefinition: IPipelineDefinitionStage,
        attempt: number,
        durationMs: number,
    ): Promise<Result<{state: ReviewPipelineState; execution: IPipelineStageExecutionResult}, StageError>> {
        const completedState = state.with({
            definitionVersion: definition.definitionVersion,
            currentStageId: stageDefinition.stageId,
            lastCompletedStageId: stageDefinition.stageId,
        })

        await this.saveCheckpoint(
            completedState,
            stageDefinition.stageId,
            attempt,
            PIPELINE_CHECKPOINT_STATUS.COMPLETED,
        )
        await this.publishStageCompleted(
            completedState,
            definition,
            stageDefinition.stageId,
            attempt,
            durationMs,
        )
        await this.logger.debug("Pipeline stage completed", {
            runId: completedState.runId,
            definitionVersion: definition.definitionVersion,
            stageId: stageDefinition.stageId,
            attempt,
            durationMs,
        })

        return Result.ok<{state: ReviewPipelineState; execution: IPipelineStageExecutionResult}, StageError>({
            state: completedState,
            execution: {
                stageId: stageDefinition.stageId,
                stageName: stageDefinition.stageName,
                durationMs,
                status: PIPELINE_STAGE_RESULT_STATUS.OK,
                attempt,
            },
        })
    }

    /**
     * Persists stage checkpoint.
     *
     * @param state Current state.
     * @param currentStageId Stage id.
     * @param attempt Stage attempt.
     * @param status Checkpoint status.
     * @returns Promise resolved after checkpoint save.
     */
    private async saveCheckpoint(
        state: ReviewPipelineState,
        currentStageId: string,
        attempt: number,
        status: (typeof PIPELINE_CHECKPOINT_STATUS)[keyof typeof PIPELINE_CHECKPOINT_STATUS],
    ): Promise<void> {
        await this.checkpointStore.save({
            runId: state.runId,
            definitionVersion: state.definitionVersion,
            currentStageId,
            lastCompletedStageId: state.lastCompletedStageId,
            attempt,
            status,
            occurredAt: this.nowProvider(),
        })
    }

    /**
     * Normalizes stage error metadata to current execution context.
     *
     * @param error Original stage error.
     * @param state Current state.
     * @param definitionVersion Definition version.
     * @param stageId Stage identifier.
     * @param attempt Stage attempt.
     * @returns Normalized stage error.
     */
    private normalizeStageError(
        error: StageError,
        state: ReviewPipelineState,
        definitionVersion: string,
        stageId: string,
        attempt: number,
    ): StageError {
        const isSameRun = error.runId === state.runId
        const isSameDefinition = error.definitionVersion === definitionVersion
        const isSameStage = error.stageId === stageId
        const isSameAttempt = error.attempt === attempt

        if (isSameRun && isSameDefinition && isSameStage && isSameAttempt) {
            return error
        }

        return new StageError({
            runId: state.runId,
            definitionVersion,
            stageId,
            attempt,
            recoverable: error.recoverable,
            message: error.message,
            originalError: error,
        })
    }

    /**
     * Publishes pipeline started event.
     *
     * @param state Current state.
     * @param definition Pipeline definition.
     * @param startedStageId First stage id.
     * @returns Promise resolved after publication.
     */
    private async publishPipelineStarted(
        state: ReviewPipelineState,
        definition: IPipelineDefinition,
        startedStageId: string,
    ): Promise<void> {
        await this.domainEventBus.publish([
            new PipelineStarted(state.runId, {
                runId: state.runId,
                definitionVersion: definition.definitionVersion,
                startedStageId,
            }),
        ])
    }

    /**
     * Publishes stage started event.
     *
     * @param state Current state.
     * @param definition Pipeline definition.
     * @param stageId Stage identifier.
     * @param attempt Stage attempt.
     * @returns Promise resolved after publication.
     */
    private async publishStageStarted(
        state: ReviewPipelineState,
        definition: IPipelineDefinition,
        stageId: string,
        attempt: number,
    ): Promise<void> {
        await this.domainEventBus.publish([
            new StageStarted(state.runId, {
                runId: state.runId,
                definitionVersion: definition.definitionVersion,
                stageId,
                attempt,
            }),
        ])
    }

    /**
     * Publishes stage completed event.
     *
     * @param state Current state.
     * @param definition Pipeline definition.
     * @param stageId Stage identifier.
     * @param attempt Stage attempt.
     * @param durationMs Stage duration.
     * @returns Promise resolved after publication.
     */
    private async publishStageCompleted(
        state: ReviewPipelineState,
        definition: IPipelineDefinition,
        stageId: string,
        attempt: number,
        durationMs: number,
    ): Promise<void> {
        await this.domainEventBus.publish([
            new StageCompleted(state.runId, {
                runId: state.runId,
                definitionVersion: definition.definitionVersion,
                stageId,
                attempt,
                durationMs,
            }),
        ])
    }

    /**
     * Publishes stage failed event.
     *
     * @param state Current state.
     * @param definition Pipeline definition.
     * @param stageId Stage identifier.
     * @param attempt Stage attempt.
     * @param error Stage error.
     * @returns Promise resolved after publication.
     */
    private async publishStageFailed(
        state: ReviewPipelineState,
        definition: IPipelineDefinition,
        stageId: string,
        attempt: number,
        error: StageError,
    ): Promise<void> {
        await this.domainEventBus.publish([
            new StageFailed(state.runId, {
                runId: state.runId,
                definitionVersion: definition.definitionVersion,
                stageId,
                attempt,
                recoverable: error.recoverable,
                errorCode: error.code,
            }),
        ])
    }

    /**
     * Publishes pipeline completed event.
     *
     * @param state Current state.
     * @param definition Pipeline definition.
     * @param totalDurationMs Total duration.
     * @param stageCount Executed stage count.
     * @returns Promise resolved after publication.
     */
    private async publishPipelineCompleted(
        state: ReviewPipelineState,
        definition: IPipelineDefinition,
        totalDurationMs: number,
        stageCount: number,
    ): Promise<void> {
        await this.domainEventBus.publish([
            new PipelineCompleted(state.runId, {
                runId: state.runId,
                definitionVersion: definition.definitionVersion,
                totalDurationMs,
                stageCount,
            }),
        ])
    }

    /**
     * Publishes pipeline failed event.
     *
     * @param state Current state.
     * @param definition Pipeline definition.
     * @param stageId Failed stage id.
     * @param error Stage error.
     * @returns Promise resolved after publication.
     */
    private async publishPipelineFailed(
        state: ReviewPipelineState,
        definition: IPipelineDefinition,
        stageId: string,
        error: StageError,
    ): Promise<void> {
        await this.domainEventBus.publish([
            new PipelineFailed(state.runId, {
                runId: state.runId,
                definitionVersion: definition.definitionVersion,
                failedStageId: stageId,
                terminal: error.recoverable === false,
                reason: error.message,
            }),
        ])
    }

    /**
     * Calculates duration in milliseconds.
     *
     * @param startedAt Start timestamp.
     * @param finishedAt Finish timestamp.
     * @returns Duration in milliseconds.
     */
    private calculateDurationMs(startedAt: Date, finishedAt: Date): number {
        return Math.max(0, finishedAt.getTime() - startedAt.getTime())
    }

    /**
     * Creates non-recoverable pipeline-level stage error.
     *
     * @param state Current state.
     * @param definitionVersion Definition version.
     * @param stageId Stage identifier.
     * @param message Error message.
     * @returns Stage error instance.
     */
    private createPipelineError(
        state: ReviewPipelineState,
        definitionVersion: string,
        stageId: string,
        message: string,
    ): StageError {
        return new StageError({
            runId: state.runId,
            definitionVersion,
            stageId,
            attempt: 1,
            recoverable: false,
            message,
        })
    }
}

/**
 * Backward-compatible alias for previous runner naming.
 */
export const PipelineRunner = PipelineOrchestratorUseCase
