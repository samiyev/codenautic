import type {IScanResult} from "@codenautic/core"

import {
    AST_SCAN_RESULT_AGGREGATOR_ERROR_CODE,
    AstScanResultAggregatorError,
} from "./ast-scan-result-aggregator.error"

interface INormalizedLanguageStat {
    readonly language: string
    readonly fileCount: number
    readonly loc: number
}

interface INormalizedScanResult {
    readonly scanId: string
    readonly repositoryId: string
    readonly totalFiles: number
    readonly totalNodes: number
    readonly totalEdges: number
    readonly languages: readonly INormalizedLanguageStat[]
    readonly duration: number
    readonly completedAt: string
    readonly completedAtUnixMs: number
}

interface IMutableRepositorySummary {
    readonly repositoryId: string
    scanCount: number
    totalFiles: number
    totalNodes: number
    totalEdges: number
    totalDuration: number
    lastCompletedAtUnixMs: number
    lastCompletedAt: string
    lastScanId: string
}

/**
 * One aggregated language stat in scan summary.
 */
export interface IAstScanSummaryLanguageStat {
    /**
     * Language display name.
     */
    readonly language: string

    /**
     * Number of files for this language across aggregated scan results.
     */
    readonly fileCount: number

    /**
     * Total LOC for this language across aggregated scan results.
     */
    readonly loc: number
}

/**
 * Per-repository summary inside aggregated scan summary.
 */
export interface IAstScanSummaryRepository {
    /**
     * Repository identifier.
     */
    readonly repositoryId: string

    /**
     * Number of scan results included for repository.
     */
    readonly scanCount: number

    /**
     * Aggregated files for repository.
     */
    readonly totalFiles: number

    /**
     * Aggregated nodes for repository.
     */
    readonly totalNodes: number

    /**
     * Aggregated edges for repository.
     */
    readonly totalEdges: number

    /**
     * Aggregated scan duration in milliseconds for repository.
     */
    readonly totalDuration: number

    /**
     * Average scan duration in milliseconds for repository.
     */
    readonly averageDuration: number

    /**
     * Latest completion timestamp for repository.
     */
    readonly lastCompletedAt: string

    /**
     * Scan identifier of latest scan for repository.
     */
    readonly lastScanId: string
}

/**
 * Metrics block for aggregated scan summary.
 */
export interface IAstScanSummaryMetrics {
    /**
     * Number of aggregated scan results.
     */
    readonly scanCount: number

    /**
     * Number of unique repositories inside aggregated scan results.
     */
    readonly repositoryCount: number

    /**
     * Aggregated scan duration in milliseconds.
     */
    readonly totalDuration: number

    /**
     * Average scan duration in milliseconds.
     */
    readonly averageDuration: number

    /**
     * Minimum scan duration in milliseconds.
     */
    readonly minDuration: number

    /**
     * Maximum scan duration in milliseconds.
     */
    readonly maxDuration: number

    /**
     * Earliest completion timestamp across aggregated scans.
     */
    readonly firstCompletedAt: string

    /**
     * Latest completion timestamp across aggregated scans.
     */
    readonly lastCompletedAt: string
}

/**
 * Aggregated scan summary projection.
 */
export interface IAstScanSummary {
    /**
     * Aggregated total file count.
     */
    readonly totalFiles: number

    /**
     * Aggregated total node count.
     */
    readonly totalNodes: number

    /**
     * Aggregated total edge count.
     */
    readonly totalEdges: number

    /**
     * Aggregated language stats.
     */
    readonly languages: readonly IAstScanSummaryLanguageStat[]

    /**
     * Aggregated metrics summary.
     */
    readonly metrics: IAstScanSummaryMetrics

    /**
     * Per-repository summary projection.
     */
    readonly repositories: readonly IAstScanSummaryRepository[]
}

/**
 * Scan result aggregator contract.
 */
export interface IAstScanResultAggregatorService {
    /**
     * Aggregates deterministic scan summary from scan results.
     *
     * @param scanResults Scan result list to aggregate.
     * @returns Aggregated scan summary payload.
     */
    aggregate(scanResults: readonly IScanResult[]): Promise<IAstScanSummary>
}

/**
 * Aggregates multiple `IScanResult` payloads into one `IAstScanSummary`.
 */
