import type {IReviewConfigDTO, IReviewPromptOverridesDTO} from "../../dto/review/review-config.dto"
import type {
    IPipelineStageUseCase,
    IStageCommand,
    IStageTransition,
} from "../../types/review/pipeline-stage.contract"
import type {IValidationErrorField} from "../../../domain/errors/validation.error"
import {StageError} from "../../../domain/errors/stage.error"
import {ValidationError} from "../../../domain/errors/validation.error"
import {Result} from "../../../shared/result"
import {INITIAL_STAGE_ATTEMPT} from "./pipeline-stage-state.utils"

const ALLOWED_SEVERITY_THRESHOLDS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const

/**
 * Stage 4 use case. Validates and normalizes resolved review config schema.
 */
export class ValidateConfigStageUseCase implements IPipelineStageUseCase {
    public readonly stageId: string
    public readonly stageName: string

    /**
     * Creates validate-config stage use case.
     */
    public constructor() {
        this.stageId = "validate-config"
        this.stageName = "Validate Config"
    }

    /**
     * Validates config snapshot and writes normalized config into context.
     *
     * @param input Stage execution input.
     * @returns Updated state transition or stage error.
     */
    public execute(input: IStageCommand): Promise<Result<IStageTransition, StageError>> {
        try {
            const validationResult = this.validateConfigPayload(input.state.config)
            if (validationResult.isFail) {
                return Promise.resolve(
                    Result.fail<IStageTransition, StageError>(
                        this.createStageError(
                            input.state.runId,
                            input.state.definitionVersion,
                            "Resolved review config is invalid",
                            false,
                            validationResult.error,
                        ),
                    ),
                )
            }

            const validatedConfigPayload: Readonly<Record<string, unknown>> = {
                ...validationResult.value,
            }

            return Promise.resolve(
                Result.ok<IStageTransition, StageError>({
                    state: input.state.with({
                        config: validatedConfigPayload,
                    }),
                    metadata: {
                        checkpointHint: "config:validated",
                    },
                }),
            )
        } catch (error: unknown) {
            return Promise.resolve(
                Result.fail<IStageTransition, StageError>(
                    this.createStageError(
                        input.state.runId,
                        input.state.definitionVersion,
                        "Failed to validate review config schema",
                        false,
                        error instanceof Error ? error : undefined,
                    ),
                ),
            )
        }
    }

    /**
     * Validates review config payload and returns normalized DTO.
     *
     * @param payload Config payload from state.
     * @returns Normalized config or validation error.
     */
    private validateConfigPayload(payload: Readonly<Record<string, unknown>>): Result<IReviewConfigDTO, ValidationError> {
        const fields: IValidationErrorField[] = []

        const severityThreshold = this.validateSeverityThreshold(payload["severityThreshold"], fields)
        const ignorePaths = this.validateStringArray(payload["ignorePaths"], "ignorePaths", fields)
        const maxSuggestionsPerFile = this.validatePositiveInteger(
            payload["maxSuggestionsPerFile"],
            "maxSuggestionsPerFile",
            fields,
        )
        const maxSuggestionsPerCCR = this.validatePositiveInteger(
            payload["maxSuggestionsPerCCR"],
            "maxSuggestionsPerCCR",
            fields,
        )
        const cadence = this.validateRequiredString(payload["cadence"], "cadence", fields)
        const customRuleIds = this.validateStringArray(payload["customRuleIds"], "customRuleIds", fields)
        const promptOverrides = this.validatePromptOverrides(payload["promptOverrides"], fields)

        if (
            severityThreshold === undefined ||
            ignorePaths === undefined ||
            maxSuggestionsPerFile === undefined ||
            maxSuggestionsPerCCR === undefined ||
            cadence === undefined ||
            customRuleIds === undefined ||
            fields.length > 0
        ) {
            return Result.fail<IReviewConfigDTO, ValidationError>(
                new ValidationError("Review config validation failed", fields),
            )
        }

        return Result.ok<IReviewConfigDTO, ValidationError>({
            severityThreshold,
            ignorePaths,
            maxSuggestionsPerFile,
            maxSuggestionsPerCCR,
            cadence,
            customRuleIds,
            promptOverrides,
        })
    }

