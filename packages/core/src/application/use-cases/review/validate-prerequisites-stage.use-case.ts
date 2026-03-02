import type {
    IPipelineStageUseCase,
    IStageCommand,
    IStageTransition,
} from "../../types/review/pipeline-stage.contract"
import {StageError} from "../../../domain/errors/stage.error"
import {NotFoundError} from "../../../domain/errors/not-found.error"
import {UnauthorizedError} from "../../../domain/errors/unauthorized.error"
import {Result} from "../../../shared/result"
import {
    INITIAL_STAGE_ATTEMPT,
    mergeExternalContext,
    readBooleanField,
    readStringField,
} from "./pipeline-stage-state.utils"

/**
 * Stage 1 use case. Validates review prerequisites before expensive pipeline work.
 */
export class ValidatePrerequisitesStageUseCase implements IPipelineStageUseCase {
    public readonly stageId: string
    public readonly stageName: string

    /**
     * Creates validate-prerequisites stage use case.
     */
    public constructor() {
        this.stageId = "validate-prerequisites"
        this.stageName = "Validate Prerequisites"
    }

    /**
     * Validates auth/token + tenancy prerequisites and enriches external context.
     *
     * @param input Stage execution input.
     * @returns Updated state transition or stage error.
     */
    public execute(input: IStageCommand): Promise<Result<IStageTransition, StageError>> {
        try {
            const authToken =
                readStringField(input.state.mergeRequest, "authToken") ??
                readStringField(input.state.mergeRequest, "accessToken")
            if (authToken === undefined) {
                return Promise.resolve(
                    Result.fail<IStageTransition, StageError>(
                    this.createPrerequisiteError(
                        input.state.runId,
                        input.state.definitionVersion,
                        "Missing auth token in merge request context",
                        new UnauthorizedError("review:run"),
                    ),
                    ),
                )
            }

            const organizationId = readStringField(input.state.mergeRequest, "organizationId")
            if (organizationId === undefined) {
                return Promise.resolve(
                    Result.fail<IStageTransition, StageError>(
                    this.createPrerequisiteError(
                        input.state.runId,
                        input.state.definitionVersion,
                        "Missing organizationId in merge request context",
                        new NotFoundError("Organization", "organizationId"),
                    ),
                    ),
                )
            }

            const teamId = readStringField(input.state.mergeRequest, "teamId")
            if (teamId === undefined) {
                return Promise.resolve(
                    Result.fail<IStageTransition, StageError>(
                    this.createPrerequisiteError(
                        input.state.runId,
                        input.state.definitionVersion,
                        "Missing teamId in merge request context",
                        new NotFoundError("Team", "teamId"),
                    ),
                    ),
                )
            }

            const licenseActive = readBooleanField(input.state.mergeRequest, "licenseActive")
            if (licenseActive !== true) {
                return Promise.resolve(
                    Result.fail<IStageTransition, StageError>(
                    this.createPrerequisiteError(
                        input.state.runId,
                        input.state.definitionVersion,
                        "Organization license is inactive",
                        new UnauthorizedError("license:active"),
                    ),
                    ),
                )
            }

            const nextState = input.state.with({
                externalContext: mergeExternalContext(input.state.externalContext, {
                    prerequisites: {
                        organizationId,
                        teamId,
                        hasAuthToken: true,
                        licenseActive: true,
                    },
                }),
            })

            return Promise.resolve(
                Result.ok<IStageTransition, StageError>({
                    state: nextState,
                    metadata: {
                        checkpointHint: "prerequisites:validated",
                    },
                }),
            )
        } catch (error: unknown) {
            return Promise.resolve(
                Result.fail<IStageTransition, StageError>(
                    this.createPrerequisiteError(
                        input.state.runId,
                        input.state.definitionVersion,
                        "Failed to validate pipeline prerequisites",
                        error instanceof Error ? error : undefined,
                    ),
                ),
            )
        }
    }

    /**
     * Creates normalized stage error for prerequisite validation branch.
     *
     * @param runId Pipeline run id.
     * @param definitionVersion Pinned definition version.
     * @param message Human-readable failure message.
     * @param originalError Optional wrapped error.
     * @returns Stage error.
     */
    private createPrerequisiteError(
        runId: string,
        definitionVersion: string,
        message: string,
        originalError?: Error,
    ): StageError {
        return new StageError({
            runId,
            definitionVersion,
            stageId: this.stageId,
            attempt: INITIAL_STAGE_ATTEMPT,
            recoverable: false,
            message,
            originalError,
        })
    }
}
