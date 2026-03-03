/**
 * Grouping dimensions for metrics aggregation.
 */
export const ANALYTICS_GROUP_BY = {
    ORG: "org",
    TEAM: "team",
    DEVELOPER: "developer",
    MODEL: "model",
} as const

/**
 * Supported grouping dimensions for aggregated analytics output.
 */
export type IAnalyticsGroupBy =
    (typeof ANALYTICS_GROUP_BY)[keyof typeof ANALYTICS_GROUP_BY]

/**
 * Raw time range used by analytics inputs.
 */
export interface IAnalyticsTimeRange {
    /**
     * ISO date string for range start.
     */
    readonly from: string

    /**
     * ISO date string for range end.
     */
    readonly to: string
}

/**
 * Request payload for metrics aggregation use case.
 */
export interface IAnalyticsAggregationInput {
    /**
     * Aggregation time range.
     */
    readonly timeRange: IAnalyticsTimeRange

    /**
     * Grouping dimension.
     * Defaults to "org" if omitted.
     */
    readonly groupBy?: IAnalyticsGroupBy

    /**
     * Optional org filter.
     */
    readonly organizationId?: string

    /**
     * Optional team filter.
     */
    readonly teamId?: string

    /**
     * Optional developer filter.
     */
    readonly developerId?: string

    /**
     * Optional model filter.
     */
    readonly model?: string

    /**
     * Optional repository filter for CCR-oriented requests.
     */
    readonly repositoryId?: string
}

/**
 * Normalized query passed to analytics service.
 */
export interface INormalizedAnalyticsAggregationQuery {
    /**
     * Aggregation boundaries.
     */
    readonly timeRange: {
        /**
         * Range start.
         */
        readonly from: Date

        /**
         * Range end.
         */
        readonly to: Date
    }

    /**
     * Grouping dimension used for result buckets.
     */
    readonly groupBy: IAnalyticsGroupBy

    /**
     * Optional org filter.
     */
    readonly organizationId?: string

    /**
     * Optional team filter.
     */
    readonly teamId?: string

    /**
     * Optional developer filter.
     */
    readonly developerId?: string

    /**
     * Optional model filter.
     */
    readonly model?: string

    /**
     * Optional repository filter.
     */
    readonly repositoryId?: string
}

/**
 * DORA metrics DTO in analytics layer.
 */
export interface IAnalyticsDoraMetrics {
    readonly deployFrequency: number
    readonly changeFailRate: number
    readonly leadTime: number
    readonly meanTimeToRestore: number
    readonly timeRange: IAnalyticsTimeRange
}

/**
 * CCR metrics DTO in analytics layer.
 */
export interface IAnalyticsCcrMetrics {
    readonly cycleTime: number
    readonly reviewTime: number
    readonly size: number
    readonly commentsCount: number
    readonly iterationsCount: number
    readonly firstResponseTime: number
    readonly repositoryId: string
}

/**
 * Aggregated token usage DTO.
 */
export interface IAnalyticsTokenUsage {
    readonly model: string
    readonly input: number
    readonly output: number
    readonly outputReasoning: number
    readonly total: number
    readonly recordCount: number
}

/**
 * Token usage breakdown by model.
 */
export interface IAnalyticsTokenUsageByModel {
    readonly model: string
    readonly input: number
    readonly output: number
    readonly outputReasoning: number
    readonly total: number
}

/**
 * Cost estimate DTO in analytics layer.
 */
export interface IAnalyticsCostEstimate {
    readonly totalCost: number
    readonly currency: string
    readonly byModel: readonly {
        /**
         * Model identifier.
         */
        readonly model: string

        /**
         * Total tokens consumed in model.
         */
        readonly tokens: number

        /**
         * Calculated model cost.
         */
        readonly cost: number
    }[]
}

/**
 * Aggregated metric bucket by group key.
 */
export interface IAnalyticsAggregationBucket {
    /**
     * Group identifier (org/team/developer/model key).
     */
    readonly groupId: string

    /**
     * Human-readable group label.
     */
    readonly groupLabel?: string

    /**
     * Optional DORA metrics.
     */
    readonly dora?: IAnalyticsDoraMetrics

    /**
     * Optional CCR metrics.
     */
    readonly ccr?: IAnalyticsCcrMetrics

    /**
     * Optional token usage summary.
     */
    readonly tokenUsage?: IAnalyticsTokenUsage

    /**
     * Optional cost estimate.
     */
    readonly cost?: IAnalyticsCostEstimate
}

/**
 * Full aggregation output for analytics use case.
 */
export interface IAnalyticsAggregatedMetrics {
    /**
     * Used grouping dimension.
     */
    readonly groupBy: IAnalyticsGroupBy

    /**
     * Normalized range.
     */
    readonly timeRange: IAnalyticsTimeRange

    /**
     * One bucket per group key.
     */
    readonly buckets: readonly IAnalyticsAggregationBucket[]
}
