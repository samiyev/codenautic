import type {IFileMetricsDTO} from "../../../dto/analytics/file-metrics.dto"

/**
 * Outbound contract for reading file-level metrics for CodeCity.
 */
export interface IFileMetricsProvider {
    /**
     * Returns metrics for provided files in one repository.
     *
     * @param repositoryId Repository identifier.
     * @param filePaths Absolute or relative file paths inside repository.
     * @returns File metrics list in the same order as file paths.
     */
    getMetrics(
        repositoryId: string,
        filePaths: readonly string[],
    ): Promise<readonly IFileMetricsDTO[]>
}
