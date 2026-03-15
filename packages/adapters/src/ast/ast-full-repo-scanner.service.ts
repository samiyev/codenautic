import {randomUUID} from "node:crypto"
import {readFile, readdir} from "node:fs/promises"
import {join, relative, resolve} from "node:path"

import {
    AST_LANGUAGE,
    FilePath,
    type IRepositoryScanner,
    type IScanResult,
    type SupportedLanguage,
} from "@codenautic/core"

import {
    AST_FULL_REPO_SCANNER_ERROR_CODE,
    AstFullRepoScannerError,
} from "./ast-full-repo-scanner.error"
import {
    type IAstLanguageDetectionService,
    AstLanguageDetectionService,
} from "./ast-language-detection.service"

const DEFAULT_MAX_READ_ATTEMPTS = 2
const DEFAULT_RETRY_BACKOFF_MS = 25

const SKIPPED_DIRECTORY_NAMES: ReadonlySet<string> = new Set<string>([
    ".git",
    ".next",
    ".turbo",
    "build",
    "coverage",
    "dist",
    "node_modules",
    "out",
    "target",
    "vendor",
])

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

interface IAstFullRepoScannerSourceFile {
    readonly filePath: string
    readonly absolutePath: string
    readonly language: SupportedLanguage
}

interface IAstFullRepoScannerDirectoryEntry {
    readonly name: string
    readonly kind: "directory" | "file" | "other"
}

/**
 * Progress payload for full repository scanner callback.
 */
export interface IAstFullRepoScannerProgress {
    /**
     * Number of already processed files.
     */
    readonly processedFiles: number

    /**
     * Total number of files planned for scan.
     */
    readonly totalFiles: number
}

/**
 * Optional progress callback for full repository scanner.
 */
export type IAstFullRepoScannerProgressCallback = (
    progress: IAstFullRepoScannerProgress,
) => Promise<void> | void

/**
 * Repository path resolver callback.
 */
export type AstFullRepoScannerResolveRepositoryPath = (
    repositoryId: string,
    ref: string,
) => Promise<string> | string

/**
 * Directory listing callback.
 */
export type AstFullRepoScannerListDirectory = (
    directoryPath: string,
) => Promise<readonly IAstFullRepoScannerDirectoryEntry[]>

/**
 * Source file read callback.
 */
export type AstFullRepoScannerReadFile = (
    absoluteFilePath: string,
) => Promise<Buffer>

/**
 * Clock callback for deterministic duration metrics.
 */
export type AstFullRepoScannerNow = () => number

/**
 * Scan id generator callback.
 */
export type AstFullRepoScannerGenerateScanId = () => string

/**
 * Runtime options for AST full repository scanner.
 */
export interface IAstFullRepoScannerServiceOptions {
    /**
     * Optional repository path resolver callback.
     */
    readonly resolveRepositoryPath?: AstFullRepoScannerResolveRepositoryPath

    /**
     * Optional directory listing callback override.
     */
    readonly listDirectory?: AstFullRepoScannerListDirectory

    /**
     * Optional file read callback override.
     */
    readonly readFile?: AstFullRepoScannerReadFile

    /**
     * Optional language detection service override.
     */
    readonly languageDetectionService?: IAstLanguageDetectionService

    /**
     * Optional scan id generator callback.
     */
    readonly generateScanId?: AstFullRepoScannerGenerateScanId

    /**
     * Optional clock callback.
     */
    readonly now?: AstFullRepoScannerNow

    /**
     * Optional read attempts for recoverable failures.
     */
    readonly maxReadAttempts?: number

    /**
     * Optional retry backoff in milliseconds between read attempts.
     */
    readonly retryBackoffMs?: number
}

/**
 * Scans repository source files and builds aggregate `IScanResult`.
 */
export class AstFullRepoScannerService implements IRepositoryScanner {
    private readonly resolveRepositoryPath: AstFullRepoScannerResolveRepositoryPath
    private readonly listDirectory: AstFullRepoScannerListDirectory
    private readonly readFile: AstFullRepoScannerReadFile
    private readonly languageDetectionService: IAstLanguageDetectionService
    private readonly generateScanId: AstFullRepoScannerGenerateScanId
    private readonly now: AstFullRepoScannerNow
    private readonly maxReadAttempts: number
    private readonly retryBackoffMs: number
    private readonly cancelledScanIds = new Set<string>()