export class AstScanResultAggregatorService
    implements IAstScanResultAggregatorService
{
    /**
     * Aggregates deterministic scan summary from scan results.
     *
     * @param scanResults Scan result list to aggregate.
     * @returns Aggregated scan summary payload.
     */
    public aggregate(scanResults: readonly IScanResult[]): Promise<IAstScanSummary> {
        const normalizedScanResults = normalizeScanResults(scanResults)

        const languageStats = new Map<string, {fileCount: number; loc: number}>()
        const repositoryStats = new Map<string, IMutableRepositorySummary>()

        let totalFiles = 0
        let totalNodes = 0
        let totalEdges = 0
        let totalDuration = 0
        let minDuration = Number.POSITIVE_INFINITY
        let maxDuration = Number.NEGATIVE_INFINITY
        let firstCompletedAtUnixMs = Number.POSITIVE_INFINITY
        let lastCompletedAtUnixMs = Number.NEGATIVE_INFINITY
        let firstCompletedAt = ""
        let lastCompletedAt = ""

        for (const scanResult of normalizedScanResults) {
            totalFiles += scanResult.totalFiles
            totalNodes += scanResult.totalNodes
            totalEdges += scanResult.totalEdges
            totalDuration += scanResult.duration
            minDuration = Math.min(minDuration, scanResult.duration)
            maxDuration = Math.max(maxDuration, scanResult.duration)

            if (scanResult.completedAtUnixMs < firstCompletedAtUnixMs) {
                firstCompletedAtUnixMs = scanResult.completedAtUnixMs
                firstCompletedAt = scanResult.completedAt
            }

            if (scanResult.completedAtUnixMs > lastCompletedAtUnixMs) {
                lastCompletedAtUnixMs = scanResult.completedAtUnixMs
                lastCompletedAt = scanResult.completedAt
            }

            aggregateLanguageStats(languageStats, scanResult.languages)
            aggregateRepositoryStats(repositoryStats, scanResult)
        }

        const languages = buildLanguageStats(languageStats)
        const repositories = buildRepositoryStats(repositoryStats)
        const scanCount = normalizedScanResults.length
        const averageDuration = Math.round(totalDuration / scanCount)

        return Promise.resolve({
            totalFiles,
            totalNodes,
            totalEdges,
            languages,
            metrics: {
                scanCount,
                repositoryCount: repositoryStats.size,
                totalDuration,
                averageDuration,
                minDuration,
                maxDuration,
                firstCompletedAt,
                lastCompletedAt,
            },
            repositories,
        })
    }
}

/**
 * Normalizes and validates scan result collection.
 *
 * @param scanResults Raw scan result collection.
 * @returns Normalized scan results.
 */
function normalizeScanResults(
    scanResults: readonly IScanResult[],
): readonly INormalizedScanResult[] {
    if (scanResults.length === 0) {
        throw new AstScanResultAggregatorError(
            AST_SCAN_RESULT_AGGREGATOR_ERROR_CODE.EMPTY_SCAN_RESULTS,
        )
    }

    return scanResults.map((scanResult, index) => {
        return normalizeScanResult(scanResult, index)
    })
}

/**
 * Normalizes one scan result payload.
 *
 * @param scanResult Raw scan result payload.
 * @param index Scan result index in collection.
 * @returns Normalized scan result payload.
 */
