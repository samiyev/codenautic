import {spawn} from "node:child_process"
import {readFile} from "node:fs/promises"
import {join, resolve} from "node:path"
import {randomUUID} from "node:crypto"

import {
    AST_LANGUAGE,
    FilePath,
    type IRepositoryScanner,
    type IScanResult,
    type SupportedLanguage,
} from "@codenautic/core"

import {
    AST_INCREMENTAL_DIFF_SCANNER_ERROR_CODE,
    AstIncrementalDiffScannerError,
} from "./ast-incremental-diff-scanner.error"
import {
    type IAstLanguageDetectionService,
    AstLanguageDetectionService,
} from "./ast-language-detection.service"

const DEFAULT_MAX_READ_ATTEMPTS = 2
const DEFAULT_RETRY_BACKOFF_MS = 25
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000
const DEFAULT_MAX_CACHE_ENTRIES = 2_000

const LANGUAGE_DISPLAY_NAMES: Readonly<Record<SupportedLanguage, string>> = {
    [AST_LANGUAGE.CSHARP]: "C#",
    [AST_LANGUAGE.GO]: "Go",
    [AST_LANGUAGE.JAVA]: "Java",
    [AST_LANGUAGE.JAVASCRIPT]: "JavaScript",
    [AST_LANGUAGE.JSX]: "JSX",
    [AST_LANGUAGE.KOTLIN]: "Kotlin",
    [AST_LANGUAGE.PHP]: "PHP",
    [AST_LANGUAGE.PYTHON]: "Python",
    [AST_LANGUAGE.RUBY]: "Ruby",
    [AST_LANGUAGE.RUST]: "Rust",
    [AST_LANGUAGE.TSX]: "TSX",
    [AST_LANGUAGE.TYPESCRIPT]: "TypeScript",
}

interface IAstIncrementalDiffScannerSourceFile {
    readonly filePath: string
    readonly language: SupportedLanguage
}

interface IAstIncrementalDiffScannerFileStats {
    readonly language: SupportedLanguage
    readonly loc: number
    readonly nodeCount: number
    readonly edgeCount: number
}

interface IAstIncrementalDiffScannerCacheEntry {
    readonly repositoryId: string
    readonly ref: string
    readonly filePath: string
    readonly stats: IAstIncrementalDiffScannerFileStats
    readonly cachedAtUnixMs: number
    readonly expiresAtUnixMs: number
}

/**
 * Progress payload for incremental diff scanner callback.
 */
export interface IAstIncrementalDiffScannerProgress {
    /**
     * Number of already processed changed files.
     */
    readonly processedFiles: number

    /**
     * Total changed files planned for scan.
     */
    readonly totalFiles: number
}

/**
 * Optional progress callback for incremental diff scanner.
 */
export type IAstIncrementalDiffScannerProgressCallback = (
    progress: IAstIncrementalDiffScannerProgress,
) => Promise<void> | void

/**
 * Repository path resolver callback.
 */
export type AstIncrementalDiffScannerResolveRepositoryPath = (
    repositoryId: string,
    ref: string,
) => Promise<string> | string

/**
 * Changed file paths resolver callback.
 */
export type AstIncrementalDiffScannerResolveChangedFilePaths = (
    repositoryPath: string,
    repositoryId: string,
    ref: string,
) => Promise<readonly string[]>

/**
 * Source file read callback.
 */
export type AstIncrementalDiffScannerReadFile = (
    absoluteFilePath: string,
) => Promise<Buffer>

/**
 * Clock callback for deterministic metrics and cache behavior.
 */
export type AstIncrementalDiffScannerNow = () => number

/**
 * Scan id generator callback.
 */
export type AstIncrementalDiffScannerGenerateScanId = () => string

/**
 * Git command executor callback.
 */
export type AstIncrementalDiffScannerExecuteGit = (
    command: string,
    args: readonly string[],
    cwd: string,
) => Promise<string>

/**
 * Runtime options for AST incremental diff scanner.
 */
export interface IAstIncrementalDiffScannerServiceOptions {
    /**
     * Optional repository path resolver callback.
     */
    readonly resolveRepositoryPath?: AstIncrementalDiffScannerResolveRepositoryPath

    /**
     * Optional changed files resolver callback.
     */
    readonly resolveChangedFilePaths?: AstIncrementalDiffScannerResolveChangedFilePaths

    /**
     * Optional source file read callback.
     */
    readonly readFile?: AstIncrementalDiffScannerReadFile

    /**
     * Optional language detection service.
     */
    readonly languageDetectionService?: IAstLanguageDetectionService

    /**
     * Optional scan id generator callback.
     */
    readonly generateScanId?: AstIncrementalDiffScannerGenerateScanId

    /**
     * Optional git command executor for default changed-files resolver.
     */
    readonly executeGit?: AstIncrementalDiffScannerExecuteGit

    /**
     * Optional clock callback.
     */
    readonly now?: AstIncrementalDiffScannerNow

    /**
     * Optional max read attempts for recoverable file read failures.
     */
    readonly maxReadAttempts?: number

