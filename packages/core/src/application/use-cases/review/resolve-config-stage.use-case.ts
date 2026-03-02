import type {IReviewConfigDTO, IReviewPromptOverridesDTO} from "../../dto/review/review-config.dto"
import type {IRepositoryConfigLoader} from "../../ports/outbound/review/repository-config-loader.port"
import type {
    IPipelineStageUseCase,
    IStageCommand,
    IStageTransition,
} from "../../types/review/pipeline-stage.contract"
import {StageError} from "../../../domain/errors/stage.error"
import {NotFoundError} from "../../../domain/errors/not-found.error"
import {Result} from "../../../shared/result"
import {INITIAL_STAGE_ATTEMPT, readStringField} from "./pipeline-stage-state.utils"

const DEFAULT_REVIEW_CONFIG: IReviewConfigDTO = {
    severityThreshold: "MEDIUM",
    ignorePaths: [],
    maxSuggestionsPerFile: 5,
    maxSuggestionsPerCCR: 30,
    cadence: "standard",
    customRuleIds: [],
}

/**
 * Stage 3 use case. Resolves layered review configuration (default -> org -> repo).
 */
export class ResolveConfigStageUseCase implements IPipelineStageUseCase {
    public readonly stageId = "resolve-config"
    public readonly stageName = "Resolve Config"

    private readonly repositoryConfigLoader: IRepositoryConfigLoader

    /**
     * Creates resolve-config stage use case.
     *
     * @param repositoryConfigLoader Layered config loader dependency.
     */
    public constructor(repositoryConfigLoader: IRepositoryConfigLoader) {
        this.repositoryConfigLoader = repositoryConfigLoader
    }

    /**
     * Loads all config layers and merges them into pipeline context.
     *
     * @param input Stage execution input.
     * @returns Updated state transition or stage error.
     */
    public async execute(input: IStageCommand): Promise<Result<IStageTransition, StageError>> {
        const repositoryId = this.resolveRepositoryId(input)
        if (repositoryId.isFail) {
            return Result.fail<IStageTransition, StageError>(repositoryId.error)
        }

        const organizationId = this.resolveOrganizationId(input)
        if (organizationId.isFail) {
            return Result.fail<IStageTransition, StageError>(organizationId.error)
        }

        const teamId = this.resolveTeamId(input)
        if (teamId.isFail) {
            return Result.fail<IStageTransition, StageError>(teamId.error)
        }

        try {
            const defaultLayer = await this.repositoryConfigLoader.loadDefault()
            const organizationLayer = await this.repositoryConfigLoader.loadOrganization(
                organizationId.value,
                teamId.value,
            )
            const repositoryLayer = await this.repositoryConfigLoader.loadRepository(repositoryId.value)

            const mergedConfig = this.mergeConfigLayers([
                DEFAULT_REVIEW_CONFIG,
                defaultLayer ?? {},
                organizationLayer ?? {},
                repositoryLayer ?? {},
            ])
            const mergedConfigPayload: Readonly<Record<string, unknown>> = {
                ...mergedConfig,
            }

            return Result.ok<IStageTransition, StageError>({
                state: input.state.with({
                    config: mergedConfigPayload,
                }),
                metadata: {
                    checkpointHint: "config:resolved",
                },
            })
        } catch (error: unknown) {
            return Result.fail<IStageTransition, StageError>(
                this.createStageError(
                    input.state.runId,
                    input.state.definitionVersion,
                    "Failed to resolve repository configuration layers",
                    true,
                    error instanceof Error ? error : undefined,
                ),
            )
        }
    }

    /**
     * Resolves repository id from merge request context.
     *
     * @param input Stage input payload.
     * @returns Repository id or stage error.
     */
    private resolveRepositoryId(input: IStageCommand): Result<string, StageError> {
        const repositoryId =
            readStringField(input.state.mergeRequest, "repositoryId") ??
            readStringField(input.state.mergeRequest, "projectId") ??
            readStringField(input.state.mergeRequest, "id")
        if (repositoryId === undefined) {
            return Result.fail<string, StageError>(
                this.createRequiredContextError(
                    input.state.runId,
                    input.state.definitionVersion,
                    new NotFoundError("Repository", "repositoryId"),
                    "Missing repository identifier in merge request context",
                ),
            )
        }

        return Result.ok<string, StageError>(repositoryId)
    }

    /**
     * Resolves organization id from merge request context.
     *
     * @param input Stage input payload.
     * @returns Organization id or stage error.
     */
    private resolveOrganizationId(input: IStageCommand): Result<string, StageError> {
        const organizationId = readStringField(input.state.mergeRequest, "organizationId")
        if (organizationId === undefined) {
            return Result.fail<string, StageError>(
                this.createRequiredContextError(
                    input.state.runId,
                    input.state.definitionVersion,
                    new NotFoundError("Organization", "organizationId"),
                    "Missing organization identifier in merge request context",
                ),
            )
        }

        return Result.ok<string, StageError>(organizationId)
    }

    /**
     * Resolves team id from merge request context.
     *
     * @param input Stage input payload.
     * @returns Team id or stage error.
     */
    private resolveTeamId(input: IStageCommand): Result<string, StageError> {
        const teamId = readStringField(input.state.mergeRequest, "teamId")
        if (teamId === undefined) {
            return Result.fail<string, StageError>(
                this.createRequiredContextError(
                    input.state.runId,
                    input.state.definitionVersion,
                    new NotFoundError("Team", "teamId"),
                    "Missing team identifier in merge request context",
                ),
            )
        }

        return Result.ok<string, StageError>(teamId)
    }

    /**
     * Merges config layers in deterministic order.
     *
     * @param layers Configuration layers.
     * @returns Fully merged config payload.
     */
    private mergeConfigLayers(layers: readonly Partial<IReviewConfigDTO>[]): IReviewConfigDTO {
        let currentConfig = {
            ...DEFAULT_REVIEW_CONFIG,
        }

        for (const layer of layers) {
            currentConfig = {
                ...currentConfig,
                ...layer,
                promptOverrides: this.mergePromptOverrides(
                    currentConfig.promptOverrides,
                    layer.promptOverrides,
                ),
            }
        }

        return {
            ...currentConfig,
        }
    }

    /**
     * Merges optional prompt override layers.
     *
     * @param current Current prompt overrides.
     * @param patch Next prompt override patch.
     * @returns Merged prompt overrides or undefined.
     */
    private mergePromptOverrides(
        current: IReviewPromptOverridesDTO | undefined,
        patch: IReviewPromptOverridesDTO | undefined,
    ): IReviewPromptOverridesDTO | undefined {
        if (current === undefined && patch === undefined) {
            return undefined
        }

        return {
            ...(current ?? {}),
            ...(patch ?? {}),
        }
    }

    /**
     * Creates deterministic stage error for missing context data.
     *
     * @param runId Pipeline run id.
     * @param definitionVersion Definition version.
     * @param originalError Wrapped domain error.
     * @param message Error message.
     * @returns Stage error.
     */
    private createRequiredContextError(
        runId: string,
        definitionVersion: string,
        originalError: Error,
        message: string,
    ): StageError {
        return this.createStageError(runId, definitionVersion, message, false, originalError)
    }

    /**
     * Creates normalized stage error payload.
     *
     * @param runId Pipeline run id.
     * @param definitionVersion Pinned definition version.
     * @param message Error message.
     * @param recoverable Recoverable failure flag.
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
