import {
    FilePath,
} from "@codenautic/core"

import {
    AST_SCAN_PROGRESS_REPORTER_ERROR_CODE,
    AstScanProgressReporterError,
} from "./ast-scan-progress-reporter.error"

/**
 * Clock callback used for progress timestamps and ETA math.
 */
export type AstScanProgressReporterNow = () => number

/**
 * Optional callback fired after every normalized progress snapshot.
 */
export type AstScanProgressReporterOnSnapshot = (
    snapshot: IAstScanProgressSnapshot,
) => Promise<void> | void

/**
 * Progress payload for scan callback compatibility.
 */
export interface IScanProgressState {
    /**
     * Number of processed files.
     */
    readonly processedFiles: number

    /**
     * Number of total files.
     */
    readonly totalFiles: number
}

/**
 * Callback signature compatible with repository scanner progress updates.
 */
export type IScanProgressCallback = (
    progress: IScanProgressState,
) => Promise<void> | void

/**
 * Runtime options for scan progress reporter service.
 */
export interface IAstScanProgressReporterServiceOptions {
    /**
     * Optional clock callback override.
     */
    readonly now?: AstScanProgressReporterNow

    /**
     * Optional callback for snapshot emission.
     */
    readonly onSnapshot?: AstScanProgressReporterOnSnapshot
}

/**
 * Normalized scan progress snapshot.
 */
export interface IAstScanProgressSnapshot {
    /**
     * Number of processed files.
     */
    readonly processedFiles: number

    /**
     * Number of total planned files.
     */
    readonly totalFiles: number

    /**
     * Current file progress ratio in range `[0, 1]`.
     */
    readonly progressRatio: number

    /**
     * Current progress percent in range `[0, 100]`.
     */
    readonly progressPercent: number

    /**
     * Current file path when known.
     */
    readonly currentFilePath?: string

    /**
     * Elapsed milliseconds since reporter reset/start.
     */
    readonly elapsedMs: number

    /**
     * Estimated remaining duration in milliseconds.
     * `null` when ETA cannot be computed yet.
     */
    readonly etaMs: number | null

    /**
     * Snapshot timestamp in ISO 8601 format.
     */
    readonly updatedAt: string
}

/**
 * Scan progress reporter contract.
 */
export interface IAstScanProgressReporterService {
    /**
     * Sets current repository-relative file path.
     *
     * @param filePath Repository-relative file path.
     */
    setCurrentFile(filePath: string): void

    /**
     * Clears current file indicator.
     */
    clearCurrentFile(): void

    /**
     * Resets internal timer and snapshot state.
     */
    reset(): void

    /**
     * Returns latest produced snapshot when available.
     *
     * @returns Latest snapshot or undefined.
     */
    getSnapshot(): IAstScanProgressSnapshot | undefined

    /**
     * Returns callback compatible with `IRepositoryScanner`.
     *
     * @returns Scan progress callback.
     */
    asCallback(): IScanProgressCallback

    /**
     * Reports one progress snapshot.
     *
     * @param progress Raw progress payload.
     * @returns Normalized snapshot.
     */
    report(progress: IScanProgressState): Promise<IAstScanProgressSnapshot>
}

/**
 * Reports scan progress with current-file and ETA enrichment.
 */
