import type {
    IPipelineStageUseCase,
    IStageCommand,
    IStageTransition,
} from "../../types/review/pipeline-stage.contract"
import type {IValidationErrorField} from "../../../domain/errors/validation.error"
import {StageError} from "../../../domain/errors/stage.error"
import {ValidationError} from "../../../domain/errors/validation.error"
import {Result} from "../../../shared/result"
import {
    INITIAL_STAGE_ATTEMPT,
    mergeExternalContext,
    readStringField,
    resolveCurrentHeadCommitId,
} from "./pipeline-stage-state.utils"

/**
 * Stage 2 use case. Detects whether merge request has new commits since last review.
 */
export class ValidateNewCommitsStageUseCase implements IPipelineStageUseCase {
    public readonly stageId: string
    public readonly stageName: string

    /**
     * Creates validate-new-commits stage use case.
     */
    public constructor() {
        this.stageId = "validate-new-commits"
        this.stageName = "Validate New Commits"
    }

    /**
     * Validates commit delta and returns skip metadata when no new commits are present.
     *
     * @param input Stage execution input.
     * @returns Updated state transition or stage error.
     */
    public execute(input: IStageCommand): Promise<Result<IStageTransition, StageError>> {
        try {
            const currentHeadCommitId = resolveCurrentHeadCommitId(input.state.mergeRequest)
            if (currentHeadCommitId === undefined) {
                return Promise.resolve(
                    Result.fail<IStageTransition, StageError>(
                        this.createValidationFailure(
                            input.state.runId,
                            input.state.definitionVersion,
                            [
                                {
                                    field: "mergeRequest.currentHeadCommitId",
                                    message:
                                        "current head commit id is required (explicit field or commits tail)",
                                },
                            ],
                        ),
                    ),
                )
            }

            const lastReviewedCommitId = readStringField(
                input.state.mergeRequest,
                "lastReviewedCommitId",
            )
            const hasNewCommits =
                lastReviewedCommitId === undefined || lastReviewedCommitId !== currentHeadCommitId

            if (!hasNewCommits) {
                const skippedState = input.state.with({
                    files: [],
                    suggestions: [],
                    discardedSuggestions: [],
                    externalContext: null,
                })

                return Promise.resolve(
                    Result.ok<IStageTransition, StageError>({
                        state: skippedState,
                        metadata: {
                            checkpointHint: "skip:no-new-commits",
                            notes: "No new commits detected since previous review",
                        },
                    }),
                )
            }

            const nextState = input.state.with({
                externalContext: mergeExternalContext(input.state.externalContext, {
                    commitValidation: {
                        hasNewCommits,
                        currentHeadCommitId,
                        lastReviewedCommitId: lastReviewedCommitId ?? null,
                    },
                }),
            })

            return Promise.resolve(
                Result.ok<IStageTransition, StageError>({
                    state: nextState,
                    metadata: {
                        checkpointHint: "new-commits:detected",
                    },
                }),
            )
        } catch (error: unknown) {
            return Promise.resolve(
                Result.fail<IStageTransition, StageError>(
                    this.createStageError(
                        input.state.runId,
                        input.state.definitionVersion,
                        "Failed to validate commit delta for review run",
                        false,
                        error instanceof Error ? error : undefined,
                    ),
                ),
            )
        }
    }

    /**
     * Creates stage error from config validation branch.
     *
     * @param runId Pipeline run id.
     * @param definitionVersion Definition version.
     * @param fields Validation field issues.
     * @returns Stage error.
     */
    private createValidationFailure(
        runId: string,
        definitionVersion: string,
        fields: readonly IValidationErrorField[],
    ): StageError {
        return this.createStageError(
            runId,
            definitionVersion,
            "Merge request commit metadata validation failed",
            false,
            new ValidationError("Invalid commit validation input", fields),
        )
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