    /**
     * Optional retry backoff in milliseconds between read attempts.
     */
    readonly retryBackoffMs?: number

    /**
     * Optional cache ttl in milliseconds for incremental AST artifacts.
     */
    readonly cacheTtlMs?: number

    /**
     * Optional bound of cache entries.
     */
    readonly maxCacheEntries?: number
}

/**
 * Scans only changed files for one ref or ref-range and returns incremental `IScanResult`.
 */
export class AstIncrementalDiffScannerService implements IRepositoryScanner {
    private readonly resolveRepositoryPath: AstIncrementalDiffScannerResolveRepositoryPath
    private readonly resolveChangedFilePaths: AstIncrementalDiffScannerResolveChangedFilePaths
    private readonly readFile: AstIncrementalDiffScannerReadFile
    private readonly languageDetectionService: IAstLanguageDetectionService
    private readonly generateScanId: AstIncrementalDiffScannerGenerateScanId
    private readonly now: AstIncrementalDiffScannerNow
    private readonly maxReadAttempts: number
    private readonly retryBackoffMs: number
    private readonly cacheTtlMs: number
    private readonly maxCacheEntries: number
    private readonly cache = new Map<string, IAstIncrementalDiffScannerCacheEntry>()
    private readonly cancelledScanIds = new Set<string>()

    /**
     * Creates AST incremental diff scanner service.
     *
     * @param options Optional runtime dependencies and settings.
     */
    public constructor(options: IAstIncrementalDiffScannerServiceOptions = {}) {
        const executeGit = validateExecuteGit(
            resolveOptionalValue(options.executeGit, () => executeGitCommand),
        )
        const resolveChangedFilePaths = resolveOptionalValue(
            options.resolveChangedFilePaths,
            () => {
                return (repositoryPath, repositoryId, ref) =>
                    defaultResolveChangedFilePaths(
                        repositoryPath,
                        repositoryId,
                        ref,
                        executeGit,
                    )
            },
        )

        this.resolveRepositoryPath = validateResolveRepositoryPath(
            resolveOptionalValue(
                options.resolveRepositoryPath,
                () => defaultResolveRepositoryPath,
            ),
        )
        this.resolveChangedFilePaths = validateResolveChangedFilePaths(
            resolveChangedFilePaths,
        )
        this.readFile = validateReadFile(
            resolveOptionalValue(options.readFile, () => defaultReadFile),
        )
        this.languageDetectionService = resolveOptionalValue(
            options.languageDetectionService,
            () => new AstLanguageDetectionService(),
        )
        this.generateScanId = validateGenerateScanId(
            resolveOptionalValue(options.generateScanId, () => defaultGenerateScanId),
        )
        this.now = resolveOptionalValue(options.now, () => Date.now)
        this.maxReadAttempts = validatePositiveInteger(
            resolveOptionalValue(options.maxReadAttempts, () => DEFAULT_MAX_READ_ATTEMPTS),
            AST_INCREMENTAL_DIFF_SCANNER_ERROR_CODE.INVALID_MAX_READ_ATTEMPTS,
        )
        this.retryBackoffMs = validatePositiveInteger(
            resolveOptionalValue(options.retryBackoffMs, () => DEFAULT_RETRY_BACKOFF_MS),
            AST_INCREMENTAL_DIFF_SCANNER_ERROR_CODE.INVALID_RETRY_BACKOFF_MS,
        )
        this.cacheTtlMs = validatePositiveInteger(
            resolveOptionalValue(options.cacheTtlMs, () => DEFAULT_CACHE_TTL_MS),
            AST_INCREMENTAL_DIFF_SCANNER_ERROR_CODE.INVALID_CACHE_TTL_MS,
        )
        this.maxCacheEntries = validatePositiveInteger(
            resolveOptionalValue(
                options.maxCacheEntries,
                () => DEFAULT_MAX_CACHE_ENTRIES,
            ),
            AST_INCREMENTAL_DIFF_SCANNER_ERROR_CODE.INVALID_MAX_CACHE_ENTRIES,
        )
    }

    /**
     * Runs incremental repository scan for changed files only.
     *
     * @param repositoryId Repository identifier.
     * @param ref Branch, commit, or explicit ref-range.
     * @param onProgress Optional progress callback.
     * @returns Incremental scan result payload.
     */
    public async scanRepository(
        repositoryId: string,
        ref: string,
        onProgress?: IAstIncrementalDiffScannerProgressCallback,
    ): Promise<IScanResult> {
        const normalizedRepositoryId = normalizeRepositoryId(repositoryId)
        const normalizedRef = normalizeRef(ref)
        const scanId = normalizeScanId(this.generateScanId())
        const startedAt = this.now()

        try {
            const repositoryPath = await this.resolveRepositoryPathOrThrow(
                normalizedRepositoryId,
                normalizedRef,
            )
            const changedFilePaths = await this.resolveChangedFilePathsOrThrow(
                repositoryPath,
                normalizedRepositoryId,
                normalizedRef,
            )
            const sourceFiles = this.collectSupportedChangedFiles(changedFilePaths)

            return await this.scanChangedFiles({
                scanId,
                repositoryId: normalizedRepositoryId,
                repositoryPath,
                ref: normalizedRef,
                sourceFiles,
                startedAt,
                onProgress,
            })
        } finally {
            this.cancelledScanIds.delete(scanId)
        }
    }

