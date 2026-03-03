import type {IScanResult} from "../../../dto/scanning"

/**
 * Progress payload for repository scan callback.
 */
export interface IScanProgressState {
    /**
     * Number of files already processed.
     */
    readonly processedFiles: number

    /**
     * Total files planned for scan.
     */
    readonly totalFiles: number
}

/**
 * Optional callback for scan progress updates.
 *
 * @param progress Current progress state.
 */
export type IScanProgressCallback = (progress: IScanProgressState) => Promise<void> | void

/**
 * Outbound contract for repository scan orchestration.
 */
export interface IRepositoryScanner {
    /**
     * Runs repository scan for target reference.
     *
     * @param repositoryId Repository identifier.
     * @param ref Branch or commit reference.
     * @param onProgress Optional progress callback.
     * @returns Scan result payload.
     */
    scanRepository(
        repositoryId: string,
        ref: string,
        onProgress?: IScanProgressCallback,
    ): Promise<IScanResult>

    /**
     * Cancels active scan by identifier.
     *
     * @param scanId Scan operation identifier.
     */
    cancelScan(scanId: string): Promise<void>
}
