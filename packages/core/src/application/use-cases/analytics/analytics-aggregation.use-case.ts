import type {IUseCase} from "../../ports/inbound/use-case.port"
import type {IAnalyticsService} from "../../ports/outbound/analytics/analytics-service.port"
import {
    ANALYTICS_GROUP_BY,
    type IAnalyticsAggregationInput,
    type IAnalyticsAggregatedMetrics,
    type INormalizedAnalyticsAggregationQuery,
    type IAnalyticsGroupBy,
} from "../../dto/analytics/analytics-aggregation.dto"
import {ValidationError, type IValidationErrorField} from "../../../domain/errors/validation.error"
import type {DomainError} from "../../../domain/errors/domain.error"
import {Result} from "../../../shared/result"

/**
 * Dependencies for analytics aggregation use case.
 */
export interface IAnalyticsAggregationUseCaseDependencies {
    /**
     * Analytics domain service.
     */
    readonly analyticsService: IAnalyticsService
}

/**
 * Aggregates DORA, CCR, token usage and cost metrics for requested dimension.
 */
export class AnalyticsAggregationUseCase
    implements IUseCase<IAnalyticsAggregationInput, IAnalyticsAggregatedMetrics, DomainError>
{
    private readonly analyticsService: IAnalyticsService

    /**
     * Creates use case instance.
     *
     * @param dependencies Required dependencies.
     */
    public constructor(dependencies: IAnalyticsAggregationUseCaseDependencies) {
        this.analyticsService = dependencies.analyticsService
    }

    /**
     * Aggregates metrics for provided filters.
     *
     * @param input Request payload.
     * @returns Aggregated result or validation error.
     */
    public async execute(
        input: IAnalyticsAggregationInput,
    ): Promise<Result<IAnalyticsAggregatedMetrics, DomainError>> {
        const normalizedInputResult = this.validateAndNormalizeInput(input)
        if (normalizedInputResult.isFail) {
            return Result.fail<IAnalyticsAggregatedMetrics, DomainError>(
                normalizedInputResult.error,
            )
        }

        try {
            const metrics = await this.analyticsService.aggregate(
                normalizedInputResult.value,
            )
            return Result.ok<IAnalyticsAggregatedMetrics, DomainError>(metrics)
        } catch (error: unknown) {
            return Result.fail<IAnalyticsAggregatedMetrics, DomainError>(
                this.mapDependencyFailure(error),
            )
        }
    }

    /**
     * Normalizes and validates input payload.
     *
     * @param input Raw input payload.
     * @returns Normalized query or validation error.
     */
    private validateAndNormalizeInput(
        input: IAnalyticsAggregationInput,
    ): Result<INormalizedAnalyticsAggregationQuery, ValidationError> {
        const fields: IValidationErrorField[] = []
        const timeRange = this.normalizeTimeRange(input.timeRange, fields)

        const groupByResult = this.normalizeGroupBy(input.groupBy, fields)
        const groupBy = groupByResult.groupBy

        const organizationId = this.normalizeOptionalFilter(
            input.organizationId,
            "organizationId",
            "must be a non-empty string when provided",
            fields,
        )
        const repositoryId = this.normalizeOptionalFilter(
            input.repositoryId,
            "repositoryId",
            "must be a non-empty string when provided",
            fields,
        )
        const teamId = this.normalizeOptionalFilter(
            input.teamId,
            "teamId",
            groupByResult.applyRequiredRules === true
                ? "must be a non-empty string when groupBy is team"
                : "must be a non-empty string when provided",
            fields,
        )
        const developerId = this.normalizeOptionalFilter(
            input.developerId,
            "developerId",
            groupByResult.applyRequiredRules === true
                ? "must be a non-empty string when groupBy is developer"
                : "must be a non-empty string when provided",
            fields,
        )
        const model = this.normalizeOptionalFilter(
            input.model,
            "model",
            groupByResult.applyRequiredRules === true
                ? "must be a non-empty string when groupBy is model"
                : "must be a non-empty string when provided",
            fields,
        )

        this.validateTeamGrouping(groupBy, groupByResult, teamId, fields)
        this.validateDeveloperGrouping(groupBy, groupByResult, developerId, fields)
        this.validateModelGrouping(groupBy, groupByResult, model, fields)

        if (timeRange === undefined || fields.length > 0) {
            return Result.fail<INormalizedAnalyticsAggregationQuery, ValidationError>(
                new ValidationError("Analytics aggregation validation failed", fields),
            )
        }

        return Result.ok<INormalizedAnalyticsAggregationQuery, ValidationError>({
            timeRange,
            groupBy,
            organizationId,
            teamId,
            developerId,
            model,
            repositoryId,
        })
    }

    private normalizeTimeRange(
        timeRange: IAnalyticsAggregationInput["timeRange"] | undefined,
        fields: IValidationErrorField[],
    ): {readonly from: Date; readonly to: Date} | undefined {
        if (timeRange === undefined || timeRange === null) {
            fields.push({
                field: "timeRange",
                message: "must be defined",
            })
            return undefined
        }

        if (typeof timeRange !== "object") {
            fields.push({
                field: "timeRange",
                message: "must be an object",
            })
            return undefined
        }

        const from = this.normalizeDate(timeRange.from, "timeRange.from", fields)
        const to = this.normalizeDate(timeRange.to, "timeRange.to", fields)

        if (from === undefined || to === undefined) {
            return undefined
        }

        if (from > to) {
            fields.push({
                field: "timeRange",
                message: "timeRange.from must be before or equal to timeRange.to",
            })
            return undefined
        }

        return {
            from,
            to,
        }
    }

    private normalizeDate(
        value: unknown,
        field: string,
        fields: IValidationErrorField[],
    ): Date | undefined {
        if (typeof value !== "string") {
            fields.push({
                field,
                message: "must be a non-empty ISO date string",
            })
            return undefined
        }

        const normalized = value.trim()
        if (normalized.length === 0) {
            fields.push({
                field,
                message: "must be a non-empty ISO date string",
            })
            return undefined
        }

        const date = new Date(normalized)
        if (Number.isNaN(date.getTime())) {
            fields.push({
                field,
                message: "must be a valid ISO date string",
            })
            return undefined
        }

        return date
    }

    private normalizeGroupBy(
        groupBy: unknown,
        fields: IValidationErrorField[],
    ): {
        readonly groupBy: IAnalyticsGroupBy
        readonly applyRequiredRules: boolean
    } {
        if (groupBy === undefined || groupBy === null) {
            return {
                groupBy: ANALYTICS_GROUP_BY.ORG,
                applyRequiredRules: true,
            }
        }

        if (typeof groupBy !== "string") {
            fields.push({
                field: "groupBy",
                message: "must be one of org, team, developer, model",
            })
            return {
                groupBy: ANALYTICS_GROUP_BY.ORG,
                applyRequiredRules: false,
            }
        }

        const normalized = groupBy.trim().toLowerCase()
        if (this.isAnalyticsGroupBy(normalized) === false) {
            fields.push({
                field: "groupBy",
                message: "must be one of org, team, developer, model",
            })
            return {
                groupBy: ANALYTICS_GROUP_BY.ORG,
                applyRequiredRules: false,
            }
        }

        return {
            groupBy: normalized,
            applyRequiredRules: true,
        }
    }

    private validateTeamGrouping(
        groupBy: IAnalyticsGroupBy,
        groupByResult: {readonly applyRequiredRules: boolean},
        teamId: string | undefined,
        fields: IValidationErrorField[],
    ): void {
        if (groupBy !== ANALYTICS_GROUP_BY.TEAM || groupByResult.applyRequiredRules === false) {
            return
        }

        if (teamId === undefined) {
            if (this.hasValidationError(fields, "teamId")) {
                return
            }
            fields.push({
                field: "teamId",
                message: "must be a non-empty string when groupBy is team",
            })
        }
    }

    private validateDeveloperGrouping(
        groupBy: IAnalyticsGroupBy,
        groupByResult: {readonly applyRequiredRules: boolean},
        developerId: string | undefined,
        fields: IValidationErrorField[],
    ): void {
        if (
            groupBy !== ANALYTICS_GROUP_BY.DEVELOPER
            || groupByResult.applyRequiredRules === false
        ) {
            return
        }

        if (developerId === undefined) {
            if (this.hasValidationError(fields, "developerId")) {
                return
            }
            fields.push({
                field: "developerId",
                message: "must be a non-empty string when groupBy is developer",
            })
        }
    }

    private validateModelGrouping(
        groupBy: IAnalyticsGroupBy,
        groupByResult: {readonly applyRequiredRules: boolean},
        model: string | undefined,
        fields: IValidationErrorField[],
    ): void {
        if (groupBy !== ANALYTICS_GROUP_BY.MODEL || groupByResult.applyRequiredRules === false) {
            return
        }

        if (model === undefined) {
            if (this.hasValidationError(fields, "model")) {
                return
            }
            fields.push({
                field: "model",
                message: "must be a non-empty string when groupBy is model",
            })
        }
    }

    private hasValidationError(fields: IValidationErrorField[], field: string): boolean {
        return fields.some((item) => item.field === field)
    }

    /**
     * Type guard for allowed group values.
     *
     * @param value Candidate value.
     * @returns True if value is valid groupBy.
     */
    private isAnalyticsGroupBy(value: string): value is IAnalyticsGroupBy {
        return Object.values(ANALYTICS_GROUP_BY).includes(value as IAnalyticsGroupBy)
    }

    private normalizeOptionalFilter(
        value: unknown,
        field: string,
        requiredMessage: string,
        fields: IValidationErrorField[],
    ): string | undefined {
        if (value === undefined) {
            return undefined
        }

        if (typeof value !== "string") {
            fields.push({
                field,
                message: requiredMessage,
            })
            return undefined
        }

        const normalized = value.trim()
        if (normalized.length === 0) {
            fields.push({
                field,
                message: requiredMessage,
            })
            return undefined
        }

        return normalized
    }

    /**
     * Maps dependency failures to validation error.
     *
     * @param error Raw error.
     * @returns Domain-facing validation error.
     */
    private mapDependencyFailure(error: unknown): ValidationError {
        if (error instanceof Error) {
            return new ValidationError("Analytics aggregation failed", [{
                field: "analyticsService",
                message: error.message,
            }], error)
        }

        return new ValidationError("Analytics aggregation failed", [{
            field: "analyticsService",
            message: "unknown error occurred",
        }])
    }
}