    /**
     * Requests cancellation for active scan identifier.
     *
     * @param scanId Scan identifier.
     */
    public cancelScan(scanId: string): Promise<void> {
        const normalizedScanId = scanId.trim()
        if (normalizedScanId.length > 0) {
            this.cancelledScanIds.add(normalizedScanId)
        }

        return Promise.resolve()
    }

    /**
     * Invalidates cache entries for one repository.
     *
     * @param repositoryId Repository identifier.
     * @returns Number of removed cache entries.
     */
    public invalidateRepository(repositoryId: string): number {
        const normalizedRepositoryId = normalizeRepositoryId(repositoryId)
        let removedEntries = 0

        for (const [cacheKey, entry] of this.cache.entries()) {
            if (entry.repositoryId === normalizedRepositoryId) {
                this.cache.delete(cacheKey)
                removedEntries += 1
            }
        }

        return removedEntries
    }

    /**
     * Clears all incremental scanner cache entries.
     */
    public clear(): void {
        this.cache.clear()
    }

    /**
     * Resolves repository path with typed failure wrapping.
     *
     * @param repositoryId Normalized repository identifier.
     * @param ref Normalized ref value.
     * @returns Canonical absolute repository path.
     */
    private async resolveRepositoryPathOrThrow(
        repositoryId: string,
        ref: string,
    ): Promise<string> {
        try {
            const repositoryPath = await this.resolveRepositoryPath(repositoryId, ref)
            return normalizeRepositoryPath(repositoryPath)
        } catch (error) {
            if (error instanceof AstIncrementalDiffScannerError) {
                throw error
            }

            throw new AstIncrementalDiffScannerError(
                AST_INCREMENTAL_DIFF_SCANNER_ERROR_CODE.REPOSITORY_PATH_RESOLUTION_FAILED,
                {
                    repositoryId,
                    ref,
                    causeMessage: resolveUnknownErrorMessage(error),
                },
            )
        }
    }

    /**
     * Resolves changed file paths with typed failure wrapping.
     *
     * @param repositoryPath Canonical repository path.
     * @param repositoryId Normalized repository identifier.
     * @param ref Normalized ref value.
     * @returns Normalized changed file paths.
     */
    private async resolveChangedFilePathsOrThrow(
        repositoryPath: string,
        repositoryId: string,
        ref: string,
    ): Promise<readonly string[]> {
        try {
            const changedFilePaths = await this.resolveChangedFilePaths(
                repositoryPath,
                repositoryId,
                ref,
            )
            return normalizeChangedFilePaths(changedFilePaths)
        } catch (error) {
            if (error instanceof AstIncrementalDiffScannerError) {
                throw error
            }

            throw new AstIncrementalDiffScannerError(
                AST_INCREMENTAL_DIFF_SCANNER_ERROR_CODE.CHANGED_FILES_RESOLUTION_FAILED,
                {
                    repositoryId,
                    repositoryPath,
                    ref,
                    causeMessage: resolveUnknownErrorMessage(error),
                },
            )
        }
    }

    /**
     * Filters changed files to supported source files and resolves language per file.
     *
     * @param changedFilePaths Normalized changed file paths.
     * @returns Supported source files sorted by path.
     */
    private collectSupportedChangedFiles(
        changedFilePaths: readonly string[],
    ): readonly IAstIncrementalDiffScannerSourceFile[] {
        const sourceFiles: IAstIncrementalDiffScannerSourceFile[] = []

        for (const filePath of changedFilePaths) {
            const language = this.detectLanguage(filePath)
            if (language === undefined) {
                continue
            }

            sourceFiles.push({
                filePath,
                language,
            })
        }

        sourceFiles.sort((left, right) => left.filePath.localeCompare(right.filePath))
        return sourceFiles
    }

    /**
     * Detects source language and skips unsupported files.
     *
     * @param filePath Repository-relative file path.
     * @returns Supported language or undefined when file should be skipped.
     */
    private detectLanguage(filePath: string): SupportedLanguage | undefined {
        try {
            return this.languageDetectionService.detect({filePath})
        } catch {
            return undefined
        }
    }