    /**
     * Creates AST full repository scanner service.
     *
     * @param options Optional runtime dependencies and settings.
     */
    public constructor(options: IAstFullRepoScannerServiceOptions = {}) {
        this.resolveRepositoryPath = validateResolveRepositoryPath(
            options.resolveRepositoryPath ?? defaultResolveRepositoryPath,
        )
        this.listDirectory = validateListDirectory(
            options.listDirectory ?? defaultListDirectory,
        )
        this.readFile = validateReadFile(options.readFile ?? defaultReadFile)
        this.languageDetectionService =
            options.languageDetectionService ?? new AstLanguageDetectionService()
        this.generateScanId = validateGenerateScanId(
            options.generateScanId ?? defaultGenerateScanId,
        )
        this.now = options.now ?? Date.now
        this.maxReadAttempts = validatePositiveInteger(
            options.maxReadAttempts ?? DEFAULT_MAX_READ_ATTEMPTS,
            AST_FULL_REPO_SCANNER_ERROR_CODE.INVALID_MAX_READ_ATTEMPTS,
        )
        this.retryBackoffMs = validatePositiveInteger(
            options.retryBackoffMs ?? DEFAULT_RETRY_BACKOFF_MS,
            AST_FULL_REPO_SCANNER_ERROR_CODE.INVALID_RETRY_BACKOFF_MS,
        )
    }

