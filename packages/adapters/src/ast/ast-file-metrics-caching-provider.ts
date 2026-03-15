import {spawn} from "node:child_process"
import {resolve} from "node:path"

import {
    FilePath,
    type IFileMetricsDTO,
    type IFileMetricsProvider,
} from "@codenautic/core"

import {
    AST_FILE_METRICS_CACHING_ERROR_CODE,
    AstFileMetricsCachingError,
} from "./ast-file-metrics-caching.error"
import {AstFileMetricsProvider} from "./ast-file-metrics-provider"

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000
const DEFAULT_MAX_CACHE_ENTRIES = 2_000

interface IAstFileMetricsCacheEntry {
    readonly value: readonly IFileMetricsDTO[]
    readonly repositoryId: string
    readonly commitSha: string
    readonly cachedAtUnixMs: number
    readonly expiresAtUnixMs: number
}

/**
 * Clock callback for deterministic cache behavior.
 */
export type AstFileMetricsCachingNow = () => number

/**
 * Repository path resolver callback.
 */
export type AstFileMetricsCachingResolveRepositoryPath = (
    repositoryId: string,
) => Promise<string> | string

/**
 * Commit sha resolver callback.
 */
export type AstFileMetricsCachingResolveCommitSha = (
    repositoryPath: string,
    repositoryId: string,
) => Promise<string> | string

/**
 * Git command executor callback.
 */
export type AstFileMetricsCachingExecuteGit = (
    command: string,
    args: readonly string[],
    cwd: string,
) => Promise<string>

/**
 * Runtime options for AST file metrics caching provider.
 */
export interface IAstFileMetricsCachingProviderOptions {
    /**
     * Optional source provider used on cache misses.
     */
    readonly sourceProvider?: IFileMetricsProvider

    /**
     * Optional repository id -> local path resolver.
     */
    readonly resolveRepositoryPath?: AstFileMetricsCachingResolveRepositoryPath

    /**
     * Optional commit sha resolver callback.
     */
    readonly resolveCommitSha?: AstFileMetricsCachingResolveCommitSha

    /**
     * Optional git command executor for default commit resolver.
     */
    readonly executeGit?: AstFileMetricsCachingExecuteGit

    /**
     * Optional default cache TTL in milliseconds.
     */
    readonly defaultCacheTtlMs?: number

    /**
     * Optional maximum cache entries bound.
     */
    readonly maxCacheEntries?: number

    /**
     * Optional clock callback for deterministic tests.
     */
    readonly now?: AstFileMetricsCachingNow
}

/**
 * Caching wrapper for file metrics with key `repositoryId + commitSha + filePaths`.
 */
export class AstFileMetricsCachingProvider implements IFileMetricsProvider {
    private readonly sourceProvider: IFileMetricsProvider
    private readonly resolveRepositoryPath: AstFileMetricsCachingResolveRepositoryPath
    private readonly resolveCommitSha: AstFileMetricsCachingResolveCommitSha
    private readonly defaultCacheTtlMs: number
    private readonly maxCacheEntries: number
    private readonly now: AstFileMetricsCachingNow
    private readonly cache = new Map<string, IAstFileMetricsCacheEntry>()
    private readonly inFlightByKey = new Map<string, Promise<readonly IFileMetricsDTO[]>>()
    private readonly latestCommitByRepository = new Map<string, string>()