    /**
     * Scans changed source files and builds incremental scan result.
     *
     * @param params Scan execution payload.
     * @returns Incremental scan result payload.
     */
    private async scanChangedFiles(params: {
        readonly scanId: string
        readonly repositoryId: string
        readonly repositoryPath: string
        readonly ref: string
        readonly sourceFiles: readonly IAstIncrementalDiffScannerSourceFile[]
        readonly startedAt: number
        readonly onProgress?: IAstIncrementalDiffScannerProgressCallback
    }): Promise<IScanResult> {
        const languageStats = new Map<SupportedLanguage, {fileCount: number; loc: number}>()
        let scannedFiles = 0
        let totalNodes = 0
        let totalEdges = 0
        let processedFiles = 0

        for (const sourceFile of params.sourceFiles) {
            this.assertScanActive(params.scanId)

            const stats = await this.resolveFileStats({
                repositoryPath: params.repositoryPath,
                repositoryId: params.repositoryId,
                ref: params.ref,
                sourceFile,
            })

            if (stats !== undefined) {
                mergeLanguageStats(languageStats, stats.language, stats.loc)
                scannedFiles += 1
                totalNodes += stats.nodeCount
                totalEdges += stats.edgeCount
            }

            processedFiles += 1
            await this.reportProgress(
                params.scanId,
                params.onProgress,
                processedFiles,
                params.sourceFiles.length,
            )
        }

        return buildScanResult({
            scanId: params.scanId,
            repositoryId: params.repositoryId,
            languageStats,
            totalFiles: scannedFiles,
            totalNodes,
            totalEdges,
            durationMs: Math.max(0, this.now() - params.startedAt),
            completedAtIso: new Date(this.now()).toISOString(),
        })
    }

    /**
     * Resolves one changed-file stats payload from cache or source file read.
     *
     * @param params File stats resolution payload.
     * @returns Stats payload or undefined when file no longer exists.
     */
    private async resolveFileStats(params: {
        readonly repositoryPath: string
        readonly repositoryId: string
        readonly ref: string
        readonly sourceFile: IAstIncrementalDiffScannerSourceFile
    }): Promise<IAstIncrementalDiffScannerFileStats | undefined> {
        const cacheKey = resolveCacheKey(
            params.repositoryId,
            params.ref,
            params.sourceFile.filePath,
        )
        const cachedEntry = this.resolveCachedEntry(cacheKey, this.now())
        if (cachedEntry !== undefined) {
            return cachedEntry.stats
        }

        const absolutePath = join(params.repositoryPath, params.sourceFile.filePath)
        const sourceBuffer = await this.readSourceFileWithRetry(
            absolutePath,
            params.sourceFile.filePath,
        )
        if (sourceBuffer === undefined) {
            return undefined
        }

        const sourceCode = sourceBuffer.toString("utf8")
        const fileStats: IAstIncrementalDiffScannerFileStats = {
            language: params.sourceFile.language,
            loc: countLoc(sourceCode),
            nodeCount: countChangedNodes(sourceCode, params.sourceFile.language),
            edgeCount: countDependencyEdges(sourceCode, params.sourceFile.language),
        }

        this.persistCacheEntry(cacheKey, {
            repositoryId: params.repositoryId,
            ref: params.ref,
            filePath: params.sourceFile.filePath,
            stats: fileStats,
            cachedAtUnixMs: this.now(),
            expiresAtUnixMs: this.now() + this.cacheTtlMs,
        })

        return fileStats
    }

    /**
     * Reads one source file with bounded retry policy.
     *
     * @param absolutePath Absolute source file path.
     * @param filePath Repository-relative source file path.
     * @returns Raw source buffer or undefined when file was removed.
     */
    private async readSourceFileWithRetry(
        absolutePath: string,
        filePath: string,
    ): Promise<Buffer | undefined> {
        let lastErrorMessage = "Unknown error"

        for (let attempt = 1; attempt <= this.maxReadAttempts; attempt += 1) {
            try {
                return await this.readFile(absolutePath)
            } catch (error) {
                if (isFileMissingError(error)) {
                    return undefined
                }

                lastErrorMessage = resolveUnknownErrorMessage(error)
                if (attempt >= this.maxReadAttempts) {
                    break
                }

                await sleepFor(this.retryBackoffMs)
            }
        }

        throw new AstIncrementalDiffScannerError(
            AST_INCREMENTAL_DIFF_SCANNER_ERROR_CODE.FILE_READ_FAILED,
            {
                filePath,
                causeMessage: lastErrorMessage,
            },
        )
    }

    /**
     * Resolves cached entry and evicts expired one when required.
     *
     * @param cacheKey Stable cache key.
     * @param nowUnixMs Current unix timestamp in milliseconds.
     * @returns Alive cache entry or undefined.
     */
    private resolveCachedEntry(
        cacheKey: string,
        nowUnixMs: number,
    ): IAstIncrementalDiffScannerCacheEntry | undefined {
        const entry = this.cache.get(cacheKey)
        if (entry === undefined) {
            return undefined
        }

        if (entry.expiresAtUnixMs > nowUnixMs) {
            return entry
        }

        this.cache.delete(cacheKey)
        return undefined
    }

    /**
     * Persists one cache entry and enforces bounded insertion order.
     *
     * @param cacheKey Stable cache key.
     * @param entry Cache entry payload.
     */
    private persistCacheEntry(
        cacheKey: string,
        entry: IAstIncrementalDiffScannerCacheEntry,
    ): void {
        if (this.cache.size >= this.maxCacheEntries && this.cache.has(cacheKey) === false) {
            const firstKey = this.cache.keys().next().value
            if (typeof firstKey === "string") {
                this.cache.delete(firstKey)
            }
        }

        this.cache.set(cacheKey, entry)
    }

