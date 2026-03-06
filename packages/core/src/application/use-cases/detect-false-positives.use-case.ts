import type {IUseCase} from "../ports/inbound/use-case.port"
import type {IFeedbackRepository} from "../ports/outbound/feedback-repository.port"
import type {ISystemSettingsProvider} from "../ports/outbound/common/system-settings-provider.port"
import {RuleEffectivenessService} from "../../domain/services/rule-effectiveness.service"
import {ValidationError, type IValidationErrorField} from "../../domain/errors/validation.error"
import {Result} from "../../shared/result"
import type {IFalsePositiveDetectionDefaults} from "../dto/config/system-defaults.dto"

/**
 * Heuristic output recommendation.
 */
export type IFalsePositiveRecommendation = "DEACTIVATE_RULE" | "MONITOR"

interface IDetectFalsePositivesConfig {
    readonly threshold: number
    readonly deactivateThreshold: number
    readonly minSampleSize: number
    readonly minDeactivateSampleSize: number
}

const FALSE_POSITIVE_DEFAULTS: IFalsePositiveDetectionDefaults = {
    threshold: 0.5,
    deactivateThreshold: 0.7,
    minSampleSize: 5,
    minDeactivateSampleSize: 10,
}

const FALSE_POSITIVE_DEFAULTS_SETTINGS_KEY = "detection.false_positive_thresholds"

/**
 * Input for false-positive detection.
 */
export interface IDetectFalsePositivesInput {
    /**
     * Optional lower bound (exclusive) for false-positive rate.
     */
    readonly threshold?: unknown

    /**
     * Optional boundary at which recommendation changes to deactivation.
     */
    readonly deactivateThreshold?: unknown

    /**
     * Optional minimum sample size to include rule in output.
     */
    readonly minSampleSize?: unknown

    /**
     * Optional minimum sample size to recommend deactivation.
     */
    readonly minDeactivateSampleSize?: unknown

    /**
     * Optional rule filter.
     */
    readonly ruleIds?: readonly unknown[]
}

/**
 * One recommendation row.
 */
export interface IDetectFalsePositivesOutput {
    /**
     * Rule identifier.
     */
    readonly ruleId: string

    /**
     * False-positive ratio in [0,1].
     */
    readonly rate: number

    /**
     * Recommended action.
     */
    readonly recommendation: IFalsePositiveRecommendation
}

/**
 * Use case that detects rules with suspicious false-positive rates.
 */