    /**
     * Creates AST file metrics caching provider.
     *
     * @param options Optional runtime dependencies and settings.
     */
    public constructor(options: IAstFileMetricsCachingProviderOptions = {}) {
        this.sourceProvider = validateSourceProvider(
            options.sourceProvider ?? new AstFileMetricsProvider(),
        )
        this.resolveRepositoryPath = validateResolveRepositoryPath(
            options.resolveRepositoryPath ?? defaultResolveRepositoryPath,
        )
        const executeGit = validateExecuteGit(options.executeGit ?? executeGitCommand)
        this.resolveCommitSha = validateResolveCommitSha(
            options.resolveCommitSha ??
                ((repositoryPath, repositoryId) =>
                    defaultResolveCommitSha(repositoryPath, repositoryId, executeGit)),
        )
        this.defaultCacheTtlMs = validatePositiveInteger(
            options.defaultCacheTtlMs ?? DEFAULT_CACHE_TTL_MS,
            AST_FILE_METRICS_CACHING_ERROR_CODE.INVALID_CACHE_TTL_MS,
        )
        this.maxCacheEntries = validatePositiveInteger(
            options.maxCacheEntries ?? DEFAULT_MAX_CACHE_ENTRIES,
            AST_FILE_METRICS_CACHING_ERROR_CODE.INVALID_MAX_CACHE_ENTRIES,
        )
        this.now = options.now ?? Date.now
    }

    /**
     * Returns cached or fresh file metrics for repository file paths.
     *
     * @param repositoryId Repository identifier.
     * @param filePaths Repository-relative file paths.
     * @returns File metrics in the same order as input.
     */
    public async getMetrics(
        repositoryId: string,
        filePaths: readonly string[],
    ): Promise<readonly IFileMetricsDTO[]> {
        const normalizedRepositoryId = normalizeRepositoryId(repositoryId)
        const normalizedFilePaths = normalizeFilePaths(filePaths)
        if (normalizedFilePaths.length === 0) {
            return []
        }

        const repositoryPath = await this.resolveRepositoryPathOrThrow(normalizedRepositoryId)
        const commitSha = await this.resolveCommitShaOrThrow(
            repositoryPath,
            normalizedRepositoryId,
        )
        this.invalidateOnCommitChange(normalizedRepositoryId, commitSha)

        const cacheKey = resolveCacheKey(
            normalizedRepositoryId,
            commitSha,
            normalizedFilePaths,
        )
        const now = this.now()
        const cached = this.resolveCachedEntry(cacheKey, now)
        if (cached !== undefined) {
            return cached.value
        }

        const inFlight = this.inFlightByKey.get(cacheKey)
        if (inFlight !== undefined) {
            return inFlight
        }

        const fetchPromise = this.fetchAndCache({
            cacheKey,
            repositoryId: normalizedRepositoryId,
            commitSha,
            filePaths: normalizedFilePaths,
            cachedAtUnixMs: now,
        })
        this.inFlightByKey.set(cacheKey, fetchPromise)

        try {
            return await fetchPromise
        } finally {
            this.inFlightByKey.delete(cacheKey)
        }
    }

    /**
     * Invalidates cached metrics for one repository.
     *
     * @param repositoryId Repository identifier.
     * @returns Number of removed entries.
     */
    public invalidateRepository(repositoryId: string): number {
        const normalizedRepositoryId = normalizeRepositoryId(repositoryId)
        this.latestCommitByRepository.delete(normalizedRepositoryId)

        let removed = 0
        for (const [cacheKey, entry] of this.cache.entries()) {
            if (entry.repositoryId === normalizedRepositoryId) {
                this.cache.delete(cacheKey)
                removed += 1
            }
        }

        return removed
    }

    /**
     * Clears all cached and in-flight entries.
     */
    public clear(): void {
        this.cache.clear()
        this.inFlightByKey.clear()
        this.latestCommitByRepository.clear()
    }

    /**
     * Resolves repository path with typed failure wrapping.
     *
     * @param repositoryId Normalized repository identifier.
     * @returns Canonical absolute repository path.
     */
    private async resolveRepositoryPathOrThrow(repositoryId: string): Promise<string> {
        try {
            const repositoryPath = await this.resolveRepositoryPath(repositoryId)
            return normalizeRepositoryPath(repositoryPath, repositoryId)
        } catch (error) {
            if (error instanceof AstFileMetricsCachingError) {
                throw error
            }

            throw new AstFileMetricsCachingError(
                AST_FILE_METRICS_CACHING_ERROR_CODE.REPOSITORY_PATH_RESOLUTION_FAILED,
                {
                    repositoryId,
                    causeMessage: resolveUnknownErrorMessage(error),
                },
            )
        }
    }

