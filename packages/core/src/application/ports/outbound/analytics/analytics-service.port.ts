import type {
    IAnalyticsAggregatedMetrics,
    IAnalyticsCcrMetrics,
    IAnalyticsDoraMetrics,
    INormalizedAnalyticsAggregationQuery,
} from "../../../dto/analytics/analytics-aggregation.dto"
import type {TokenUsageRecord} from "../../../../domain/value-objects/token-usage-record.value-object"

/**
 * Outbound contract for analytics aggregation and tracking.
 */
export interface IAnalyticsService {
    /**
     * Tracks one token usage record.
     *
     * @param record Token usage record.
     */
    track(record: TokenUsageRecord): Promise<void>

    /**
     * Aggregates metrics for given range and grouping.
     *
     * @param query Aggregation query.
     * @returns Aggregated result.
     */
    aggregate(query: INormalizedAnalyticsAggregationQuery): Promise<IAnalyticsAggregatedMetrics>

    /**
     * Returns DORA metrics for organization in time range.
     *
     * @param organizationId Organization identifier.
     * @param from Start date.
     * @param to End date.
     * @returns DORA metrics or null.
     */
    getDORA(
        organizationId: string,
        from: Date,
        to: Date,
    ): Promise<IAnalyticsDoraMetrics | null>

    /**
     * Returns CCR metrics for repository in time range.
     *
     * @param repositoryId Repository identifier.
     * @param from Start date.
     * @param to End date.
     * @returns CCR metrics or null.
     */
    getCCRMetrics(
        repositoryId: string,
        from: Date,
        to: Date,
    ): Promise<IAnalyticsCcrMetrics | null>
}
