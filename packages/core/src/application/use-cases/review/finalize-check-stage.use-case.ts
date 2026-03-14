import {
    CHECK_RUN_CONCLUSION,
    CHECK_RUN_STATUS,
    type CheckRunConclusion,
} from "../../dto/git/check-run.dto"
import type {IPipelineStatusDTO} from "../../dto/git/pipeline-status.dto"
import type {IReviewCheckRunDefaults} from "../../dto/config/system-defaults.dto"
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

const MAX_CHECK_UPDATE_ATTEMPTS = 3

/**
 * Constructor dependencies for finalize-check stage.
 */
export interface IFinalizeCheckStageDependencies {
    pipelineStatusProvider: IGitPipelineStatusProvider
    defaults: IReviewCheckRunDefaults
}

/**
 * Stage 18 use case. Finalizes external review status with retry strategy.
 */
export class FinalizeCheckStageUseCase implements IPipelineStageUseCase {
    public readonly stageId: string
    public readonly stageName: string

    private readonly pipelineStatusProvider: IGitPipelineStatusProvider
    private readonly checkRunName: string

    /**
     * Creates finalize-check stage use case.
     *
     * @param dependencies Stage dependencies.
     */
    public constructor(dependencies: IFinalizeCheckStageDependencies) {
        this.stageId = "finalize-check"
        this.stageName = "Finalize Check"
        this.pipelineStatusProvider = dependencies.pipelineStatusProvider
        this.checkRunName = dependencies.defaults.checkRunName
    }

    /**
     * Finalizes review status with success/failure conclusion from review decision.
     *
     * @param input Stage command payload.
     * @returns Updated stage transition or stage error.
     */
    public async execute(input: IStageCommand): Promise<Result<IStageTransition, StageError>> {
        const checkId = input.state.checkId
        if (checkId === null) {
            return Result.fail<IStageTransition, StageError>(
                this.createStageError(
                    input.state.runId,
                    input.state.definitionVersion,
                    "Missing check id for check finalization stage",
                    false,
                    new NotFoundError("CheckRun", "id"),
                ),
            )
        }

        const mergeRequestId = readStringField(input.state.mergeRequest, "id")
        if (mergeRequestId === undefined) {
            return Result.fail<IStageTransition, StageError>(
                this.createStageError(
                    input.state.runId,
                    input.state.definitionVersion,
                    "Missing merge request id for check finalization stage",
                    false,
                    new NotFoundError("MergeRequest", "id"),
                ),
            )
        }

        const conclusion = this.resolveConclusion(input.state.externalContext)
        const summary = this.resolveSummary(input.state.externalContext)

        try {
            const updateResult = await this.updateCheckRunWithRetry({
                checkId,
                mergeRequestId,
                conclusion,
                summary,
                headCommitId: resolveCurrentHeadCommitId(input.state.mergeRequest),
            })

            return Result.ok<IStageTransition, StageError>({
                state: input.state.with({
                    externalContext: mergeExternalContext(input.state.externalContext, {
                        finalizeCheck: {
                            checkId,
                            status: updateResult.pipelineStatus.status,
                            conclusion: updateResult.pipelineStatus.conclusion,
                            attempts: updateResult.attempts,
                            summary,
                        },
                    }),
                }),
                metadata: {
                    checkpointHint: "check:finalized",
                },
            })
        } catch (error: unknown) {
            return Result.fail<IStageTransition, StageError>(
                this.createStageError(
                    input.state.runId,
                    input.state.definitionVersion,
                    "Failed to finalize check run after retries",
                    true,
                    error instanceof Error ? error : undefined,
                ),
            )
        }
    }

    /**
     * Resolves check conclusion from review decision payload.
     *
     * @param externalContext External context payload.
     * @returns Check run conclusion.
     */
    private resolveConclusion(
        externalContext: Readonly<Record<string, unknown>> | null,
    ): CheckRunConclusion {
        if (externalContext === null) {
            return CHECK_RUN_CONCLUSION.FAILURE
        }

        const reviewDecision = externalContext["reviewDecision"]
        if (reviewDecision === null || typeof reviewDecision !== "object" || Array.isArray(reviewDecision)) {
            return CHECK_RUN_CONCLUSION.FAILURE
        }

        const decision = (reviewDecision as Readonly<Record<string, unknown>>)["decision"]
        if (decision === "approved") {
            return CHECK_RUN_CONCLUSION.SUCCESS
        }

        return CHECK_RUN_CONCLUSION.FAILURE
    }

    /**
     * Resolves summary text from external context when available.
     *
     * @param externalContext External context payload.
     * @returns Summary text or null.
     */
    private resolveSummary(externalContext: Readonly<Record<string, unknown>> | null): string | null {
        if (externalContext === null) {
            return null
        }

        const summaryPayload = externalContext["summary"]
        if (summaryPayload === null || typeof summaryPayload !== "object" || Array.isArray(summaryPayload)) {
            return null
        }

        const summaryText = (summaryPayload as Readonly<Record<string, unknown>>)["text"]
        if (typeof summaryText !== "string") {
            return null
        }

        const normalizedText = summaryText.trim()
        if (normalizedText.length === 0) {
            return null
        }

        return normalizedText
    }

    /**
     * Updates external review status with bounded retry policy.
     *
     * @param input Update payload.
     * @returns Attempts used together with final pipeline status payload.
     * @throws Error When all attempts fail.
     */
    private async updateCheckRunWithRetry(input: {
        readonly checkId: string
        readonly mergeRequestId: string
        readonly conclusion: CheckRunConclusion
        readonly summary: string | null
        readonly headCommitId?: string
    }): Promise<{readonly attempts: number; readonly pipelineStatus: IPipelineStatusDTO}> {
        let lastError: Error | undefined = undefined

        for (let attempt = 1; attempt <= MAX_CHECK_UPDATE_ATTEMPTS; attempt += 1) {
            try {
                const pipelineStatus =
                    await this.pipelineStatusProvider.updatePipelineStatus({
                        pipelineId: input.checkId,
                        mergeRequestId: input.mergeRequestId,
                        name: this.checkRunName,
                        status: CHECK_RUN_STATUS.COMPLETED,
                        conclusion: input.conclusion,
                        summary: input.summary ?? undefined,
                        headCommitId: input.headCommitId,
                    })

                return {
                    attempts: attempt,
                    pipelineStatus,
                }
            } catch (error: unknown) {
                if (error instanceof Error) {
                    lastError = error
                }
            }
        }

        throw lastError ?? new Error("Check run update failed without explicit error")
    }

    /**
     * Creates normalized stage error payload.
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
