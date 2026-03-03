import type {IIssueHeatmapEntryDTO} from "./issue-heatmap-entry.dto"
import type {ITreemapNodeDTO} from "./treemap-node.dto"

/**
 * Hotspot payload for CodeCity.
 */
export interface IHotspotMetric {
    /**
     * File path for hotspot.
     */
    readonly filePath: string

    /**
     * Aggregated hotspot score.
     */
    readonly score: number
}

/**
 * Full payload for analytics dashboard and code city visualizations.
 */
export interface ICodeCityDataDTO {
    /**
     * Repository identifier string used in owning domain.
     */
    readonly repositoryId: string

    /**
     * Treemap root node.
     */
    readonly rootNode: ITreemapNodeDTO

    /**
     * Issue heatmap entries.
     */
    readonly heatmap: readonly IIssueHeatmapEntryDTO[]

    /**
     * Identified hotspots by score.
     */
    readonly hotspots: readonly IHotspotMetric[]

    /**
     * Timestamp of generation in ISO string.
     */
    readonly generatedAt: string
}