    /**
     * Reports one progress update and wraps callback failures.
     *
     * @param scanId Active scan identifier.
     * @param callback Optional progress callback.
     * @param processedFiles Number of processed changed files.
     * @param totalFiles Total changed files planned for scan.
     */
    private async reportProgress(
        scanId: string,
        callback: IAstIncrementalDiffScannerProgressCallback | undefined,
        processedFiles: number,
        totalFiles: number,
    ): Promise<void> {
        if (callback === undefined) {
            return
        }

        try {
            await callback({
                processedFiles,
                totalFiles,
            })
        } catch (error) {
            throw new AstIncrementalDiffScannerError(
                AST_INCREMENTAL_DIFF_SCANNER_ERROR_CODE.PROGRESS_CALLBACK_FAILED,
                {
                    scanId,
                    causeMessage: resolveUnknownErrorMessage(error),
                },
            )
        }
    }

    /**
     * Throws typed cancellation error when scan was cancelled.
     *
     * @param scanId Scan identifier.
     */
    private assertScanActive(scanId: string): void {
        if (!this.cancelledScanIds.has(scanId)) {
            return
        }

        throw new AstIncrementalDiffScannerError(
            AST_INCREMENTAL_DIFF_SCANNER_ERROR_CODE.SCAN_CANCELLED,
            {
                scanId,
            },
        )
    }
}

/**
 * Resolves optional value with lazy fallback.
 *
 * @param value Optional value.
 * @param fallback Fallback factory.
 * @returns Resolved value.
 */
function resolveOptionalValue<T>(
    value: T | undefined,
    fallback: () => T,
): T {
    if (value !== undefined) {
        return value
    }

    return fallback()
}

/**
 * Validates repository path resolver callback.
 *
 * @param resolveRepositoryPath Candidate callback.
 * @returns Valid resolver callback.
 */
function validateResolveRepositoryPath(
    resolveRepositoryPath: AstIncrementalDiffScannerResolveRepositoryPath,
): AstIncrementalDiffScannerResolveRepositoryPath {
    if (typeof resolveRepositoryPath === "function") {
        return resolveRepositoryPath
    }

    throw new AstIncrementalDiffScannerError(
        AST_INCREMENTAL_DIFF_SCANNER_ERROR_CODE.INVALID_RESOLVE_REPOSITORY_PATH,
    )
}

/**
 * Validates changed file paths resolver callback.
 *
 * @param resolveChangedFilePaths Candidate callback.
 * @returns Valid changed-file resolver callback.
 */
function validateResolveChangedFilePaths(
    resolveChangedFilePaths: AstIncrementalDiffScannerResolveChangedFilePaths,
): AstIncrementalDiffScannerResolveChangedFilePaths {
    if (typeof resolveChangedFilePaths === "function") {
        return resolveChangedFilePaths
    }

    throw new AstIncrementalDiffScannerError(
        AST_INCREMENTAL_DIFF_SCANNER_ERROR_CODE.INVALID_RESOLVE_CHANGED_FILE_PATHS,
    )
}

/**
 * Validates source file read callback.
 *
 * @param readFileCallback Candidate callback.
 * @returns Valid read callback.
 */
function validateReadFile(
    readFileCallback: AstIncrementalDiffScannerReadFile,
): AstIncrementalDiffScannerReadFile {
    if (typeof readFileCallback === "function") {
        return readFileCallback
    }

    throw new AstIncrementalDiffScannerError(
        AST_INCREMENTAL_DIFF_SCANNER_ERROR_CODE.INVALID_READ_FILE,
    )
}

/**
 * Validates scan id generator callback.
 *
 * @param generateScanId Candidate callback.
 * @returns Valid scan id generator callback.
 */
function validateGenerateScanId(
    generateScanId: AstIncrementalDiffScannerGenerateScanId,
): AstIncrementalDiffScannerGenerateScanId {
    if (typeof generateScanId === "function") {
        return generateScanId
    }

    throw new AstIncrementalDiffScannerError(
        AST_INCREMENTAL_DIFF_SCANNER_ERROR_CODE.INVALID_GENERATE_SCAN_ID,
    )
}

/**
 * Validates git command executor callback.
 *
 * @param executeGit Candidate callback.
 * @returns Valid git command executor callback.
 */
function validateExecuteGit(
    executeGit: AstIncrementalDiffScannerExecuteGit,
): AstIncrementalDiffScannerExecuteGit {
    if (typeof executeGit === "function") {
        return executeGit
    }

    throw new AstIncrementalDiffScannerError(
        AST_INCREMENTAL_DIFF_SCANNER_ERROR_CODE.INVALID_EXECUTE_GIT,
    )
}

/**
 * Validates required positive integer config values.
 *
 * @param value Candidate numeric value.
 * @param code Typed error code for invalid value.
 * @returns Valid positive integer value.
 */