    /**
     * Resolves commit sha with typed failure wrapping.
     *
     * @param repositoryPath Canonical absolute repository path.
     * @param repositoryId Normalized repository identifier.
     * @returns Normalized commit sha.
     */
    private async resolveCommitShaOrThrow(
        repositoryPath: string,
        repositoryId: string,
    ): Promise<string> {
        try {
            const commitSha = await this.resolveCommitSha(repositoryPath, repositoryId)
            return normalizeCommitSha(commitSha)
        } catch (error) {
            if (error instanceof AstFileMetricsCachingError) {
                throw error
            }

            throw new AstFileMetricsCachingError(
                AST_FILE_METRICS_CACHING_ERROR_CODE.COMMIT_SHA_RESOLUTION_FAILED,
                {
                    repositoryId,
                    repositoryPath,
                    causeMessage: resolveUnknownErrorMessage(error),
                },
            )
        }
    }

    /**
     * Invalidates repository cache when commit snapshot changes.
     *
     * @param repositoryId Normalized repository identifier.
     * @param commitSha Normalized commit sha.
     */
    private invalidateOnCommitChange(repositoryId: string, commitSha: string): void {
        const previousCommitSha = this.latestCommitByRepository.get(repositoryId)
        if (previousCommitSha !== undefined && previousCommitSha !== commitSha) {
            void this.invalidateRepository(repositoryId)
        }

        this.latestCommitByRepository.set(repositoryId, commitSha)
    }