    /**
     * Validates severity threshold and normalizes to uppercase enum.
     *
     * @param value Raw value.
     * @param fields Error accumulator.
     * @returns Normalized severity or undefined.
     */
    private validateSeverityThreshold(
        value: unknown,
        fields: IValidationErrorField[],
    ): IReviewConfigDTO["severityThreshold"] | undefined {
        if (typeof value !== "string") {
            fields.push({
                field: "severityThreshold",
                message: "must be a string",
            })
            return undefined
        }

        const normalized = value.trim().toUpperCase()
        if (!ALLOWED_SEVERITY_THRESHOLDS.includes(normalized as (typeof ALLOWED_SEVERITY_THRESHOLDS)[number])) {
            fields.push({
                field: "severityThreshold",
                message: "must be one of LOW | MEDIUM | HIGH | CRITICAL",
            })
            return undefined
        }

        return normalized
    }

    /**
     * Validates required non-empty string field.
     *
     * @param value Raw value.
     * @param fieldName Field name.
     * @param fields Error accumulator.
     * @returns Normalized string or undefined.
     */
    private validateRequiredString(
        value: unknown,
        fieldName: string,
        fields: IValidationErrorField[],
    ): string | undefined {
        if (typeof value !== "string" || value.trim().length === 0) {
            fields.push({
                field: fieldName,
                message: "must be a non-empty string",
            })
            return undefined
        }

        return value.trim()
    }

    /**
     * Validates positive integer field.
     *
     * @param value Raw value.
     * @param fieldName Field name.
     * @param fields Error accumulator.
     * @returns Positive integer or undefined.
     */
    private validatePositiveInteger(
        value: unknown,
        fieldName: string,
        fields: IValidationErrorField[],
    ): number | undefined {
        if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
            fields.push({
                field: fieldName,
                message: "must be an integer greater than or equal to 1",
            })
            return undefined
        }

        return value
    }

    /**
     * Validates string array field and trims each item.
     *
     * @param value Raw value.
     * @param fieldName Field name.
     * @param fields Error accumulator.
     * @returns Trimmed string array or undefined.
     */
    private validateStringArray(
        value: unknown,
        fieldName: string,
        fields: IValidationErrorField[],
    ): readonly string[] | undefined {
        if (!Array.isArray(value)) {
            fields.push({
                field: fieldName,
                message: "must be an array of non-empty strings",
            })
            return undefined
        }

        const normalizedValues: string[] = []
        for (const item of value) {
            if (typeof item !== "string" || item.trim().length === 0) {
                fields.push({
                    field: fieldName,
                    message: "must contain only non-empty strings",
                })
                return undefined
            }
            normalizedValues.push(item.trim())
        }

        return normalizedValues
    }

    /**
     * Validates optional prompt overrides shape.
     *
     * @param value Raw prompt overrides value.
     * @param fields Error accumulator.
     * @returns Normalized prompt overrides or undefined.
     */
    private validatePromptOverrides(
        value: unknown,
        fields: IValidationErrorField[],
    ): IReviewPromptOverridesDTO | undefined {
        if (value === undefined) {
            return undefined
        }

        if (value === null || typeof value !== "object" || Array.isArray(value)) {
            fields.push({
                field: "promptOverrides",
                message: "must be an object with optional string fields",
            })
            return undefined
        }

        const record = value as Readonly<Record<string, unknown>>
        const systemPrompt = this.validateOptionalString(record["systemPrompt"], "promptOverrides.systemPrompt", fields)
        const reviewerPrompt = this.validateOptionalString(
            record["reviewerPrompt"],
            "promptOverrides.reviewerPrompt",
            fields,
        )
        const summaryPrompt = this.validateOptionalString(
            record["summaryPrompt"],
            "promptOverrides.summaryPrompt",
            fields,
        )

        return {
            ...(systemPrompt === undefined ? {} : {systemPrompt}),
            ...(reviewerPrompt === undefined ? {} : {reviewerPrompt}),
            ...(summaryPrompt === undefined ? {} : {summaryPrompt}),
        }
    }

    /**
     * Validates optional string value.
     *
     * @param value Raw value.
     * @param fieldName Field name.
     * @param fields Error accumulator.
     * @returns Trimmed string or undefined.
     */
    private validateOptionalString(
        value: unknown,
        fieldName: string,
        fields: IValidationErrorField[],
    ): string | undefined {
        if (value === undefined) {
            return undefined
        }

        if (typeof value !== "string" || value.trim().length === 0) {
            fields.push({
                field: fieldName,
                message: "must be a non-empty string when provided",
            })
            return undefined
        }

        return value.trim()
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