function validatePositiveInteger(
    value: number,
    code:
        | typeof AST_INCREMENTAL_DIFF_SCANNER_ERROR_CODE.INVALID_MAX_READ_ATTEMPTS
        | typeof AST_INCREMENTAL_DIFF_SCANNER_ERROR_CODE.INVALID_RETRY_BACKOFF_MS
        | typeof AST_INCREMENTAL_DIFF_SCANNER_ERROR_CODE.INVALID_CACHE_TTL_MS
        | typeof AST_INCREMENTAL_DIFF_SCANNER_ERROR_CODE.INVALID_MAX_CACHE_ENTRIES,
): number {
    if (Number.isSafeInteger(value) && value > 0) {
        return value
    }

    throw new AstIncrementalDiffScannerError(code, {
        value,
    })
}

/**
 * Validates repository identifier.
 *
 * @param repositoryId Raw repository identifier.
 * @returns Normalized repository identifier.
 */
function normalizeRepositoryId(repositoryId: string): string {
    const normalizedRepositoryId = repositoryId.trim()
    if (normalizedRepositoryId.length > 0) {
        return normalizedRepositoryId
    }

    throw new AstIncrementalDiffScannerError(
        AST_INCREMENTAL_DIFF_SCANNER_ERROR_CODE.INVALID_REPOSITORY_ID,
        {
            repositoryId,
        },
    )
}

/**
 * Validates ref input.
 *
 * @param ref Raw ref input.
 * @returns Normalized ref.
 */
function normalizeRef(ref: string): string {
    const normalizedRef = ref.trim()
    if (normalizedRef.length > 0) {
        return normalizedRef
    }

    throw new AstIncrementalDiffScannerError(
        AST_INCREMENTAL_DIFF_SCANNER_ERROR_CODE.INVALID_REF,
        {
            ref,
        },
    )
}

/**
 * Validates generated scan identifier.
 *
 * @param scanId Raw scan identifier.
 * @returns Normalized scan identifier.
 */
function normalizeScanId(scanId: string): string {
    const normalizedScanId = scanId.trim()
    if (normalizedScanId.length > 0) {
        return normalizedScanId
    }

    throw new AstIncrementalDiffScannerError(
        AST_INCREMENTAL_DIFF_SCANNER_ERROR_CODE.INVALID_GENERATE_SCAN_ID,
    )
}

/**
 * Validates and normalizes repository path.
 *
 * @param repositoryPath Raw repository path.
 * @returns Canonical absolute repository path.
 */
function normalizeRepositoryPath(repositoryPath: unknown): string {
    if (typeof repositoryPath !== "string") {
        throw new AstIncrementalDiffScannerError(
            AST_INCREMENTAL_DIFF_SCANNER_ERROR_CODE.INVALID_REPOSITORY_PATH,
        )
    }

    const normalizedRepositoryPath = repositoryPath.trim()
    if (normalizedRepositoryPath.length > 0) {
        return resolve(normalizedRepositoryPath)
    }

    throw new AstIncrementalDiffScannerError(
        AST_INCREMENTAL_DIFF_SCANNER_ERROR_CODE.INVALID_REPOSITORY_PATH,
        {
            repositoryPath,
        },
    )
}

/**
 * Normalizes changed file paths, drops empty rows, and deduplicates values.
 *
 * @param changedFilePaths Raw changed file paths.
 * @returns Deterministic normalized changed file paths.
 */
function normalizeChangedFilePaths(changedFilePaths: readonly string[]): readonly string[] {
    const normalizedChangedFilePaths: string[] = []
    const seen = new Set<string>()

    for (const changedFilePath of changedFilePaths) {
        const trimmed = changedFilePath.trim()
        if (trimmed.length === 0) {
            continue
        }

        const normalized = normalizeChangedFilePath(trimmed)
        if (seen.has(normalized)) {
            continue
        }

        seen.add(normalized)
        normalizedChangedFilePaths.push(normalized)
    }

    normalizedChangedFilePaths.sort((left, right) => left.localeCompare(right))
    return normalizedChangedFilePaths
}

/**
 * Normalizes one changed file path.
 *
 * @param changedFilePath Raw changed file path.
 * @returns Normalized repository-relative file path.
 */
function normalizeChangedFilePath(changedFilePath: string): string {
    const pathCandidate = changedFilePath.replace(/\\/gu, "/")

    try {
        return FilePath.create(pathCandidate).toString()
    } catch {
        throw new AstIncrementalDiffScannerError(
            AST_INCREMENTAL_DIFF_SCANNER_ERROR_CODE.INVALID_CHANGED_FILE_PATH,
            {
                filePath: changedFilePath,
            },
        )
    }
}

/**
 * Builds stable cache key for incremental AST artifacts.
 *
 * @param repositoryId Normalized repository identifier.
 * @param ref Normalized ref.
 * @param filePath Normalized repository-relative file path.
 * @returns Stable cache key.
 */
function resolveCacheKey(repositoryId: string, ref: string, filePath: string): string {
    return `IncrementalAst::${repositoryId}::${ref}::${filePath}`
}

/**
 * Merges one file payload into language stats map.
 *
 * @param languageStats Mutable language stats map.
 * @param language Source file language.
 * @param loc Source file LOC.
 */