    /**
     * Resolves cached entry and evicts expired record when needed.
     *
     * @param cacheKey Stable cache key.
     * @param nowUnixMs Current unix timestamp.
     * @returns Cached entry when available and alive.
     */
    private resolveCachedEntry(
        cacheKey: string,
        nowUnixMs: number,
    ): IAstFileMetricsCacheEntry | undefined {
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
     * Fetches source metrics and persists cache entry.
     *
     * @param params Cache and source input.
     * @returns Fresh metrics payload.
     */
    private async fetchAndCache(params: {
        readonly cacheKey: string
        readonly repositoryId: string
        readonly commitSha: string
        readonly filePaths: readonly string[]
        readonly cachedAtUnixMs: number
    }): Promise<readonly IFileMetricsDTO[]> {
        try {
            const value = await this.sourceProvider.getMetrics(
                params.repositoryId,
                params.filePaths,
            )
            const entry: IAstFileMetricsCacheEntry = {
                value,
                repositoryId: params.repositoryId,
                commitSha: params.commitSha,
                cachedAtUnixMs: params.cachedAtUnixMs,
                expiresAtUnixMs: params.cachedAtUnixMs + this.defaultCacheTtlMs,
            }
            this.persistCacheEntry(params.cacheKey, entry)

            return value
        } catch (error) {
            throw new AstFileMetricsCachingError(
                AST_FILE_METRICS_CACHING_ERROR_CODE.SOURCE_PROVIDER_FAILED,
                {
                    repositoryId: params.repositoryId,
                    commitSha: params.commitSha,
                    causeMessage: resolveUnknownErrorMessage(error),
                },
            )
        }
    }

    /**
     * Persists one cache entry in bounded insertion-ordered map.
     *
     * @param cacheKey Stable cache key.
     * @param entry Cache entry payload.
     */
    private persistCacheEntry(cacheKey: string, entry: IAstFileMetricsCacheEntry): void {
        if (this.cache.size >= this.maxCacheEntries && this.cache.has(cacheKey) === false) {
            const firstKey = this.cache.keys().next().value
            if (typeof firstKey === "string") {
                this.cache.delete(firstKey)
            }
        }

        this.cache.set(cacheKey, entry)
    }
}

/**
 * Validates source provider contract.
 *
 * @param sourceProvider Candidate source provider.
 * @returns Valid source provider.
 */
function validateSourceProvider(sourceProvider: unknown): IFileMetricsProvider {
    if (isFileMetricsProvider(sourceProvider)) {
        return sourceProvider
    }

    throw new AstFileMetricsCachingError(
        AST_FILE_METRICS_CACHING_ERROR_CODE.INVALID_SOURCE_PROVIDER,
    )
}

/**
 * Checks whether candidate value matches file metrics provider contract.
 *
 * @param value Candidate provider value.
 * @returns True when value implements file metrics provider.
 */
function isFileMetricsProvider(value: unknown): value is IFileMetricsProvider {
    if (typeof value !== "object" || value === null || !("getMetrics" in value)) {
        return false
    }

    return typeof value.getMetrics === "function"
}

/**
 * Validates repository path resolver callback.
 *
 * @param resolveRepositoryPath Candidate callback.
 * @returns Valid resolver callback.
 */
function validateResolveRepositoryPath(
    resolveRepositoryPath: AstFileMetricsCachingResolveRepositoryPath,
): AstFileMetricsCachingResolveRepositoryPath {
    if (typeof resolveRepositoryPath === "function") {
        return resolveRepositoryPath
    }

    throw new AstFileMetricsCachingError(
        AST_FILE_METRICS_CACHING_ERROR_CODE.INVALID_RESOLVE_REPOSITORY_PATH,
    )
}

/**
 * Validates commit sha resolver callback.
 *
 * @param resolveCommitSha Candidate callback.
 * @returns Valid resolver callback.
 */
function validateResolveCommitSha(
    resolveCommitSha: AstFileMetricsCachingResolveCommitSha,
): AstFileMetricsCachingResolveCommitSha {
    if (typeof resolveCommitSha === "function") {
        return resolveCommitSha
    }

    throw new AstFileMetricsCachingError(
        AST_FILE_METRICS_CACHING_ERROR_CODE.INVALID_RESOLVE_COMMIT_SHA,
    )
}

/**
 * Validates git command executor callback.
 *
 * @param executeGit Candidate callback.
 * @returns Valid git command executor callback.
 */
function validateExecuteGit(
    executeGit: AstFileMetricsCachingExecuteGit,
): AstFileMetricsCachingExecuteGit {
    if (typeof executeGit === "function") {
        return executeGit
    }

    throw new AstFileMetricsCachingError(
        AST_FILE_METRICS_CACHING_ERROR_CODE.INVALID_EXECUTE_GIT,
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
        | typeof AST_FILE_METRICS_CACHING_ERROR_CODE.INVALID_CACHE_TTL_MS
        | typeof AST_FILE_METRICS_CACHING_ERROR_CODE.INVALID_MAX_CACHE_ENTRIES,
): number {
    if (Number.isSafeInteger(value) && value > 0) {
        return value
    }

    throw new AstFileMetricsCachingError(code, {value})
}

/**
 * Validates repository id.
 *
 * @param repositoryId Raw repository identifier.
 * @returns Normalized repository identifier.
 */
function normalizeRepositoryId(repositoryId: string): string {
    const normalizedRepositoryId = repositoryId.trim()
    if (normalizedRepositoryId.length > 0) {
        return normalizedRepositoryId
    }

    throw new AstFileMetricsCachingError(
        AST_FILE_METRICS_CACHING_ERROR_CODE.INVALID_REPOSITORY_ID,
        {
            repositoryId,
        },
    )
}

/**
 * Normalizes repository-relative file paths while preserving input order.
 *
 * @param filePaths Raw file paths.
 * @returns Normalized file paths.
 */
function normalizeFilePaths(filePaths: readonly string[]): readonly string[] {
    return filePaths.map((filePath) => normalizeFilePath(filePath))
}

/**
 * Normalizes one repository-relative file path.
 *
 * @param filePath Raw file path.
 * @returns Normalized file path.
 */
function normalizeFilePath(filePath: string): string {
    try {
        return FilePath.create(filePath).toString()
    } catch {
        throw new AstFileMetricsCachingError(
            AST_FILE_METRICS_CACHING_ERROR_CODE.INVALID_FILE_PATH,
            {
                filePath,
            },
        )
    }
}

/**
 * Normalizes resolved repository path.
 *
 * @param repositoryPath Raw resolved repository path.
 * @param repositoryId Normalized repository identifier.
 * @returns Canonical absolute repository path.
 */
function normalizeRepositoryPath(
    repositoryPath: unknown,
    repositoryId: string,
): string {
    if (typeof repositoryPath !== "string") {
        throw new AstFileMetricsCachingError(
            AST_FILE_METRICS_CACHING_ERROR_CODE.INVALID_REPOSITORY_PATH,
            {
                repositoryId,
            },
        )
    }

    const normalizedRepositoryPath = repositoryPath.trim()
    if (normalizedRepositoryPath.length === 0) {
        throw new AstFileMetricsCachingError(
            AST_FILE_METRICS_CACHING_ERROR_CODE.INVALID_REPOSITORY_PATH,
            {
                repositoryId,
                repositoryPath,
            },
        )
    }

    return resolve(normalizedRepositoryPath)
}

/**
 * Normalizes commit sha.
 *
 * @param commitSha Raw commit sha.
 * @returns Normalized lowercase commit sha.
 */
function normalizeCommitSha(commitSha: unknown): string {
    if (typeof commitSha !== "string") {
        throw new AstFileMetricsCachingError(
            AST_FILE_METRICS_CACHING_ERROR_CODE.INVALID_COMMIT_SHA,
            {
                commitSha: String(commitSha),
            },
        )
    }

    const normalizedCommitSha = commitSha.trim().toLowerCase()
    const isValidCommitSha = /^[0-9a-f]{7,64}$/u.test(normalizedCommitSha)
    if (isValidCommitSha) {
        return normalizedCommitSha
    }

    throw new AstFileMetricsCachingError(
        AST_FILE_METRICS_CACHING_ERROR_CODE.INVALID_COMMIT_SHA,
        {
            commitSha,
        },
    )
}

/**
 * Resolves stable deterministic cache key.
 *
 * @param repositoryId Normalized repository identifier.
 * @param commitSha Normalized commit sha.
 * @param filePaths Normalized file paths in request order.
 * @returns Stable cache key.
 */
function resolveCacheKey(
    repositoryId: string,
    commitSha: string,
    filePaths: readonly string[],
): string {
    const filePathSignature = filePaths
        .map((filePath) => `${filePath.length}:${filePath}`)
        .join("|")

    return `FileMetrics::${repositoryId}::${commitSha}::${filePathSignature}`
}

/**
 * Default repository path resolver.
 *
 * @param repositoryId Repository identifier.
 * @returns Repository identifier interpreted as local repository path.
 */
function defaultResolveRepositoryPath(repositoryId: string): string {
    return repositoryId
}

/**
 * Default commit sha resolver using `git rev-parse HEAD`.
 *
 * @param repositoryPath Local repository path.
 * @param repositoryId Repository identifier.
 * @param executeGit Git command executor callback.
 * @returns Resolved commit sha.
 */
async function defaultResolveCommitSha(
    repositoryPath: string,
    repositoryId: string,
    executeGit: AstFileMetricsCachingExecuteGit,
): Promise<string> {
    try {
        return await executeGit("git", ["rev-parse", "HEAD"], repositoryPath)
    } catch (error) {
        throw new AstFileMetricsCachingError(
            AST_FILE_METRICS_CACHING_ERROR_CODE.COMMIT_SHA_RESOLUTION_FAILED,
            {
                repositoryId,
                repositoryPath,
                causeMessage: resolveUnknownErrorMessage(error),
            },
        )
    }
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