export class DetectFalsePositivesUseCase
    implements IUseCase<IDetectFalsePositivesInput, readonly IDetectFalsePositivesOutput[], ValidationError>
{
    private readonly feedbackRepository: IFeedbackRepository
    private readonly defaults: IFalsePositiveDetectionDefaults
    private readonly systemSettingsProvider?: ISystemSettingsProvider

    /**
     * Creates use case.
     *
     * @param dependencies Use case dependencies.
     */
    public constructor(dependencies: {
        readonly feedbackRepository: IFeedbackRepository
        readonly defaults?: IFalsePositiveDetectionDefaults
        readonly systemSettingsProvider?: ISystemSettingsProvider
    }) {
        this.feedbackRepository = dependencies.feedbackRepository
        this.defaults = dependencies.defaults ?? FALSE_POSITIVE_DEFAULTS
        this.systemSettingsProvider = dependencies.systemSettingsProvider
    }

    /**
     * Detects rules that exceed false-positive thresholds.
     *
     * @param input Detection settings and optional rule filter.
     * @returns Sorted recommendations by suspiciousness.
     */
    public async execute(
        input: IDetectFalsePositivesInput,
    ): Promise<Result<readonly IDetectFalsePositivesOutput[], ValidationError>> {
        if (this.isInvalidInput(input) === true) {
            return Result.fail<readonly IDetectFalsePositivesOutput[], ValidationError>(
                new ValidationError("Detect false positives validation failed", [
                    {
                        field: "input",
                        message: "must be an object",
                    },
                ]),
            )
        }

        const defaults = await this.resolveDefaults()
        const normalized = this.normalizeInput(input, defaults)
        if (normalized.result.isFail) {
            return Result.fail<readonly IDetectFalsePositivesOutput[], ValidationError>(
                normalized.result.error,
            )
        }
        if (normalized.criteria === undefined) {
            return Result.fail<readonly IDetectFalsePositivesOutput[], ValidationError>(
                new ValidationError("Detect false positives validation failed", [
                    {
                        field: "internal",
                        message: "Validation result is incomplete",
                    },
                ]),
            )
        }
        const {criteria} = normalized

        const feedback = await this.feedbackRepository.findByFilter({
            ...(criteria.ruleIds === undefined ? {} : {ruleIds: criteria.ruleIds}),
        })

        const service = new RuleEffectivenessService()
        const uniqueRuleIds = new Set<string>()

        for (const item of feedback) {
            const ruleId = item.ruleId?.trim()
            if (ruleId === undefined || ruleId.length === 0) {
                continue
            }

            uniqueRuleIds.add(ruleId)
            service.track(ruleId, [{
                type: item.type,
                createdAt: item.createdAt,
            }])
        }

        const output = [...uniqueRuleIds]
            .map((ruleId: string): IDetectFalsePositivesOutput | null => {
                const metrics = service.getEffectiveness(ruleId)

                if (
                    metrics.falsePositiveRate <= criteria.threshold ||
                    metrics.totalSamples < criteria.minSampleSize
                ) {
                    return null
                }

                return {
                    ruleId,
                    rate: metrics.falsePositiveRate,
                    recommendation: this.resolveRecommendation(metrics, criteria),
                }
            })
            .filter((entry): entry is IDetectFalsePositivesOutput => entry !== null)
            .sort((first, second) => second.rate - first.rate)

        return Result.ok<readonly IDetectFalsePositivesOutput[], ValidationError>(output)
    }

    /**
     * Validates plain-object input shape.
     *
     * @param input Input payload.
     * @returns Whether payload is not an object.
     */
    private isInvalidInput(input: IDetectFalsePositivesInput): boolean {
        return (
            typeof input !== "object" ||
            input === null ||
            Array.isArray(input)
        )
    }

    /**
     * Validates and normalizes input into typed config.
     *
     * @param input Raw input.
     * @returns Validation result + normalized config.
     */
    private normalizeInput(
        input: IDetectFalsePositivesInput,
        defaults: IFalsePositiveDetectionDefaults,
    ): {readonly result: Result<IDetectFalsePositivesConfig & {ruleIds?: readonly string[]}, ValidationError>; readonly criteria?: IDetectFalsePositivesConfig & {
        readonly ruleIds?: readonly string[]
    }} {
        const fields: IValidationErrorField[] = []
        const threshold = this.normalizeRate(input.threshold, defaults.threshold)
        const deactivateThreshold = this.normalizeRate(
            input.deactivateThreshold,
            defaults.deactivateThreshold,
        )
        const minSampleSize = this.normalizeSampleSize(
            input.minSampleSize,
            defaults.minSampleSize,
        )
        const minDeactivateSampleSize = this.normalizeSampleSize(
            input.minDeactivateSampleSize,
            defaults.minDeactivateSampleSize,
        )
        const ruleIds = this.normalizeRuleIds(input.ruleIds, fields)

        if (Number.isNaN(threshold)) {
            fields.push({
                field: "threshold",
                message: "threshold must be a number between 0 and 1",
            })
        }

        if (Number.isNaN(deactivateThreshold)) {
            fields.push({
                field: "deactivateThreshold",
                message: "deactivateThreshold must be a number between 0 and 1",
            })
        }

        if (Number.isNaN(minSampleSize)) {
            fields.push({
                field: "minSampleSize",
                message: "minSampleSize must be a positive integer",
            })
        }

        if (Number.isNaN(minDeactivateSampleSize)) {
            fields.push({
                field: "minDeactivateSampleSize",
                message: "minDeactivateSampleSize must be a positive integer",
            })
        }

        if (threshold > deactivateThreshold) {
            fields.push({
                field: "deactivateThreshold",
                message: "deactivateThreshold must be greater than or equal to threshold",
            })
        }

        if (fields.length > 0) {
            return {
                result: Result.fail<IDetectFalsePositivesConfig & {ruleIds?: readonly string[]}, ValidationError>(
                    new ValidationError("Detect false positives validation failed", fields),
                ),
            }
        }

        const criteria: IDetectFalsePositivesConfig & {ruleIds?: readonly string[]} = {
            threshold,
            deactivateThreshold,
            minSampleSize,
            minDeactivateSampleSize,
            ...(ruleIds === undefined ? {} : {ruleIds}),
        }

        return {
            result: Result.ok<IDetectFalsePositivesConfig & {ruleIds?: readonly string[]}, ValidationError>(criteria),
            criteria,
        }
    }

    /**
     * Resolves defaults from system settings with fallback values.
     *
     * @returns Detection defaults.
     */
    private async resolveDefaults(): Promise<IFalsePositiveDetectionDefaults> {
        if (this.systemSettingsProvider === undefined) {
            return this.defaults
        }

        try {
            const payload = await this.systemSettingsProvider.get<unknown>(
                FALSE_POSITIVE_DEFAULTS_SETTINGS_KEY,
            )
            const record = this.readDefaultsRecord(payload)
            if (record === undefined) {
                return this.defaults
            }

            const threshold = this.readRate(record["threshold"], this.defaults.threshold)
            const deactivateThreshold = this.readRate(
                record["deactivateThreshold"],
                this.defaults.deactivateThreshold,
            )
            const minSampleSize = this.readSampleSize(record["minSampleSize"], this.defaults.minSampleSize)
            const minDeactivateSampleSize = this.readSampleSize(
                record["minDeactivateSampleSize"],
                this.defaults.minDeactivateSampleSize,
            )

            const normalizedDeactivateThreshold = deactivateThreshold < threshold
                ? Math.max(threshold, this.defaults.deactivateThreshold)
                : deactivateThreshold

            return {
                threshold,
                deactivateThreshold: normalizedDeactivateThreshold,
                minSampleSize,
                minDeactivateSampleSize,
            }
        } catch {
            return this.defaults
        }
    }

    /**
     * Reads plain record payload.
     *
     * @param payload Raw payload.
     * @returns Record or undefined.
     */
    private readDefaultsRecord(payload: unknown): Record<string, unknown> | undefined {
        if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
            return undefined
        }

        return payload as Record<string, unknown>
    }

    /**
     * Reads rate value with fallback.
     *
     * @param value Raw value.
     * @param fallback Fallback value.
     * @returns Valid rate.
     */
    private readRate(value: unknown, fallback: number): number {
        if (typeof value !== "number" || Number.isNaN(value) || value < 0 || value > 1) {
            return fallback
        }

        return value
    }

    /**
     * Reads sample size with fallback.
     *
     * @param value Raw value.
     * @param fallback Fallback value.
     * @returns Valid sample size.
     */
    private readSampleSize(value: unknown, fallback: number): number {
        if (typeof value !== "number" || Number.isNaN(value) || value < 1 || !Number.isInteger(value)) {
            return fallback
        }

        return value
    }

    /**
     * Resolves recommendation by weighted false-positive metrics.
     *
     * @param metrics Rule effectiveness metrics.
     * @param config Config.
     * @returns Recommendation.
     */
    private resolveRecommendation(
        metrics: {
            readonly falsePositiveRate: number
            readonly totalSamples: number
        },
        config: IDetectFalsePositivesConfig,
    ): IFalsePositiveRecommendation {
        const canDeactivate = metrics.totalSamples >= config.minDeactivateSampleSize
            && metrics.falsePositiveRate >= config.deactivateThreshold

        return canDeactivate ? "DEACTIVATE_RULE" : "MONITOR"
    }

    /**
     * Normalizes required and optional rate values.
     *
     * @param raw Raw rate value.
     * @param field Field name for diagnostics.
     * @param defaultValue Fallback value.
     * @returns Number in [0,1].
     */
    private normalizeRate(raw: unknown, defaultValue: number): number {
        if (raw === undefined) {
            return defaultValue
        }

        if (typeof raw !== "number" || Number.isNaN(raw) || raw < 0 || raw > 1) {
            return Number.NaN
        }

        return raw
    }

    /**
     * Normalizes required and optional integer sample size values.
     *
     * @param raw Raw sample size.
     * @param field Field name for diagnostics.
     * @param defaultValue Fallback value.
     * @returns Positive integer.
     */
    private normalizeSampleSize(raw: unknown, defaultValue: number): number {
        if (raw === undefined) {
            return defaultValue
        }

        if (
            typeof raw !== "number" ||
            Number.isNaN(raw) ||
            raw < 1 ||
            Number.isInteger(raw) === false
        ) {
            return Number.NaN
        }

        return raw
    }

    /**
     * Normalizes rule filter.
     *
     * @param ruleIds Raw rule ids.
     * @param fields Validation result fields.
     * @returns Trimmed unique rule ids or undefined.
     */
    private normalizeRuleIds(
        ruleIds: readonly unknown[] | undefined,
        fields: IValidationErrorField[],
    ): readonly string[] | undefined {
        if (ruleIds === undefined) {
            return undefined
        }

        if (Array.isArray(ruleIds) === false) {
            fields.push({
                field: "ruleIds",
                message: "ruleIds must be an array of strings",
            })
            return undefined
        }

        const normalized = new Set<string>()
        for (const value of ruleIds) {
            if (typeof value !== "string" || value.trim().length === 0) {
                fields.push({
                    field: "ruleIds",
                    message: "ruleIds must be an array of non-empty strings",
                })
                return undefined
            }

            normalized.add(value.trim())
        }

        return [...normalized]
    }
}