export class AstScanProgressReporterService
    implements IAstScanProgressReporterService
{
    private readonly now: AstScanProgressReporterNow
    private readonly onSnapshot?: AstScanProgressReporterOnSnapshot
    private startedAtUnixMs: number
    private currentFilePath?: string
    private latestSnapshot?: IAstScanProgressSnapshot

    /**
     * Creates scan progress reporter service.
     *
     * @param options Optional runtime configuration.
     */
    public constructor(options: IAstScanProgressReporterServiceOptions = {}) {
        this.now = options.now ?? Date.now
        this.onSnapshot = validateOnSnapshot(options.onSnapshot)
        this.startedAtUnixMs = this.now()
    }

    /**
     * Sets current repository-relative file path.
     *
     * @param filePath Repository-relative file path.
     */
    public setCurrentFile(filePath: string): void {
        this.currentFilePath = normalizeFilePath(filePath)
    }

    /**
     * Clears current file indicator.
     */
    public clearCurrentFile(): void {
        this.currentFilePath = undefined
    }

    /**
     * Resets internal timer and snapshot state.
     */
    public reset(): void {
        this.startedAtUnixMs = this.now()
        this.currentFilePath = undefined
        this.latestSnapshot = undefined
    }

    /**
     * Returns latest produced snapshot when available.
     *
     * @returns Latest snapshot or undefined.
     */
    public getSnapshot(): IAstScanProgressSnapshot | undefined {
        return this.latestSnapshot
    }

    /**
     * Returns callback compatible with `IRepositoryScanner`.
     *
     * @returns Scan progress callback.
     */
    public asCallback(): IScanProgressCallback {
        return async (progress): Promise<void> => {
            await this.report(progress)
        }
    }

    /**
     * Reports one progress snapshot.
     *
     * @param progress Raw progress payload.
     * @returns Normalized snapshot.
     */
    public async report(
        progress: IScanProgressState,
    ): Promise<IAstScanProgressSnapshot> {
        const processedFiles = normalizeNonNegativeInteger(
            progress.processedFiles,
            AST_SCAN_PROGRESS_REPORTER_ERROR_CODE.INVALID_PROCESSED_FILES,
        )
        const totalFiles = normalizeNonNegativeInteger(
            progress.totalFiles,
            AST_SCAN_PROGRESS_REPORTER_ERROR_CODE.INVALID_TOTAL_FILES,
        )
        if (processedFiles > totalFiles) {
            throw new AstScanProgressReporterError(
                AST_SCAN_PROGRESS_REPORTER_ERROR_CODE.INVALID_PROCESSED_FILES,
                {
                    value: processedFiles,
                },
            )
        }

        const updatedAtUnixMs = this.now()
        const elapsedMs = Math.max(0, updatedAtUnixMs - this.startedAtUnixMs)
        const progressRatio =
            totalFiles === 0 ? 0 : processedFiles / totalFiles
        const progressPercent = Math.round(progressRatio * 10_000) / 100
        const etaMs = resolveEtaMs({
            elapsedMs,
            processedFiles,
            totalFiles,
        })

        const snapshot: IAstScanProgressSnapshot = {
            processedFiles,
            totalFiles,
            progressRatio,
            progressPercent,
            currentFilePath: this.currentFilePath,
            elapsedMs,
            etaMs,
            updatedAt: new Date(updatedAtUnixMs).toISOString(),
        }

        this.latestSnapshot = snapshot
        await this.emitSnapshot(snapshot)
        return snapshot
    }

    /**
     * Emits one snapshot to optional listener.
     *
     * @param snapshot Normalized progress snapshot.
     * @returns Promise resolved when callback handling completes.
     */
    private async emitSnapshot(snapshot: IAstScanProgressSnapshot): Promise<void> {
        if (this.onSnapshot === undefined) {
            return
        }

        try {
            await this.onSnapshot(snapshot)
        } catch (error) {
            throw new AstScanProgressReporterError(
                AST_SCAN_PROGRESS_REPORTER_ERROR_CODE.SNAPSHOT_CALLBACK_FAILED,
                {
                    causeMessage: resolveUnknownErrorMessage(error),
                },
            )
        }
    }
}

/**
 * Validates optional snapshot callback.
 *
 * @param onSnapshot Candidate callback.
 * @returns Valid callback or undefined.
 */
function validateOnSnapshot(
    onSnapshot: AstScanProgressReporterOnSnapshot | undefined,
): AstScanProgressReporterOnSnapshot | undefined {
    if (onSnapshot === undefined) {
        return undefined
    }

    if (typeof onSnapshot === "function") {
        return onSnapshot
    }

    throw new AstScanProgressReporterError(
        AST_SCAN_PROGRESS_REPORTER_ERROR_CODE.INVALID_ON_SNAPSHOT,
    )
}

/**
 * Normalizes repository-relative file path.
 *
 * @param filePath Raw repository-relative file path.
 * @returns Normalized repository-relative file path.
 */
function normalizeFilePath(filePath: string): string {
    try {
        return FilePath.create(filePath).toString()
    } catch {
        throw new AstScanProgressReporterError(
            AST_SCAN_PROGRESS_REPORTER_ERROR_CODE.INVALID_FILE_PATH,
            {
                filePath,
            },
        )
    }
}

/**
 * Normalizes non-negative safe integer.
 *
 * @param value Raw numeric value.
 * @param code Typed error code emitted on invalid value.
 * @returns Normalized non-negative safe integer.
 */
function normalizeNonNegativeInteger(
    value: number,
    code:
        | typeof AST_SCAN_PROGRESS_REPORTER_ERROR_CODE.INVALID_PROCESSED_FILES
        | typeof AST_SCAN_PROGRESS_REPORTER_ERROR_CODE.INVALID_TOTAL_FILES,
): number {
    if (Number.isSafeInteger(value) && value >= 0) {
        return value
    }

    throw new AstScanProgressReporterError(code, {
        value,
    })
}

/**
 * Resolves ETA in milliseconds from progress state.
 *
 * @param params ETA input payload.
 * @returns ETA in milliseconds or null when unknown.
 */
function resolveEtaMs(params: {
    readonly elapsedMs: number
    readonly processedFiles: number
    readonly totalFiles: number
}): number | null {
    if (params.processedFiles === 0) {
        return null
    }

    if (params.processedFiles >= params.totalFiles) {
        return 0
    }

    const avgPerFileMs = params.elapsedMs / params.processedFiles
    const remainingFiles = params.totalFiles - params.processedFiles
    return Math.max(0, Math.round(avgPerFileMs * remainingFiles))
}

/**
 * Resolves unknown error payload to stable message.
 *
 * @param error Unknown error payload.
 * @returns Stable error message.
 */
function resolveUnknownErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message
    }

    return "Unknown error"
}
