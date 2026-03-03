import type {IIssueHeatmapEntryDTO} from "../../../dto/analytics/issue-heatmap-entry.dto"

/**
 * Outbound contract for aggregating issue metrics by file for CodeCity.
 */
export interface IIssueAggregationProvider {
    /**
     * Aggregates issue statistics for every file in repository.
     *
     * @param repositoryId Repository identifier.
     * @returns Heatmap-like payload grouped by file path.
     */
    aggregateByFile(repositoryId: string): Promise<readonly IIssueHeatmapEntryDTO[]>
}