function mergeLanguageStats(
    languageStats: Map<SupportedLanguage, {fileCount: number; loc: number}>,
    language: SupportedLanguage,
    loc: number,
): void {
    const existing = languageStats.get(language)
    if (existing === undefined) {
        languageStats.set(language, {
            fileCount: 1,
            loc,
        })
        return
    }

    languageStats.set(language, {
        fileCount: existing.fileCount + 1,
        loc: existing.loc + loc,
    })
}

/**
 * Builds deterministic scan result payload.
 *
 * @param params Result payload fields.
 * @returns Deterministic scan result.
 */
function buildScanResult(params: {
    readonly scanId: string
    readonly repositoryId: string
    readonly languageStats: Map<SupportedLanguage, {fileCount: number; loc: number}>
    readonly totalFiles: number
    readonly totalNodes: number
    readonly totalEdges: number
    readonly durationMs: number
    readonly completedAtIso: string
}): IScanResult {
    const languages = [...params.languageStats.entries()]
        .map(([language, stats]) => ({
            language: LANGUAGE_DISPLAY_NAMES[language],
            fileCount: stats.fileCount,
            loc: stats.loc,
        }))
        .sort((left, right) => left.language.localeCompare(right.language))

    return {
        scanId: params.scanId,
        repositoryId: params.repositoryId,
        totalFiles: params.totalFiles,
        totalNodes: params.totalNodes,
        totalEdges: params.totalEdges,
        languages,
        duration: params.durationMs,
        completedAt: params.completedAtIso,
    }
}

/**
 * Counts non-empty source lines.
 *
 * @param sourceCode Source code text.
 * @returns Non-empty line count.
 */
function countLoc(sourceCode: string): number {
    if (sourceCode.trim().length === 0) {
        return 0
    }

    return sourceCode
        .split(/\r?\n/gu)
        .map((line) => line.trim())
        .filter((line) => line.length > 0).length
}

/**
 * Counts changed AST-like nodes in one source file.
 *
 * @param sourceCode Source code text.
 * @param language Source language.
 * @returns Changed node count.
 */