function normalizeScanResult(
    scanResult: IScanResult,
    index: number,
): INormalizedScanResult {
    const scanId = normalizeNonEmptyString(
        scanResult.scanId,
        AST_SCAN_RESULT_AGGREGATOR_ERROR_CODE.INVALID_SCAN_ID,
        {
            resultIndex: index,
            scanId: scanResult.scanId,
        },
    )
    const repositoryId = normalizeNonEmptyString(
        scanResult.repositoryId,
        AST_SCAN_RESULT_AGGREGATOR_ERROR_CODE.INVALID_REPOSITORY_ID,
        {
            resultIndex: index,
            repositoryId: scanResult.repositoryId,
        },
    )
    const totalFiles = normalizeNonNegativeSafeInteger(
        scanResult.totalFiles,
        AST_SCAN_RESULT_AGGREGATOR_ERROR_CODE.INVALID_FILE_COUNT,
        index,
    )
    const totalNodes = normalizeNonNegativeSafeInteger(
        scanResult.totalNodes,
        AST_SCAN_RESULT_AGGREGATOR_ERROR_CODE.INVALID_TOTAL_NODES,
        index,
    )
    const totalEdges = normalizeNonNegativeSafeInteger(
        scanResult.totalEdges,
        AST_SCAN_RESULT_AGGREGATOR_ERROR_CODE.INVALID_TOTAL_EDGES,
        index,
    )
    const duration = normalizeNonNegativeSafeInteger(
        scanResult.duration,
        AST_SCAN_RESULT_AGGREGATOR_ERROR_CODE.INVALID_DURATION,
        index,
    )
    const normalizedLanguages = scanResult.languages.map((languageStat) => {
        return normalizeLanguageStat(languageStat, index)
    })
    const completedAt = normalizeNonEmptyString(
        scanResult.completedAt,
        AST_SCAN_RESULT_AGGREGATOR_ERROR_CODE.INVALID_COMPLETED_AT,
        {
            resultIndex: index,
            completedAt: scanResult.completedAt,
        },
    )
    const completedAtUnixMs = Date.parse(completedAt)
    if (Number.isNaN(completedAtUnixMs)) {
        throw new AstScanResultAggregatorError(
            AST_SCAN_RESULT_AGGREGATOR_ERROR_CODE.INVALID_COMPLETED_AT,
            {
                resultIndex: index,
                completedAt,
            },
        )
    }

    return {
        scanId,
        repositoryId,
        totalFiles,
        totalNodes,
        totalEdges,
        languages: normalizedLanguages,
        duration,
        completedAt,
        completedAtUnixMs,
    }
}

/**
 * Normalizes one language stat payload.
 *
 * @param languageStat Raw language stat payload.
 * @param resultIndex Parent scan result index.
 * @returns Normalized language stat payload.
 */
function normalizeLanguageStat(
    languageStat: IScanResult["languages"][number],
    resultIndex: number,
): INormalizedLanguageStat {
    const language = normalizeNonEmptyString(
        languageStat.language,
        AST_SCAN_RESULT_AGGREGATOR_ERROR_CODE.INVALID_LANGUAGE,
        {
            resultIndex,
            language: languageStat.language,
        },
    )
    const fileCount = normalizeNonNegativeSafeInteger(
        languageStat.fileCount,
        AST_SCAN_RESULT_AGGREGATOR_ERROR_CODE.INVALID_LANGUAGE_FILE_COUNT,
        resultIndex,
    )
    const loc = normalizeNonNegativeSafeInteger(
        languageStat.loc,
        AST_SCAN_RESULT_AGGREGATOR_ERROR_CODE.INVALID_LANGUAGE_LOC,
        resultIndex,
    )

    return {
        language,
        fileCount,
        loc,
    }
}

/**
 * Normalizes one required non-empty string.
 *
 * @param value Raw string value.
 * @param code Typed error code when value is empty.
 * @param details Error metadata payload.
 * @returns Normalized trimmed string.
 */
function normalizeNonEmptyString(
    value: string,
    code:
        | typeof AST_SCAN_RESULT_AGGREGATOR_ERROR_CODE.INVALID_SCAN_ID
        | typeof AST_SCAN_RESULT_AGGREGATOR_ERROR_CODE.INVALID_REPOSITORY_ID
        | typeof AST_SCAN_RESULT_AGGREGATOR_ERROR_CODE.INVALID_LANGUAGE
        | typeof AST_SCAN_RESULT_AGGREGATOR_ERROR_CODE.INVALID_COMPLETED_AT,
    details: {
        readonly resultIndex: number
        readonly scanId?: string
        readonly repositoryId?: string
        readonly language?: string
        readonly completedAt?: string
    },
): string {
    const normalized = value.trim()
    if (normalized.length > 0) {
        return normalized
    }

    throw new AstScanResultAggregatorError(code, details)
}

/**
 * Normalizes one required non-negative safe integer.
 *
 * @param value Raw numeric value.
 * @param code Typed error code emitted on invalid value.
 * @param resultIndex Parent scan result index.
 * @returns Normalized numeric value.
 */
function normalizeNonNegativeSafeInteger(
    value: number,
    code:
        | typeof AST_SCAN_RESULT_AGGREGATOR_ERROR_CODE.INVALID_FILE_COUNT
        | typeof AST_SCAN_RESULT_AGGREGATOR_ERROR_CODE.INVALID_TOTAL_NODES
        | typeof AST_SCAN_RESULT_AGGREGATOR_ERROR_CODE.INVALID_TOTAL_EDGES
        | typeof AST_SCAN_RESULT_AGGREGATOR_ERROR_CODE.INVALID_DURATION
        | typeof AST_SCAN_RESULT_AGGREGATOR_ERROR_CODE.INVALID_LANGUAGE_FILE_COUNT
        | typeof AST_SCAN_RESULT_AGGREGATOR_ERROR_CODE.INVALID_LANGUAGE_LOC,
    resultIndex: number,
): number {
    if (Number.isSafeInteger(value) && value >= 0) {
        return value
    }

    throw new AstScanResultAggregatorError(code, {
        resultIndex,
        value,
    })
}

