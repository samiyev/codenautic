import type {IUseCase} from "../ports/inbound/use-case.port"
import {
    type IReviewConfigDTO,
    type IReviewPromptOverridesDTO,
    type ValidatedConfig,
} from "../dto/review/review-config.dto"
import {Result} from "../../shared/result"
import {
    type IValidationErrorField,
    ValidationError,
} from "../../domain/errors/validation.error"

/**
 * Input payload for configuration validation use case.
 */
export type IConfigurationValidatorInput = unknown

/** Allowed severity thresholds. */
const ALLOWED_SEVERITY_THRESHOLDS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const

/** Known review config keys for deterministic validation. */
const REVIEW_CONFIG_KEYS = [
    "severityThreshold",
    "ignorePaths",
    "maxSuggestionsPerFile",
    "maxSuggestionsPerCCR",
    "cadence",
    "customRuleIds",
    "promptOverrides",
] as const

/**
 * Pure validator for review configuration payload.
 *
 * Keep deterministic and explicit rule checks without external schema dependencies.
 */
export class ConfigurationValidatorUseCase
    implements IUseCase<IConfigurationValidatorInput, ValidatedConfig, ValidationError> {
    /**
     * Validates and normalizes review config payload.
     *
     * @param input Arbitrary input payload.
     * @returns Validated and normalized payload.
     */
    public execute(input: IConfigurationValidatorInput): Promise<Result<ValidatedConfig, ValidationError>> {
        const fields: IValidationErrorField[] = []

        const payload = this.readPayloadObject(input, fields)
        if (payload === undefined) {
            return Promise.resolve(
                Result.fail<ValidatedConfig, ValidationError>(
                    new ValidationError("Review config validation failed", fields),
                ),
            )
        }

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
            return Promise.resolve(
                Result.fail<ValidatedConfig, ValidationError>(
                    new ValidationError("Review config validation failed", fields),
                ),
            )
        }

        const validatedConfig: ValidatedConfig = {
            ...this.pickUnknownFields(payload),
            severityThreshold,
            ignorePaths,
            maxSuggestionsPerFile,
            maxSuggestionsPerCCR,
            cadence,
            customRuleIds,
            ...(promptOverrides === undefined ? {} : {promptOverrides}),
        }

        return Promise.resolve(Result.ok<ValidatedConfig, ValidationError>(validatedConfig))
    }

    /**
     * Reads review config payload only if it is a non-null object.
     *
     * @param input Raw payload.
     * @param fields Validation accumulator.
     * @returns Payload object or undefined.
     */
    private readPayloadObject(
        input: unknown,
        fields: IValidationErrorField[],
    ): Readonly<Record<string, unknown>> | undefined {
        if (typeof input !== "object" || input === null || Array.isArray(input)) {
            fields.push({
                field: "config",
                message: "must be a non-null object",
            })
            return undefined
        }

        return input as Readonly<Record<string, unknown>>
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
     * Keeps adapter-specific values that are not part of core schema.
     *
     * @param payload Raw payload.
     * @returns Copy of unknown top-level fields.
     */
    private pickUnknownFields(payload: Readonly<Record<string, unknown>>): Record<string, unknown> {
        const base: Record<string, unknown> = {}
        const knownKeys = new Set<string>(REVIEW_CONFIG_KEYS)

        for (const [key, value] of Object.entries(payload)) {
            if (knownKeys.has(key)) {
                continue
            }
            base[key] = this.cloneValue(value)
        }

        return base
    }

    /**
     * Clones object values recursively.
     *
     * @param value Source value.
     * @returns Cloned value.
     */
    private cloneValue(value: unknown): unknown {
        if (Array.isArray(value)) {
            return value.map((item) => this.cloneValue(item))
        }

        if (typeof value === "object" && value !== null) {
            const clone: Record<string, unknown> = {}
            for (const [entryKey, entryValue] of Object.entries(value)) {
                clone[entryKey] = this.cloneValue(entryValue)
            }
            return clone
        }

        return value
    }
}
