/**
 * Heatmap entry for aggregate issue statistics per file.
 */
export interface IIssueHeatmapEntryDTO {
    /**
     * Relative path to file.
     */
    readonly filePath: string

    /**
     * Total number of issues in file.
     */
    readonly totalIssues: number

    /**
     * Issues grouped by severity.
     */
    readonly bySeverity: Record<string, number>

    /**
     * Issues grouped by category.
     */
    readonly byCategory: Record<string, number>
}
