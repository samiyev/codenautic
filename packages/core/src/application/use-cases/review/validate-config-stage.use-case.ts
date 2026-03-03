import type {IUseCase} from "../../ports/inbound/use-case.port"
import {
    type IConfigurationValidatorInput,
    ConfigurationValidatorUseCase,
} from "../configuration-validator.use-case"
import type {ValidatedConfig} from "../../dto/review/review-config.dto"
import type {
    IPipelineStageUseCase,
    IStageCommand,
    IStageTransition,
} from "../../types/review/pipeline-stage.contract"
import {StageError} from "../../../domain/errors/stage.error"
import {ValidationError} from "../../../domain/errors/validation.error"
import {Result} from "../../../shared/result"
import {INITIAL_STAGE_ATTEMPT} from "./pipeline-stage-state.utils"

/**
 * Stage 4 use case. Validates and normalizes resolved review config schema.
 */
export class ValidateConfigStageUseCase implements IPipelineStageUseCase {
    public readonly stageId: string
    public readonly stageName: string
    private readonly configValidator: IUseCase<
        IConfigurationValidatorInput,
        ValidatedConfig,
        ValidationError
    >

    /**
     * Creates validate-config stage use case.
     */
    public constructor(
        configValidator: IUseCase<
            IConfigurationValidatorInput,
            ValidatedConfig,
            ValidationError
        > = new ConfigurationValidatorUseCase(),
    ) {
        this.stageId = "validate-config"
        this.stageName = "Validate Config"
        this.configValidator = configValidator
    }

    /**
     * Validates config snapshot and writes normalized config into context.
     *
     * @param input Stage execution input.
     * @returns Updated state transition or stage error.
     */
    public async execute(input: IStageCommand): Promise<Result<IStageTransition, StageError>> {
        try {
            const validationResult = await this.configValidator.execute(input.state.config)
            if (validationResult.isFail) {
                return Result.fail<IStageTransition, StageError>(
                    this.createStageError(
                        input.state.runId,
                        input.state.definitionVersion,
                        "Resolved review config is invalid",
                        false,
                        validationResult.error,
                    ),
                )
            }

            return Result.ok<IStageTransition, StageError>({
                state: input.state.with({
                    config: validationResult.value,
                }),
                metadata: {
                    checkpointHint: "config:validated",
                },
            })
        } catch (error: unknown) {
            return Result.fail<IStageTransition, StageError>(
                this.createStageError(
                    input.state.runId,
                    input.state.definitionVersion,
                    "Failed to validate review config schema",
                    false,
                    error instanceof Error ? error : undefined,
                ),
            )
        }
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
