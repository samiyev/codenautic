import type {IScanProgress, ScanPhase} from "../../../dto/scanning"

/**
 * Repository contract for scan progress persistence.
 */
export interface IScanProgressRepository {
    /**
     * Persists initial or updated scan progress snapshot.
     *
     * @param scanProgress Scan progress payload.
     */
    save(scanProgress: IScanProgress): Promise<void>

    /**
     * Loads progress snapshot by scan identifier.
     *
     * @param scanId Scan operation identifier.
     * @returns Saved progress or null if unknown.
     */
    findByScanId(scanId: string): Promise<IScanProgress | null>

    /**
     * Loads all progress snapshots for repository.
     *
     * @param repositoryId Repository identifier.
     * @returns Progress snapshots for repository.
     */
    findByRepoId(repositoryId: string): Promise<readonly IScanProgress[]>

    /**
     * Updates processed files and phase for active scan.
     *
     * @param scanId Scan operation identifier.
     * @param processedFiles Files processed so far.
     * @param phase Current scan phase.
     */
    updateProgress(
        scanId: string,
        processedFiles: number,
        phase: ScanPhase,
    ): Promise<void>

    /**
     * Marks scan as completed and sets terminal state.
     *
     * @param scanId Scan operation identifier.
     */
    markCompleted(scanId: string): Promise<void>

    /**
     * Marks scan as failed and stores error details.
     *
     * @param scanId Scan operation identifier.
     * @param errorMessage Failure message.
     */
    markFailed(scanId: string, errorMessage: string): Promise<void>
}
