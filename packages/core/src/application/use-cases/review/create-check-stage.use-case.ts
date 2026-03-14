import type {IGitPipelineStatusProvider} from "../../ports/outbound/git/git-pipeline-status.port"
import type {
    IPipelineStageUseCase,
    IStageCommand,
    IStageTransition,
} from "../../types/review/pipeline-stage.contract"
import {NotFoundError} from "../../../domain/errors/not-found.error"
import {StageError} from "../../../domain/errors/stage.error"
import {Result} from "../../../shared/result"
import {
    INITIAL_STAGE_ATTEMPT,
    mergeExternalContext,
    resolveCurrentHeadCommitId,
    readStringField,
} from "./pipeline-stage-state.utils"
import type {IReviewCheckRunDefaults} from "../../dto/config/system-defaults.dto"

/**
 * Dependencies for create-check stage use case.
 */
export interface ICreateCheckStageDependencies {
    pipelineStatusProvider: IGitPipelineStatusProvider
    defaults: IReviewCheckRunDefaults
}

/**
 * Stage 5 use case. Creates pending external review status and stores checkId in state.
 */
export class CreateCheckStageUseCase implements IPipelineStageUseCase {
    public readonly stageId: string
    public readonly stageName: string

    private readonly pipelineStatusProvider: IGitPipelineStatusProvider
    private readonly checkRunName: string

    /**
     * Creates create-check stage use case.
     *
     * @param dependencies Stage dependencies.
     */
    public constructor(dependencies: ICreateCheckStageDependencies) {
        this.stageId = "create-check"
        this.stageName = "Create Check"
        this.pipelineStatusProvider = dependencies.pipelineStatusProvider
        this.checkRunName = dependencies.defaults.checkRunName
    }

    /**
     * Creates pending external review status and updates pipeline state with check metadata.
     *
     * @param input Stage command payload.
     * @returns Updated stage transition or stage error.
     */
    public async execute(input: IStageCommand): Promise<Result<IStageTransition, StageError>> {
        const mergeRequestId = readStringField(input.state.mergeRequest, "id")
        if (mergeRequestId === undefined) {
            return Result.fail<IStageTransition, StageError>(
                this.createStageError(
                    input.state.runId,
                    input.state.definitionVersion,
                    "Missing merge request id for check creation",
                    false,
                    new NotFoundError("MergeRequest", "id"),
                ),
            )
        }

        try {
            const checkRun = await this.pipelineStatusProvider.createPipelineStatus({
                mergeRequestId,
                name: this.checkRunName,
                headCommitId: resolveCurrentHeadCommitId(input.state.mergeRequest),
            })

            return Result.ok<IStageTransition, StageError>({
                state: input.state.with({
                    checkId: checkRun.id,
                    externalContext: mergeExternalContext(input.state.externalContext, {
                        checkRun: {
                            id: checkRun.id,
                            name: checkRun.name,
                            status: checkRun.status,
                            conclusion: checkRun.conclusion,
                        },
                    }),
                }),
                metadata: {
                    checkpointHint: "check:created",
                },
            })
        } catch (error: unknown) {
            return Result.fail<IStageTransition, StageError>(
                this.createStageError(
                    input.state.runId,
                    input.state.definitionVersion,
                    "Failed to create check run",
                    true,
                    error instanceof Error ? error : undefined,
                ),
            )
        }
    }

    /**
     * Creates normalized stage error.
     *
     * @param runId Pipeline run id.
     * @param definitionVersion Pinned definition version.
     * @param message Error message.
     * @param recoverable Recoverable flag.
     * @param originalError Optional wrapped error.
     * @returns Stage error.
     */
    private createStageError(
        runId: string,
        definitionVersion: string,
        message: string,
        recoverable: boolean,
        originalError?: Error,
    ): StageError {
        return new StageError({
            runId,
            definitionVersion,
            stageId: this.stageId,
            attempt: INITIAL_STAGE_ATTEMPT,
            recoverable,
            message,
            originalError,
        })
    }
}