/**
 * Aggregates language stats from one scan result into mutable accumulator.
 *
 * @param languageStats Mutable language stats accumulator.
 * @param languages Normalized language stats.
 */
function aggregateLanguageStats(
    languageStats: Map<string, {fileCount: number; loc: number}>,
    languages: readonly INormalizedLanguageStat[],
): void {
    for (const languageStat of languages) {
        const existing = languageStats.get(languageStat.language)
        if (existing === undefined) {
            languageStats.set(languageStat.language, {
                fileCount: languageStat.fileCount,
                loc: languageStat.loc,
            })
            continue
        }

        languageStats.set(languageStat.language, {
            fileCount: existing.fileCount + languageStat.fileCount,
            loc: existing.loc + languageStat.loc,
        })
    }
}

/**
 * Aggregates one normalized scan result into mutable repository stats map.
 *
 * @param repositoryStats Mutable repository stats map.
 * @param scanResult Normalized scan result payload.
 */
function aggregateRepositoryStats(
    repositoryStats: Map<string, IMutableRepositorySummary>,
    scanResult: INormalizedScanResult,
): void {
    const current = repositoryStats.get(scanResult.repositoryId)
    if (current === undefined) {
        repositoryStats.set(scanResult.repositoryId, {
            repositoryId: scanResult.repositoryId,
            scanCount: 1,
            totalFiles: scanResult.totalFiles,
            totalNodes: scanResult.totalNodes,
            totalEdges: scanResult.totalEdges,
            totalDuration: scanResult.duration,
            lastCompletedAtUnixMs: scanResult.completedAtUnixMs,
            lastCompletedAt: scanResult.completedAt,
            lastScanId: scanResult.scanId,
        })
        return
    }

    current.scanCount += 1
    current.totalFiles += scanResult.totalFiles
    current.totalNodes += scanResult.totalNodes
    current.totalEdges += scanResult.totalEdges
    current.totalDuration += scanResult.duration

    if (scanResult.completedAtUnixMs > current.lastCompletedAtUnixMs) {
        current.lastCompletedAtUnixMs = scanResult.completedAtUnixMs
        current.lastCompletedAt = scanResult.completedAt
        current.lastScanId = scanResult.scanId
    }
}

/**
 * Builds deterministic language stats projection from mutable map.
 *
 * @param languageStats Mutable language stats map.
 * @returns Deterministic language stats projection.
 */
function buildLanguageStats(
    languageStats: Map<string, {fileCount: number; loc: number}>,
): readonly IAstScanSummaryLanguageStat[] {
    return [...languageStats.entries()]
        .map(([language, stats]): IAstScanSummaryLanguageStat => {
            return {
                language,
                fileCount: stats.fileCount,
                loc: stats.loc,
            }
        })
        .sort((left, right) => left.language.localeCompare(right.language))
}

/**
 * Builds deterministic repository stats projection from mutable map.
 *
 * @param repositoryStats Mutable repository stats map.
 * @returns Deterministic repository stats projection.
 */
function buildRepositoryStats(
    repositoryStats: Map<string, IMutableRepositorySummary>,
): readonly IAstScanSummaryRepository[] {
    return [...repositoryStats.values()]
        .map((repositorySummary): IAstScanSummaryRepository => {
            return {
                repositoryId: repositorySummary.repositoryId,
                scanCount: repositorySummary.scanCount,
                totalFiles: repositorySummary.totalFiles,
                totalNodes: repositorySummary.totalNodes,
                totalEdges: repositorySummary.totalEdges,
                totalDuration: repositorySummary.totalDuration,
                averageDuration: Math.round(
                    repositorySummary.totalDuration / repositorySummary.scanCount,
                ),
                lastCompletedAt: repositorySummary.lastCompletedAt,
                lastScanId: repositorySummary.lastScanId,
            }
        })
        .sort((left, right) => left.repositoryId.localeCompare(right.repositoryId))
}