function countChangedNodes(sourceCode: string, language: SupportedLanguage): number {
    if (sourceCode.trim().length === 0) {
        return 0
    }

    if (language === AST_LANGUAGE.PYTHON) {
        return (
            countMatches(sourceCode, /^\s*class\s+[A-Za-z0-9_]+/gmu) +
            countMatches(sourceCode, /^\s*def\s+[A-Za-z0-9_]+\s*\(/gmu)
        )
    }

    if (language === AST_LANGUAGE.GO) {
        return (
            countMatches(sourceCode, /\btype\s+[A-Za-z0-9_]+\s+(struct|interface)\b/gu) +
            countMatches(sourceCode, /\bfunc\s+(\([^)]+\)\s*)?[A-Za-z0-9_]+\s*\(/gu)
        )
    }

    if (language === AST_LANGUAGE.JAVA || language === AST_LANGUAGE.KOTLIN) {
        return (
            countMatches(sourceCode, /\b(class|interface|object)\s+[A-Za-z0-9_]+/gu) +
            countMatches(
                sourceCode,
                /\b(public|private|protected|internal)?\s*(static\s+)?[A-Za-z0-9_<>, ?[\]]+\s+[A-Za-z0-9_]+\s*\(/gu,
            )
        )
    }

    if (language === AST_LANGUAGE.RUBY) {
        return (
            countMatches(sourceCode, /^\s*class\s+[A-Za-z0-9_:]+/gmu) +
            countMatches(sourceCode, /^\s*module\s+[A-Za-z0-9_:]+/gmu) +
            countMatches(sourceCode, /^\s*def\s+[A-Za-z0-9_?!]+/gmu)
        )
    }

    if (language === AST_LANGUAGE.RUST) {
        return (
            countMatches(sourceCode, /\b(struct|trait|enum)\s+[A-Za-z0-9_]+/gu) +
            countMatches(sourceCode, /\bfn\s+[A-Za-z0-9_]+\s*\(/gu)
        )
    }

    if (language === AST_LANGUAGE.PHP) {
        return (
            countMatches(sourceCode, /\b(class|interface|trait)\s+[A-Za-z0-9_]+/gu) +
            countMatches(sourceCode, /\bfunction\s+[A-Za-z0-9_]+\s*\(/gu)
        )
    }

    if (language === AST_LANGUAGE.CSHARP) {
        return (
            countMatches(
                sourceCode,
                /\b(class|interface|record|struct)\s+[A-Za-z0-9_]+/gu,
            ) +
            countMatches(
                sourceCode,
                /\b(public|private|protected|internal)?\s*(static\s+)?[A-Za-z0-9_<>, ?[\]]+\s+[A-Za-z0-9_]+\s*\(/gu,
            )
        )
    }

    return (
        countMatches(sourceCode, /\b(class|interface|type)\s+[A-Za-z0-9_]+/gu) +
        countMatches(sourceCode, /\b(function|const|let|var)\s+[A-Za-z0-9_]+/gu)
    )
}

/**
 * Counts import-like dependency edges from source text.
 *
 * @param sourceCode Source code text.
 * @param language Source language.
 * @returns Estimated dependency edge count.
 */
function countDependencyEdges(
    sourceCode: string,
    language: SupportedLanguage,
): number {
    if (language === AST_LANGUAGE.PYTHON) {
        return (
            countMatches(sourceCode, /^\s*import\s+[A-Za-z0-9_.]+/gmu) +
            countMatches(sourceCode, /^\s*from\s+[A-Za-z0-9_.]+\s+import\s+/gmu)
        )
    }

    if (language === AST_LANGUAGE.GO) {
        return countMatches(sourceCode, /\bimport\s*(\(|")/gu)
    }

    if (language === AST_LANGUAGE.JAVA) {
        return countMatches(sourceCode, /^\s*import\s+[A-Za-z0-9_.]+\s*;/gmu)
    }

    return (
        countMatches(sourceCode, /\bimport\s+[^;]+from\s+["'][^"']+["']/gu) +
        countMatches(sourceCode, /\brequire\(\s*["'][^"']+["']\s*\)/gu)
    )
}

/**
 * Counts regexp matches in source text.
 *
 * @param sourceCode Source code text.
 * @param pattern Regexp pattern.
 * @returns Match count.
 */
function countMatches(sourceCode: string, pattern: RegExp): number {
    const matches = sourceCode.match(pattern)
    return matches?.length ?? 0
}

/**
 * Checks whether error payload describes missing file.
 *
 * @param error Unknown error payload.
 * @returns True when payload is ENOENT-like read failure.
 */
function isFileMissingError(error: unknown): boolean {
    if (typeof error !== "object" || error === null || !("code" in error)) {
        return false
    }

    return error.code === "ENOENT"
}

/**
 * Default repository path resolver.
 *
 * @param repositoryId Repository identifier.
 * @returns Repository identifier interpreted as local path.
 */
function defaultResolveRepositoryPath(repositoryId: string): string {
    return repositoryId
}

/**
 * Default changed-files resolver using `git diff --name-only`.
 *
 * @param repositoryPath Local repository path.
 * @param repositoryId Repository identifier.
 * @param ref Branch, commit, or ref-range.
 * @param executeGit Git command executor callback.
 * @returns Changed file paths returned by git.
 */
async function defaultResolveChangedFilePaths(
    repositoryPath: string,
    repositoryId: string,
    ref: string,
    executeGit: AstIncrementalDiffScannerExecuteGit,
): Promise<readonly string[]> {
    const diffSpec = resolveDiffSpec(ref)

    try {
        const stdout = await executeGit(
            "git",
            ["diff", "--name-only", "--diff-filter=ACMRTUXB", diffSpec],
            repositoryPath,
        )
        return stdout
            .split(/\r?\n/gu)
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
    } catch (error) {
        throw new AstIncrementalDiffScannerError(
            AST_INCREMENTAL_DIFF_SCANNER_ERROR_CODE.CHANGED_FILES_RESOLUTION_FAILED,
            {
                repositoryId,
                repositoryPath,
                ref,
                causeMessage: resolveUnknownErrorMessage(error),
            },
        )
    }
}

/**
 * Resolves one git diff spec from normalized ref input.
 *
 * @param ref Normalized ref input.
 * @returns Git diff ref specification.
 */
function resolveDiffSpec(ref: string): string {
    if (ref.includes("...") || ref.includes("..")) {
        return ref
    }

    return `${ref}^..${ref}`
}

/**
 * Default source file read implementation.
 *
 * @param absoluteFilePath Absolute source file path.
 * @returns Raw file buffer.
 */
async function defaultReadFile(absoluteFilePath: string): Promise<Buffer> {
    return readFile(absoluteFilePath)
}

/**
 * Default scan identifier generator.
 *
 * @returns UUID-like scan identifier.
 */
function defaultGenerateScanId(): string {
    return randomUUID()
}

/**
 * Executes one git command and returns stdout payload.
 *
 * @param command Executable command.
 * @param args Command arguments.
 * @param cwd Working directory.
 * @returns Command stdout payload.
 */
async function executeGitCommand(
    command: string,
    args: readonly string[],
    cwd: string,
): Promise<string> {
    return new Promise<string>((resolvePromise, reject) => {
        const child = spawn(command, args, {
            cwd,
            stdio: ["ignore", "pipe", "pipe"],
        })

        let stdout = ""
        let stderr = ""

        child.stdout.on("data", (chunk: unknown): void => {
            stdout += String(chunk)
        })

        child.stderr.on("data", (chunk: unknown): void => {
            stderr += String(chunk)
        })

        child.on("error", (error: Error): void => {
            reject(error)
        })

        child.on("close", (code: number | null): void => {
            if (code === 0) {
                resolvePromise(stdout)
                return
            }

            const message =
                stderr.trim().length > 0
                    ? stderr.trim()
                    : `Git command failed with exit code ${String(code ?? "unknown")}`
            reject(new Error(message))
        })
    })
}

/**
 * Sleeps for one duration in milliseconds.
 *
 * @param durationMs Sleep duration.
 * @returns Promise resolved after delay.
 */
function sleepFor(durationMs: number): Promise<void> {
    return new Promise((resolvePromise) => {
        setTimeout(resolvePromise, durationMs)
    })
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