    /**
     * Runs full repository scan with language detection and progress reporting.
     *
     * @param repositoryId Repository identifier.
     * @param ref Branch or commit reference.
     * @param onProgress Optional scan progress callback.
     * @returns Scan result payload.
     */
    public async scanRepository(
        repositoryId: string,
        ref: string,
        onProgress?: IAstFullRepoScannerProgressCallback,
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
            const sourceFiles = await this.collectSourceFiles(
                normalizedRepositoryId,
                repositoryPath,
            )

            return await this.scanSourceFiles({
                scanId,
                repositoryId: normalizedRepositoryId,
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
     * Resolves repository path with typed error wrapping.
     *
     * @param repositoryId Normalized repository identifier.
     * @param ref Normalized branch or commit reference.
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
            if (error instanceof AstFullRepoScannerError) {
                throw error
            }

            throw new AstFullRepoScannerError(
                AST_FULL_REPO_SCANNER_ERROR_CODE.REPOSITORY_PATH_RESOLUTION_FAILED,
                {
                    repositoryId,
                    ref,
                    causeMessage: resolveUnknownErrorMessage(error),
                },
            )
        }
    }

    /**
     * Collects source files from repository while skipping vendor directories.
     *
     * @param repositoryId Normalized repository identifier.
     * @param repositoryPath Canonical repository path.
     * @returns Deterministic source file list.
     */
    private async collectSourceFiles(
        repositoryId: string,
        repositoryPath: string,
    ): Promise<readonly IAstFullRepoScannerSourceFile[]> {
        const directories = [repositoryPath]
        const sourceFiles: IAstFullRepoScannerSourceFile[] = []

        while (directories.length > 0) {
            const currentDirectory = directories.pop()
            if (currentDirectory === undefined) {
                continue
            }

            const entries = await this.listDirectoryOrThrow(
                repositoryId,
                currentDirectory,
            )
            for (const entry of entries) {
                if (entry.kind === "directory") {
                    if (shouldSkipDirectory(entry.name)) {
                        continue
                    }

                    directories.push(join(currentDirectory, entry.name))
                    continue
                }

                if (entry.kind !== "file") {
                    continue
                }

                const absolutePath = join(currentDirectory, entry.name)
                const filePath = resolveRepositoryRelativePath(
                    repositoryPath,
                    absolutePath,
                )
                const language = this.detectLanguage(filePath)
                if (language === undefined) {
                    continue
                }

                sourceFiles.push({
                    filePath,
                    absolutePath,
                    language,
                })
            }
        }

        sourceFiles.sort((left, right) => left.filePath.localeCompare(right.filePath))
        return sourceFiles
    }

    /**
     * Lists one directory with typed error wrapping.
     *
     * @param repositoryId Normalized repository identifier.
     * @param directoryPath Absolute directory path.
     * @returns Directory entries.
     */
    private async listDirectoryOrThrow(
        repositoryId: string,
        directoryPath: string,
    ): Promise<readonly IAstFullRepoScannerDirectoryEntry[]> {
        try {
            return await this.listDirectory(directoryPath)
        } catch (error) {
            throw new AstFullRepoScannerError(
                AST_FULL_REPO_SCANNER_ERROR_CODE.DIRECTORY_LIST_FAILED,
                {
                    repositoryId,
                    repositoryPath: directoryPath,
                    causeMessage: resolveUnknownErrorMessage(error),
                },
            )
        }
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
     * Scans collected source files and builds aggregate scan payload.
     *
     * @param params Scan execution parameters.
     * @returns Scan result payload.
     */
    private async scanSourceFiles(params: {
        readonly scanId: string
        readonly repositoryId: string
        readonly sourceFiles: readonly IAstFullRepoScannerSourceFile[]
        readonly startedAt: number
        readonly onProgress?: IAstFullRepoScannerProgressCallback
    }): Promise<IScanResult> {
        const languageStats = new Map<SupportedLanguage, {fileCount: number; loc: number}>()
        let processedFiles = 0
        let totalEdges = 0

        for (const sourceFile of params.sourceFiles) {
            this.assertScanActive(params.scanId)

            const sourceBuffer = await this.readSourceFileWithRetry(sourceFile)
            const sourceCode = sourceBuffer.toString("utf8")
            const loc = countLoc(sourceCode)
            const edges = countDependencyEdges(sourceCode, sourceFile.language)
            mergeLanguageStats(languageStats, sourceFile.language, loc)

            processedFiles += 1
            totalEdges += edges
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
            totalFiles: params.sourceFiles.length,
            totalEdges,
            durationMs: Math.max(0, this.now() - params.startedAt),
            completedAtIso: new Date(this.now()).toISOString(),
        })
    }

    /**
     * Reads one source file with bounded retry policy.
     *
     * @param sourceFile Source file metadata.
     * @returns Raw file buffer.
     */
    private async readSourceFileWithRetry(
        sourceFile: IAstFullRepoScannerSourceFile,
    ): Promise<Buffer> {
        let lastErrorMessage = "Unknown error"

        for (let attempt = 1; attempt <= this.maxReadAttempts; attempt += 1) {
            try {
                return await this.readFile(sourceFile.absolutePath)
            } catch (error) {
                lastErrorMessage = resolveUnknownErrorMessage(error)
                if (attempt >= this.maxReadAttempts) {
                    break
                }

                await sleepFor(this.retryBackoffMs)
            }
        }

        throw new AstFullRepoScannerError(
            AST_FULL_REPO_SCANNER_ERROR_CODE.FILE_READ_FAILED,
            {
                filePath: sourceFile.filePath,
                causeMessage: lastErrorMessage,
            },
        )
    }

    /**
     * Reports one progress update and wraps callback failures.
     *
     * @param scanId Active scan identifier.
     * @param callback Optional progress callback.
     * @param processedFiles Number of processed files.
     * @param totalFiles Total files.
     */
    private async reportProgress(
        scanId: string,
        callback: IAstFullRepoScannerProgressCallback | undefined,
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
            throw new AstFullRepoScannerError(
                AST_FULL_REPO_SCANNER_ERROR_CODE.PROGRESS_CALLBACK_FAILED,
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

        throw new AstFullRepoScannerError(
            AST_FULL_REPO_SCANNER_ERROR_CODE.SCAN_CANCELLED,
            {scanId},
        )
    }
}

/**
 * Validates repository path resolver callback.
 *
 * @param resolveRepositoryPath Candidate callback.
 * @returns Valid resolver callback.
 */
function validateResolveRepositoryPath(
    resolveRepositoryPath: AstFullRepoScannerResolveRepositoryPath,
): AstFullRepoScannerResolveRepositoryPath {
    if (typeof resolveRepositoryPath === "function") {
        return resolveRepositoryPath
    }

    throw new AstFullRepoScannerError(
        AST_FULL_REPO_SCANNER_ERROR_CODE.INVALID_RESOLVE_REPOSITORY_PATH,
    )
}

/**
 * Validates directory listing callback.
 *
 * @param listDirectory Candidate callback.
 * @returns Valid directory listing callback.
 */
function validateListDirectory(
    listDirectory: AstFullRepoScannerListDirectory,
): AstFullRepoScannerListDirectory {
    if (typeof listDirectory === "function") {
        return listDirectory
    }

    throw new AstFullRepoScannerError(
        AST_FULL_REPO_SCANNER_ERROR_CODE.INVALID_LIST_DIRECTORY,
    )
}

/**
 * Validates source file read callback.
 *
 * @param readFileCallback Candidate callback.
 * @returns Valid source file read callback.
 */
function validateReadFile(
    readFileCallback: AstFullRepoScannerReadFile,
): AstFullRepoScannerReadFile {
    if (typeof readFileCallback === "function") {
        return readFileCallback
    }

    throw new AstFullRepoScannerError(
        AST_FULL_REPO_SCANNER_ERROR_CODE.INVALID_READ_FILE,
    )
}

/**
 * Validates scan id generator callback.
 *
 * @param generateScanId Candidate callback.
 * @returns Valid scan id generator callback.
 */
function validateGenerateScanId(
    generateScanId: AstFullRepoScannerGenerateScanId,
): AstFullRepoScannerGenerateScanId {
    if (typeof generateScanId === "function") {
        return generateScanId
    }

    throw new AstFullRepoScannerError(
        AST_FULL_REPO_SCANNER_ERROR_CODE.INVALID_GENERATE_SCAN_ID,
    )
}

/**
 * Validates required positive integer values.
 *
 * @param value Candidate numeric value.
 * @param code Typed error code for invalid values.
 * @returns Valid positive integer.
 */
function validatePositiveInteger(
    value: number,
    code:
        | typeof AST_FULL_REPO_SCANNER_ERROR_CODE.INVALID_MAX_READ_ATTEMPTS
        | typeof AST_FULL_REPO_SCANNER_ERROR_CODE.INVALID_RETRY_BACKOFF_MS,
): number {
    if (Number.isSafeInteger(value) && value > 0) {
        return value
    }

    throw new AstFullRepoScannerError(code, {value})
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

    throw new AstFullRepoScannerError(
        AST_FULL_REPO_SCANNER_ERROR_CODE.INVALID_REPOSITORY_ID,
        {repositoryId},
    )
}

/**
 * Validates branch or commit reference.
 *
 * @param ref Raw branch or commit reference.
 * @returns Normalized reference.
 */
function normalizeRef(ref: string): string {
    const normalizedRef = ref.trim()
    if (normalizedRef.length > 0) {
        return normalizedRef
    }

    throw new AstFullRepoScannerError(
        AST_FULL_REPO_SCANNER_ERROR_CODE.INVALID_REF,
        {ref},
    )
}

/**
 * Validates generated scan identifier.
 *
 * @param scanId Raw generated scan id.
 * @returns Normalized scan id.
 */
function normalizeScanId(scanId: string): string {
    const normalizedScanId = scanId.trim()
    if (normalizedScanId.length > 0) {
        return normalizedScanId
    }

    throw new AstFullRepoScannerError(
        AST_FULL_REPO_SCANNER_ERROR_CODE.INVALID_GENERATE_SCAN_ID,
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
        throw new AstFullRepoScannerError(
            AST_FULL_REPO_SCANNER_ERROR_CODE.INVALID_REPOSITORY_PATH,
        )
    }

    const normalizedRepositoryPath = repositoryPath.trim()
    if (normalizedRepositoryPath.length > 0) {
        return resolve(normalizedRepositoryPath)
    }

    throw new AstFullRepoScannerError(
        AST_FULL_REPO_SCANNER_ERROR_CODE.INVALID_REPOSITORY_PATH,
        {repositoryPath},
    )
}

/**
 * Resolves repository-relative file path from absolute file path.
 *
 * @param repositoryPath Canonical repository path.
 * @param absoluteFilePath Absolute file path.
 * @returns Normalized repository-relative path.
 */
function resolveRepositoryRelativePath(
    repositoryPath: string,
    absoluteFilePath: string,
): string {
    const relativeFilePath = relative(repositoryPath, absoluteFilePath)
    const normalizedRelativeFilePath = relativeFilePath.replace(/\\/gu, "/")
    return FilePath.create(normalizedRelativeFilePath).toString()
}

/**
 * Checks whether directory should be skipped during traversal.
 *
 * @param directoryName Raw directory name.
 * @returns True when directory is excluded.
 */
function shouldSkipDirectory(directoryName: string): boolean {
    return SKIPPED_DIRECTORY_NAMES.has(directoryName.toLowerCase())
}

/**
 * Merges one file LOC into language stats map.
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
        languageStats.set(language, {fileCount: 1, loc})
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
 * @param params Result parameters.
 * @returns Scan result.
 */
function buildScanResult(params: {
    readonly scanId: string
    readonly repositoryId: string
    readonly languageStats: Map<SupportedLanguage, {fileCount: number; loc: number}>
    readonly totalFiles: number
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
        totalNodes: params.totalFiles,
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
 * Default repository path resolver.
 *
 * @param repositoryId Repository identifier.
 * @returns Repository id interpreted as local path.
 */
function defaultResolveRepositoryPath(repositoryId: string): string {
    return repositoryId
}

/**
 * Default directory listing implementation.
 *
 * @param directoryPath Absolute directory path.
 * @returns Directory entries with normalized kind.
 */
async function defaultListDirectory(
    directoryPath: string,
): Promise<readonly IAstFullRepoScannerDirectoryEntry[]> {
    const entries = await readdir(directoryPath, {
        withFileTypes: true,
    })
    return entries.map((entry): IAstFullRepoScannerDirectoryEntry => {
        if (entry.isDirectory()) {
            return {name: entry.name, kind: "directory"}
        }

        if (entry.isFile()) {
            return {name: entry.name, kind: "file"}
        }

        return {name: entry.name, kind: "other"}
    })
}

/**
 * Default source file read implementation.
 *
 * @param absoluteFilePath Absolute file path.
 * @returns Raw file buffer.
 */
async function defaultReadFile(absoluteFilePath: string): Promise<Buffer> {
    return readFile(absoluteFilePath)
}

/**
 * Default scan identifier generator.
 *
 * @returns Stable UUID-like scan id.
 */
function defaultGenerateScanId(): string {
    return randomUUID()
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
