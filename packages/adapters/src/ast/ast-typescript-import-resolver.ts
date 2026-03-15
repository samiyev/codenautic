import {readdir, readFile} from "node:fs/promises"
import pathPosix from "node:path/posix"

import {FilePath} from "@codenautic/core"

import {
    AstBaseImportResolver,
    type AstBaseImportResolverShouldRetry,
    type IAstBaseImportResolverOptions,
    type IAstBaseImportResolverRetryPolicy,
    type IAstBaseNonRelativeImportResolutionInput,
} from "./ast-base-import-resolver"
import {
    AST_TYPESCRIPT_IMPORT_RESOLVER_ERROR_CODE,
    AstTypeScriptImportResolverError,
    type AstTypeScriptImportResolverErrorCode,
} from "./ast-typescript-import-resolver.error"

const DEFAULT_REPOSITORY_ROOT_PATH = "."
const DEFAULT_SOURCE_DIRECTORY_CANDIDATES = ["src"] as const
const DEFAULT_WORKSPACES_DIRECTORY = "packages"
const TS_CONFIG_FILE_NAME = "tsconfig.json"
const PACKAGE_MANIFEST_FILE_NAME = "package.json"
const EXPORT_RESOLUTION_DEPTH_LIMIT = 10
const EXPORT_CONDITION_ORDER = ["types", "import", "default", "require", "node"] as const

/**
 * Reads one UTF-8 file from file system.
 */
export type AstTypeScriptImportResolverReadFile = (filePath: string) => Promise<string>

/**
 * Reads one directory and returns direct child entry names.
 */
export type AstTypeScriptImportResolverReadDirectory = (
    directoryPath: string,
) => Promise<readonly string[]>

/**
 * Runtime options for TypeScript import resolver.
 */
export interface IAstTypeScriptImportResolverOptions extends IAstBaseImportResolverOptions {
    /**
     * Repository root path used to resolve config files from disk.
     */
    readonly repositoryRootPath?: string

    /**
     * Explicit package roots used for workspace package and tsconfig lookup.
     */
    readonly workspacePackageRoots?: readonly string[]

    /**
     * Optional custom file reader.
     */
    readonly readFile?: AstTypeScriptImportResolverReadFile

    /**
     * Optional custom directory reader.
     */
    readonly readDirectory?: AstTypeScriptImportResolverReadDirectory

    /**
     * Optional repository-level source directory candidates used by fallback resolution.
     */
    readonly sourceDirectoryCandidates?: readonly string[]
}

interface IAstTypeScriptConfigPayload {
    readonly compilerOptions?: unknown
}

interface IAstTypeScriptCompilerOptionsPayload {
    readonly baseUrl?: unknown
    readonly paths?: unknown
}

interface IAstTypeScriptPathMapping {
    readonly pattern: string
    readonly targetPatterns: readonly string[]
}

interface IAstTypeScriptConfigSnapshot {
    readonly filePath: string
    readonly baseDirectoryPath: string
    readonly baseUrlPath: string
    readonly pathMappings: readonly IAstTypeScriptPathMapping[]
}

interface IAstPackageManifestPayload {
    readonly name?: unknown
    readonly main?: unknown
    readonly exports?: unknown
}

interface IAstPackageExportsSnapshot {
    readonly rootTargets: readonly string[]
    readonly targetsByKey: Readonly<Record<string, readonly string[]>>
    readonly wildcardTargetsByPattern: Readonly<Record<string, readonly string[]>>
}

interface IAstPackageManifestSnapshot {
    readonly packageName: string | undefined
    readonly rootPath: string
    readonly mainEntry: string | undefined
    readonly exportsSnapshot: IAstPackageExportsSnapshot
}

interface IAstPackageSpecifier {
    readonly packageName: string
    readonly packageSubPath: string | undefined
}

/**
 * TypeScript/JavaScript import resolver based on tsconfig and package manifests.
 */
export class AstTypeScriptImportResolver extends AstBaseImportResolver {
    private readonly repositoryRootPath: string
    private readonly explicitWorkspacePackageRoots: readonly string[]
    private readonly hasExplicitWorkspacePackageRoots: boolean
    private readonly readFile: AstTypeScriptImportResolverReadFile
    private readonly readDirectory: AstTypeScriptImportResolverReadDirectory
    private readonly sourceDirectoryCandidates: readonly string[]
    private discoveredWorkspacePackageRootsPromise: Promise<readonly string[]> | undefined
    private tsConfigSnapshotsPromise: Promise<readonly IAstTypeScriptConfigSnapshot[]> | undefined
    private workspacePackageSnapshotsPromise: Promise<readonly IAstPackageManifestSnapshot[]> | undefined
    private readonly nodePackageSnapshotByPackageName = new Map<
        string,
        Promise<IAstPackageManifestSnapshot | null>
    >()

    /**
     * Creates TypeScript import resolver.
     *
     * @param options Optional runtime configuration.
     */
    public constructor(options: IAstTypeScriptImportResolverOptions = {}) {
        super(resolveBaseImportResolverOptions(options))

        this.repositoryRootPath = normalizeRepositoryRootPath(
            options.repositoryRootPath ?? DEFAULT_REPOSITORY_ROOT_PATH,
        )
        this.explicitWorkspacePackageRoots = normalizeWorkspacePackageRoots(
            options.workspacePackageRoots ?? [],
        )
        this.hasExplicitWorkspacePackageRoots = options.workspacePackageRoots !== undefined
        this.readFile = validateReadFile(options.readFile)
        this.readDirectory = validateReadDirectory(options.readDirectory)
        this.sourceDirectoryCandidates = normalizeSourceDirectoryCandidates(
            options.sourceDirectoryCandidates ?? DEFAULT_SOURCE_DIRECTORY_CANDIDATES,
        )
    }

    /**
     * Resolves candidate target paths for one non-relative TypeScript import.
     *
     * @param input Normalized non-relative import payload.
     * @returns Candidate target paths.
     */
    protected async resolveNonRelativeCandidates(
        input: IAstBaseNonRelativeImportResolutionInput,
    ): Promise<readonly string[]> {
        if (isNodeBuiltinImport(input.importSource)) {
            return []
        }

        const candidates = new Set<string>()
        const workspacePackageRoots = await this.resolveWorkspacePackageRoots()
        const tsConfigSnapshots = await this.getTsConfigSnapshots()
        const tsConfigCandidates = resolveTypeScriptPathCandidates(
            input.importSource,
            tsConfigSnapshots,
            input.fileExtensionCandidates,
        )
        addCandidates(candidates, tsConfigCandidates)

        const packageSpecifier = parsePackageSpecifier(input.importSource)
        if (packageSpecifier !== undefined) {
            const workspacePackageSnapshot = await this.findWorkspacePackageSnapshot(
                packageSpecifier.packageName,
            )
            if (workspacePackageSnapshot !== undefined) {
                addCandidates(
                    candidates,
                    resolvePackageManifestCandidates(
                        packageSpecifier,
                        workspacePackageSnapshot,
                        input.fileExtensionCandidates,
                    ),
                )
            }

            const nodePackageSnapshot = await this.getNodePackageSnapshot(
                packageSpecifier.packageName,
            )
            if (nodePackageSnapshot !== null) {
                addCandidates(
                    candidates,
                    resolvePackageManifestCandidates(
                        packageSpecifier,
                        nodePackageSnapshot,
                        input.fileExtensionCandidates,
                    ),
                )
            } else {
                addCandidates(
                    candidates,
                    buildPathCandidates(
                        pathPosix.join(
                            "node_modules",
                            packageSpecifier.packageName,
                            packageSpecifier.packageSubPath ?? "",
                        ),
                        input.fileExtensionCandidates,
                    ),
                )
            }
        }

        addCandidates(
            candidates,
            resolveSourceFallbackCandidates(
                input.importSource,
                workspacePackageRoots,
                this.sourceDirectoryCandidates,
                input.fileExtensionCandidates,
            ),
        )

        return [...candidates]
    }

    /**
     * Returns cached tsconfig snapshots.
     *
     * @returns Tsconfig snapshots.
     */
    private async getTsConfigSnapshots(): Promise<readonly IAstTypeScriptConfigSnapshot[]> {
        if (this.tsConfigSnapshotsPromise === undefined) {
            this.tsConfigSnapshotsPromise = this.loadTsConfigSnapshots()
        }

        return this.tsConfigSnapshotsPromise
    }

    /**
     * Loads tsconfig snapshots from repository and workspace roots.
     *
     * @returns Parsed tsconfig snapshots.
     */
    private async loadTsConfigSnapshots(): Promise<readonly IAstTypeScriptConfigSnapshot[]> {
        const candidatePaths = new Set<string>([TS_CONFIG_FILE_NAME])
        const workspacePackageRoots = await this.resolveWorkspacePackageRoots()

        for (const workspacePackageRoot of workspacePackageRoots) {
            candidatePaths.add(pathPosix.join(workspacePackageRoot, TS_CONFIG_FILE_NAME))
        }

        const snapshots: IAstTypeScriptConfigSnapshot[] = []
        for (const candidatePath of candidatePaths) {
            const configPayload = await this.readOptionalJsonFile<IAstTypeScriptConfigPayload>(
                candidatePath,
                AST_TYPESCRIPT_IMPORT_RESOLVER_ERROR_CODE.TS_CONFIG_READ_FAILED,
                AST_TYPESCRIPT_IMPORT_RESOLVER_ERROR_CODE.INVALID_TS_CONFIG,
            )
            if (configPayload !== undefined) {
                snapshots.push(createTypeScriptConfigSnapshot(configPayload, candidatePath))
            }
        }

        return snapshots
    }

    /**
     * Returns cached workspace package snapshots.
     *
     * @returns Parsed package snapshots.
     */
    private async getWorkspacePackageSnapshots(): Promise<readonly IAstPackageManifestSnapshot[]> {
        if (this.workspacePackageSnapshotsPromise === undefined) {
            this.workspacePackageSnapshotsPromise = this.loadWorkspacePackageSnapshots()
        }

        return this.workspacePackageSnapshotsPromise
    }

    /**
     * Loads package manifests from explicit and discovered workspace package roots.
     *
     * @returns Parsed package snapshots.
     */
    private async loadWorkspacePackageSnapshots(): Promise<readonly IAstPackageManifestSnapshot[]> {
        const candidatePaths = new Set<string>([PACKAGE_MANIFEST_FILE_NAME])
        const workspacePackageRoots = await this.resolveWorkspacePackageRoots()

        for (const workspacePackageRoot of workspacePackageRoots) {
            candidatePaths.add(pathPosix.join(workspacePackageRoot, PACKAGE_MANIFEST_FILE_NAME))
        }

        const snapshots: IAstPackageManifestSnapshot[] = []
        for (const candidatePath of candidatePaths) {
            const manifestPayload = await this.readOptionalJsonFile<IAstPackageManifestPayload>(
                candidatePath,
                AST_TYPESCRIPT_IMPORT_RESOLVER_ERROR_CODE.PACKAGE_MANIFEST_READ_FAILED,
                AST_TYPESCRIPT_IMPORT_RESOLVER_ERROR_CODE.INVALID_PACKAGE_MANIFEST,
            )
            if (manifestPayload !== undefined) {
                snapshots.push(createPackageManifestSnapshot(manifestPayload, candidatePath))
            }
        }

        return snapshots
    }

    /**
     * Finds one workspace package snapshot by package name.
     *
     * @param packageName Package name from import specifier.
     * @returns Matching package snapshot when available.
     */
    private async findWorkspacePackageSnapshot(
        packageName: string,
    ): Promise<IAstPackageManifestSnapshot | undefined> {
        const workspaceSnapshots = await this.getWorkspacePackageSnapshots()

        return workspaceSnapshots.find((snapshot) => snapshot.packageName === packageName)
    }

    /**
     * Returns cached node_modules package snapshot.
     *
     * @param packageName NPM package name.
     * @returns Package snapshot when manifest exists.
     */
    private async getNodePackageSnapshot(
        packageName: string,
    ): Promise<IAstPackageManifestSnapshot | null> {
        const cachedSnapshotPromise = this.nodePackageSnapshotByPackageName.get(packageName)
        if (cachedSnapshotPromise !== undefined) {
            return cachedSnapshotPromise
        }

        const snapshotPromise = this.loadNodePackageSnapshot(packageName)
        this.nodePackageSnapshotByPackageName.set(packageName, snapshotPromise)
        return snapshotPromise
    }

    /**
     * Loads one node_modules package manifest.
     *
     * @param packageName NPM package name.
     * @returns Package snapshot when manifest exists.
     */
    private async loadNodePackageSnapshot(
        packageName: string,
    ): Promise<IAstPackageManifestSnapshot | null> {
        const manifestPath = pathPosix.join(
            "node_modules",
            packageName,
            PACKAGE_MANIFEST_FILE_NAME,
        )
        const manifestPayload = await this.readOptionalJsonFile<IAstPackageManifestPayload>(
            manifestPath,
            AST_TYPESCRIPT_IMPORT_RESOLVER_ERROR_CODE.PACKAGE_MANIFEST_READ_FAILED,
            AST_TYPESCRIPT_IMPORT_RESOLVER_ERROR_CODE.INVALID_PACKAGE_MANIFEST,
        )

        if (manifestPayload === undefined) {
            return null
        }

        return createPackageManifestSnapshot(manifestPayload, manifestPath)
    }

    /**
     * Resolves workspace package roots using explicit options or discovery.
     *
     * @returns Workspace package roots.
     */
    private async resolveWorkspacePackageRoots(): Promise<readonly string[]> {
        if (this.hasExplicitWorkspacePackageRoots) {
            return this.explicitWorkspacePackageRoots
        }

        if (this.discoveredWorkspacePackageRootsPromise === undefined) {
            this.discoveredWorkspacePackageRootsPromise = this.discoverWorkspacePackageRoots()
        }

        return this.discoveredWorkspacePackageRootsPromise
    }

    /**
     * Discovers workspace package roots from repository `packages` directory.
     *
     * @returns Discovered workspace package roots.
     */
    private async discoverWorkspacePackageRoots(): Promise<readonly string[]> {
        const workspaceDirectoryPath = resolveFileSystemPath(
            this.repositoryRootPath,
            DEFAULT_WORKSPACES_DIRECTORY,
        )
        const entryNames = await this.readOptionalDirectory(workspaceDirectoryPath)
        const normalizedRoots = new Set<string>()

        for (const entryName of entryNames) {
            const normalizedEntryName = normalizeText(entryName)
            if (normalizedEntryName.length === 0 || normalizedEntryName.startsWith(".")) {
                continue
            }

            normalizedRoots.add(pathPosix.join(DEFAULT_WORKSPACES_DIRECTORY, normalizedEntryName))
        }

        return [...normalizedRoots]
    }

    /**
     * Reads optional JSON object from repository-relative path.
     *
     * @param filePath Repository-relative file path.
     * @param readFailureCode Error code used for read failures.
     * @param invalidPayloadCode Error code used for invalid payload.
     * @returns Parsed JSON object when file exists.
     */
    private async readOptionalJsonFile<TValue extends object>(
        filePath: string,
        readFailureCode: AstTypeScriptImportResolverErrorCode,
        invalidPayloadCode: AstTypeScriptImportResolverErrorCode,
    ): Promise<TValue | undefined> {
        const fileContent = await this.readOptionalFile(filePath, readFailureCode)
        if (fileContent === undefined) {
            return undefined
        }

        return parseJsonObject<TValue>(fileContent, filePath, invalidPayloadCode)
    }

    /**
     * Reads optional file content using repository root.
     *
     * @param filePath Repository-relative path.
     * @param errorCode Read-failure error code.
     * @returns File content when file exists.
     */
    private async readOptionalFile(
        filePath: string,
        errorCode: AstTypeScriptImportResolverErrorCode,
    ): Promise<string | undefined> {
        const fileSystemPath = resolveFileSystemPath(this.repositoryRootPath, filePath)

        try {
            return await this.readFile(fileSystemPath)
        } catch (error: unknown) {
            if (isFileNotFoundError(error)) {
                return undefined
            }

            throw new AstTypeScriptImportResolverError(errorCode, {
                filePath,
                reason: normalizeErrorReason(error),
            })
        }
    }

    /**
     * Reads optional directory entries.
     *
     * @param directoryPath File-system directory path.
     * @returns Directory entry names or empty list.
     */
    private async readOptionalDirectory(directoryPath: string): Promise<readonly string[]> {
        try {
            const entries = await this.readDirectory(directoryPath)
            return normalizeDirectoryEntries(entries)
        } catch (error: unknown) {
            if (isFileNotFoundError(error)) {
                return []
            }

            throw new AstTypeScriptImportResolverError(
                AST_TYPESCRIPT_IMPORT_RESOLVER_ERROR_CODE.PACKAGE_MANIFEST_READ_FAILED,
                {
                    filePath: directoryPath,
                    reason: normalizeErrorReason(error),
                },
            )
        }
    }
}

/**
 * Resolves base-resolver options with retry classifier aware of typed resolver errors.
 *
 * @param options Resolver options.
 * @returns Base resolver options.
 */
function resolveBaseImportResolverOptions(
    options: IAstTypeScriptImportResolverOptions,
): IAstBaseImportResolverOptions {
    return {
        ...options,
        retryPolicy: resolveRetryPolicy(options.retryPolicy),
    }
}

/**
 * Wraps retry classifier to surface typed resolver errors without base-level wrapping.
 *
 * @param retryPolicy Optional retry policy.
 * @returns Retry policy with typed-error passthrough.
 */
function resolveRetryPolicy(
    retryPolicy: IAstBaseImportResolverRetryPolicy | undefined,
): IAstBaseImportResolverRetryPolicy | undefined {
    if (retryPolicy === undefined) {
        return {
            shouldRetry: createShouldRetry(undefined),
        }
    }

    return {
        ...retryPolicy,
        shouldRetry: createShouldRetry(retryPolicy.shouldRetry),
    }
}

/**
 * Creates retry classifier that rethrows TypeScript resolver errors.
 *
 * @param baseShouldRetry Optional upstream retry classifier.
 * @returns Retry classifier used by base resolver.
 */
function createShouldRetry(
    baseShouldRetry: AstBaseImportResolverShouldRetry | undefined,
): AstBaseImportResolverShouldRetry {
    return (error: unknown, attempt: number): boolean => {
        if (error instanceof AstTypeScriptImportResolverError) {
            throw error
        }

        if (baseShouldRetry !== undefined) {
            return baseShouldRetry(error, attempt)
        }

        return true
    }
}

/**
 * Resolves tsconfig-based path candidates for one import source.
 *
 * @param importSource Non-relative import source.
 * @param snapshots Tsconfig snapshots.
 * @param fileExtensionCandidates Extension candidates used by base resolver.
 * @returns Unique path candidates.
 */
function resolveTypeScriptPathCandidates(
    importSource: string,
    snapshots: readonly IAstTypeScriptConfigSnapshot[],
    fileExtensionCandidates: readonly string[],
): readonly string[] {
    const candidates = new Set<string>()

    for (const snapshot of snapshots) {
        for (const mapping of snapshot.pathMappings) {
            const wildcardValue = matchPathPattern(mapping.pattern, importSource)
            if (wildcardValue === undefined) {
                continue
            }

            for (const targetPattern of mapping.targetPatterns) {
                const resolvedTargetPath = applyPathPattern(targetPattern, wildcardValue)
                const candidateBasePath = joinRelativePath(
                    snapshot.baseUrlPath,
                    resolvedTargetPath,
                )
                addCandidates(
                    candidates,
                    buildPathCandidates(candidateBasePath, fileExtensionCandidates),
                )
            }
        }

        const baseUrlCandidateBasePath = joinRelativePath(snapshot.baseUrlPath, importSource)
        addCandidates(
            candidates,
            buildPathCandidates(baseUrlCandidateBasePath, fileExtensionCandidates),
        )
    }

    return [...candidates]
}

/**
 * Resolves package-manifest based path candidates for one package specifier.
 *
 * @param packageSpecifier Parsed package import specifier.
 * @param snapshot Package manifest snapshot.
 * @param fileExtensionCandidates Extension candidates used by base resolver.
 * @returns Unique candidate paths.
 */
function resolvePackageManifestCandidates(
    packageSpecifier: IAstPackageSpecifier,
    snapshot: IAstPackageManifestSnapshot,
    fileExtensionCandidates: readonly string[],
): readonly string[] {
    const candidates = new Set<string>()

    for (const exportTargetPath of resolveExportTargetPaths(snapshot, packageSpecifier)) {
        const packageExportPath = joinRelativePath(snapshot.rootPath, exportTargetPath)
        addCandidates(
            candidates,
            buildPathCandidates(packageExportPath, fileExtensionCandidates),
        )
    }

    if (packageSpecifier.packageSubPath !== undefined) {
        const directSubPath = joinRelativePath(snapshot.rootPath, packageSpecifier.packageSubPath)
        addCandidates(candidates, buildPathCandidates(directSubPath, fileExtensionCandidates))
    } else {
        if (snapshot.mainEntry !== undefined) {
            const mainEntryPath = joinRelativePath(snapshot.rootPath, snapshot.mainEntry)
            addCandidates(candidates, buildPathCandidates(mainEntryPath, fileExtensionCandidates))
        }

        const indexPath = joinRelativePath(snapshot.rootPath, "index")
        addCandidates(candidates, buildPathCandidates(indexPath, fileExtensionCandidates))
    }

    return [...candidates]
}

/**
 * Resolves fallback source candidates for one import source.
 *
 * @param importSource Non-relative import source.
 * @param workspacePackageRoots Workspace package roots.
 * @param sourceDirectoryCandidates Source directory candidates.
 * @param fileExtensionCandidates Extension candidates used by base resolver.
 * @returns Unique fallback candidates.
 */
function resolveSourceFallbackCandidates(
    importSource: string,
    workspacePackageRoots: readonly string[],
    sourceDirectoryCandidates: readonly string[],
    fileExtensionCandidates: readonly string[],
): readonly string[] {
    const candidates = new Set<string>()

    addCandidates(candidates, buildPathCandidates(importSource, fileExtensionCandidates))

    for (const sourceDirectoryCandidate of sourceDirectoryCandidates) {
        const repositoryCandidate = joinRelativePath(sourceDirectoryCandidate, importSource)
        addCandidates(candidates, buildPathCandidates(repositoryCandidate, fileExtensionCandidates))
    }

    for (const workspacePackageRoot of workspacePackageRoots) {
        const packageRootCandidate = joinRelativePath(workspacePackageRoot, importSource)
        addCandidates(candidates, buildPathCandidates(packageRootCandidate, fileExtensionCandidates))

        for (const sourceDirectoryCandidate of sourceDirectoryCandidates) {
            const packageSourceCandidate = joinRelativePath(
                workspacePackageRoot,
                sourceDirectoryCandidate,
            )
            const packageSourceImportCandidate = joinRelativePath(
                packageSourceCandidate,
                importSource,
            )
            addCandidates(
                candidates,
                buildPathCandidates(packageSourceImportCandidate, fileExtensionCandidates),
            )
        }
    }

    return [...candidates]
}

/**
 * Parses package specifier from one non-relative import source.
 *
 * @param importSource Non-relative import source.
 * @returns Parsed package specifier when source is package-like.
 */
function parsePackageSpecifier(importSource: string): IAstPackageSpecifier | undefined {
    if (importSource.startsWith("@")) {
        const scopedParts = importSource.split("/")
        if (scopedParts.length < 2) {
            return undefined
        }

        const packageName = `${scopedParts[0]}/${scopedParts[1]}`
        const packageSubPath = scopedParts.slice(2).join("/")

        return {
            packageName,
            packageSubPath: packageSubPath.length > 0 ? packageSubPath : undefined,
        }
    }

    const packageParts = importSource.split("/")
    const [packageName, ...subPathParts] = packageParts
    if (packageName === undefined || packageName.length === 0) {
        return undefined
    }

    const packageSubPath = subPathParts.join("/")
    return {
        packageName,
        packageSubPath: packageSubPath.length > 0 ? packageSubPath : undefined,
    }
}

/**
 * Resolves package export target paths for one package specifier.
 *
 * @param snapshot Package manifest snapshot.
 * @param packageSpecifier Package import specifier.
 * @returns Export target paths.
 */
function resolveExportTargetPaths(
    snapshot: IAstPackageManifestSnapshot,
    packageSpecifier: IAstPackageSpecifier,
): readonly string[] {
    const exportKey =
        packageSpecifier.packageSubPath === undefined
            ? "."
            : `./${packageSpecifier.packageSubPath}`

    const explicitTargets = snapshot.exportsSnapshot.targetsByKey[exportKey]
    if (explicitTargets !== undefined) {
        return explicitTargets
    }

    const wildcardTargets = resolveWildcardExportTargetPaths(
        snapshot.exportsSnapshot.wildcardTargetsByPattern,
        exportKey,
    )
    if (wildcardTargets.length > 0) {
        return wildcardTargets
    }

    if (exportKey === ".") {
        return snapshot.exportsSnapshot.rootTargets
    }

    return []
}

/**
 * Resolves wildcard exports for one key like `./foo/bar`.
 *
 * @param exportsObject Export map object.
 * @param exportKey Requested export key.
 * @returns Resolved wildcard targets.
 */
function resolveWildcardExportTargetPaths(
    wildcardTargetsByPattern: Readonly<Record<string, readonly string[]>>,
    exportKey: string,
): readonly string[] {
    const targets = new Set<string>()

    for (const [pattern, wildcardTargets] of Object.entries(wildcardTargetsByPattern)) {
        const wildcardValue = matchPathPattern(pattern, exportKey)
        if (wildcardValue === undefined) {
            continue
        }

        for (const target of wildcardTargets) {
            targets.add(applyPathPattern(target, wildcardValue))
        }
    }

    return [...targets]
}

/**
 * Creates candidate file paths by extension and index-file expansion.
 *
 * @param candidateBasePath Base candidate path.
 * @param fileExtensionCandidates Extension candidates.
 * @returns Unique candidate file paths.
 */
function buildPathCandidates(
    candidateBasePath: string,
    fileExtensionCandidates: readonly string[],
): readonly string[] {
    const normalizedBasePath = normalizeRepositoryRelativePath(candidateBasePath)
    if (normalizedBasePath.length === 0) {
        return []
    }

    const hasExtension = pathPosix.extname(normalizedBasePath).length > 0
    const candidates = new Set<string>()

    if (hasExtension) {
        candidates.add(normalizedBasePath)
        return [...candidates]
    }

    for (const extension of fileExtensionCandidates) {
        candidates.add(`${normalizedBasePath}${extension}`)
        candidates.add(pathPosix.join(normalizedBasePath, `index${extension}`))
    }

    return [...candidates]
}

/**
 * Adds candidate paths to target set.
 *
 * @param targetSet Target set.
 * @param candidates Candidate paths.
 */
function addCandidates(targetSet: Set<string>, candidates: readonly string[]): void {
    for (const candidate of candidates) {
        targetSet.add(normalizeRepositoryRelativePath(candidate))
    }
}

/**
 * Matches one path pattern with optional wildcard against value.
 *
 * @param pattern Path pattern with zero or one wildcard.
 * @param value Value to match.
 * @returns Captured wildcard value or empty string when matched without wildcard.
 */
function matchPathPattern(pattern: string, value: string): string | undefined {
    const firstWildcardIndex = pattern.indexOf("*")
    if (firstWildcardIndex === -1) {
        return pattern === value ? "" : undefined
    }

    if (firstWildcardIndex !== pattern.lastIndexOf("*")) {
        return undefined
    }

    const prefix = pattern.slice(0, firstWildcardIndex)
    const suffix = pattern.slice(firstWildcardIndex + 1)
    if (value.startsWith(prefix) === false || value.endsWith(suffix) === false) {
        return undefined
    }

    const startIndex = prefix.length
    const endIndex = value.length - suffix.length
    if (endIndex < startIndex) {
        return undefined
    }

    return value.slice(startIndex, endIndex)
}

/**
 * Applies wildcard value to one path pattern.
 *
 * @param pattern Path pattern.
 * @param wildcardValue Wildcard value.
 * @returns Replaced path.
 */
function applyPathPattern(pattern: string, wildcardValue: string): string {
    if (pattern.includes("*")) {
        return pattern.replace("*", wildcardValue)
    }

    return pattern
}

/**
 * Creates one normalized tsconfig snapshot.
 *
 * @param payload Tsconfig payload.
 * @param filePath Tsconfig file path.
 * @returns Tsconfig snapshot.
 */
function createTypeScriptConfigSnapshot(
    payload: IAstTypeScriptConfigPayload,
    filePath: string,
): IAstTypeScriptConfigSnapshot {
    const compilerOptions = normalizeCompilerOptions(payload, filePath)
    const baseDirectoryPath = resolveDirectoryPath(filePath)
    const baseUrl = normalizeOptionalText(compilerOptions.baseUrl)
    const baseUrlPath =
        baseUrl === undefined ? baseDirectoryPath : joinRelativePath(baseDirectoryPath, baseUrl)
    const pathMappings = normalizePathMappings(compilerOptions.paths, filePath)

    return {
        filePath,
        baseDirectoryPath,
        baseUrlPath,
        pathMappings,
    }
}

/**
 * Creates one normalized package-manifest snapshot.
 *
 * @param payload Package manifest payload.
 * @param filePath Package manifest file path.
 * @returns Package manifest snapshot.
 */
function createPackageManifestSnapshot(
    payload: IAstPackageManifestPayload,
    filePath: string,
): IAstPackageManifestSnapshot {
    const packageName = normalizeOptionalText(payload.name)
    const mainEntryRaw = normalizeOptionalText(payload.main)
    const exportsSnapshot = normalizePackageExports(payload.exports, filePath)

    return {
        packageName,
        rootPath: resolveDirectoryPath(filePath),
        mainEntry:
            mainEntryRaw === undefined ? undefined : normalizePackageManifestPath(mainEntryRaw),
        exportsSnapshot,
    }
}

/**
 * Validates tsconfig compiler options.
 *
 * @param payload Tsconfig payload.
 * @param filePath Tsconfig file path.
 * @returns Normalized compiler options object.
 */
function normalizeCompilerOptions(
    payload: IAstTypeScriptConfigPayload,
    filePath: string,
): IAstTypeScriptCompilerOptionsPayload {
    const compilerOptions = payload.compilerOptions
    if (compilerOptions === undefined) {
        return {}
    }

    if (isPlainObject(compilerOptions) === false) {
        throw new AstTypeScriptImportResolverError(
            AST_TYPESCRIPT_IMPORT_RESOLVER_ERROR_CODE.INVALID_TS_CONFIG,
            {
                filePath,
            },
        )
    }

    return compilerOptions as IAstTypeScriptCompilerOptionsPayload
}

/**
 * Validates tsconfig path mappings.
 *
 * @param pathsValue Paths payload from compiler options.
 * @param filePath Tsconfig file path.
 * @returns Normalized mappings.
 */
function normalizePathMappings(
    pathsValue: unknown,
    filePath: string,
): readonly IAstTypeScriptPathMapping[] {
    if (pathsValue === undefined) {
        return []
    }

    if (isPlainObject(pathsValue) === false) {
        throw new AstTypeScriptImportResolverError(
            AST_TYPESCRIPT_IMPORT_RESOLVER_ERROR_CODE.INVALID_TS_CONFIG,
            {
                filePath,
            },
        )
    }

    const mappings: IAstTypeScriptPathMapping[] = []
    for (const [patternRaw, targetPatternsRaw] of Object.entries(pathsValue)) {
        const pattern = normalizeText(patternRaw)
        const targetPatterns = normalizePathMappingTargets(targetPatternsRaw, filePath)
        if (pattern.length === 0 || targetPatterns.length === 0) {
            throw new AstTypeScriptImportResolverError(
                AST_TYPESCRIPT_IMPORT_RESOLVER_ERROR_CODE.INVALID_TS_CONFIG,
                {
                    filePath,
                },
            )
        }

        mappings.push({
            pattern,
            targetPatterns,
        })
    }

    return mappings
}

/**
 * Validates one tsconfig paths-entry payload.
 *
 * @param value Raw path mapping value.
 * @param filePath Tsconfig file path.
 * @returns Normalized target patterns.
 */
function normalizePathMappingTargets(value: unknown, filePath: string): readonly string[] {
    if (typeof value === "string") {
        const normalizedValue = normalizeText(value)
        if (normalizedValue.length === 0) {
            throw new AstTypeScriptImportResolverError(
                AST_TYPESCRIPT_IMPORT_RESOLVER_ERROR_CODE.INVALID_TS_CONFIG,
                {
                    filePath,
                },
            )
        }

        return [normalizedValue]
    }

    if (Array.isArray(value)) {
        const normalizedValues = value.map((item) => normalizeOptionalText(item))
        const filteredValues = normalizedValues.filter(
            (item): item is string => item !== undefined && item.length > 0,
        )
        if (filteredValues.length === 0) {
            throw new AstTypeScriptImportResolverError(
                AST_TYPESCRIPT_IMPORT_RESOLVER_ERROR_CODE.INVALID_TS_CONFIG,
                {
                    filePath,
                },
            )
        }

        return filteredValues
    }

    throw new AstTypeScriptImportResolverError(
        AST_TYPESCRIPT_IMPORT_RESOLVER_ERROR_CODE.INVALID_TS_CONFIG,
        {
            filePath,
        },
    )
}

/**
 * Validates package-manifest exports payload.
 *
 * @param exportsValue Raw exports payload.
 * @param filePath Package manifest file path.
 * @returns Normalized exports payload.
 */
function normalizePackageExports(
    exportsValue: unknown,
    filePath: string,
): IAstPackageExportsSnapshot {
    if (exportsValue === undefined) {
        return {
            rootTargets: [],
            targetsByKey: {},
            wildcardTargetsByPattern: {},
        }
    }

    if (isPlainObject(exportsValue) === false) {
        return {
            rootTargets: collectExportStringTargets(exportsValue, filePath, 0),
            targetsByKey: {},
            wildcardTargetsByPattern: {},
        }
    }

    const exportsEntries = Object.entries(exportsValue)
    const hasSubPathEntries = exportsEntries.some(
        ([exportKey]) => exportKey === "." || exportKey.startsWith("./"),
    )
    if (hasSubPathEntries === false) {
        return {
            rootTargets: collectExportStringTargets(exportsValue, filePath, 0),
            targetsByKey: {},
            wildcardTargetsByPattern: {},
        }
    }

    const targetsByKey: Record<string, readonly string[]> = {}
    const wildcardTargetsByPattern: Record<string, readonly string[]> = {}
    let rootTargets: readonly string[] = []

    for (const [exportKey, exportValue] of exportsEntries) {
        if (exportKey === ".") {
            const targets = collectExportStringTargets(exportValue, filePath, 0)
            rootTargets = targets
            targetsByKey[exportKey] = targets
            continue
        }

        if (exportKey.startsWith("./") === false) {
            throwInvalidPackageManifest(filePath)
        }

        if (exportKey.includes("*")) {
            wildcardTargetsByPattern[exportKey] = collectExportStringTargets(
                exportValue,
                filePath,
                0,
            )
            continue
        }

        targetsByKey[exportKey] = collectExportStringTargets(exportValue, filePath, 0)
    }

    return {
        rootTargets,
        targetsByKey,
        wildcardTargetsByPattern,
    }
}

/**
 * Collects string export targets from recursive exports payload.
 *
 * @param value Recursive exports payload.
 * @param filePath Package manifest file path.
 * @param depth Current recursion depth.
 * @returns Collected target paths.
 */
function collectExportStringTargets(
    value: unknown,
    filePath: string,
    depth: number,
): readonly string[] {
    if (depth > EXPORT_RESOLUTION_DEPTH_LIMIT) {
        return []
    }

    if (typeof value === "string") {
        const normalizedTargetPath = normalizePackageManifestPath(value)
        if (normalizedTargetPath.length === 0) {
            throwInvalidPackageManifest(filePath)
        }

        return [normalizedTargetPath]
    }

    if (Array.isArray(value)) {
        const targets = new Set<string>()
        for (const entry of value) {
            addCandidates(
                targets,
                collectExportStringTargets(entry, filePath, depth + 1),
            )
        }

        return [...targets]
    }

    if (isPlainObject(value)) {
        return collectExportTargetsFromObject(value, filePath, depth + 1)
    }

    throwInvalidPackageManifest(filePath)
}

/**
 * Collects export targets from object payload.
 *
 * @param value Object payload.
 * @param filePath Package manifest file path.
 * @param depth Current recursion depth.
 * @returns Collected target paths.
 */
function collectExportTargetsFromObject(
    value: Record<string, unknown>,
    filePath: string,
    depth: number,
): readonly string[] {
    const preferredTargets = new Set<string>()
    for (const condition of EXPORT_CONDITION_ORDER) {
        const conditionValue = value[condition]
        if (conditionValue !== undefined) {
            addCandidates(
                preferredTargets,
                collectExportStringTargets(conditionValue, filePath, depth),
            )
        }
    }

    if (preferredTargets.size > 0) {
        return [...preferredTargets]
    }

    const fallbackTargets = new Set<string>()
    for (const nestedValue of Object.values(value)) {
        addCandidates(
            fallbackTargets,
            collectExportStringTargets(nestedValue, filePath, depth),
        )
    }

    return [...fallbackTargets]
}

/**
 * Throws typed invalid-package-manifest error.
 *
 * @param filePath Package manifest file path.
 */
function throwInvalidPackageManifest(filePath: string): never {
    throw new AstTypeScriptImportResolverError(
        AST_TYPESCRIPT_IMPORT_RESOLVER_ERROR_CODE.INVALID_PACKAGE_MANIFEST,
        {
            filePath,
        },
    )
}

/**
 * Parses JSON object payload.
 *
 * @param source JSON source.
 * @param filePath Source file path.
 * @param errorCode Error code used for invalid JSON.
 * @returns Parsed JSON object.
 */
function parseJsonObject<TValue extends object>(
    source: string,
    filePath: string,
    errorCode: AstTypeScriptImportResolverErrorCode,
): TValue {
    try {
        const parsed = JSON.parse(stripJsonComments(source)) as unknown
        if (isPlainObject(parsed) === false) {
            throw new Error("Expected JSON object")
        }

        return parsed as TValue
    } catch {
        throw new AstTypeScriptImportResolverError(errorCode, {
            filePath,
        })
    }
}

/**
 * Strips line and block comments from JSON-like source.
 *
 * @param source JSON-like text.
 * @returns Comment-free JSON text.
 */
function stripJsonComments(source: string): string {
    const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, "")
    return withoutBlockComments.replace(/^\s*\/\/.*$/gm, "")
}

/**
 * Validates repository root path.
 *
 * @param repositoryRootPath Raw repository root path.
 * @returns Normalized repository root path.
 */
function normalizeRepositoryRootPath(repositoryRootPath: string): string {
    const normalizedPath = normalizeText(repositoryRootPath)
    if (normalizedPath.length === 0) {
        throw new AstTypeScriptImportResolverError(
            AST_TYPESCRIPT_IMPORT_RESOLVER_ERROR_CODE.INVALID_REPOSITORY_ROOT_PATH,
            {
                repositoryRootPath,
            },
        )
    }

    return pathPosix.normalize(normalizedPath)
}

/**
 * Validates workspace package roots.
 *
 * @param workspacePackageRoots Raw workspace package roots.
 * @returns Normalized workspace package roots.
 */
function normalizeWorkspacePackageRoots(
    workspacePackageRoots: readonly string[],
): readonly string[] {
    const normalizedRoots = new Set<string>()

    for (const workspacePackageRoot of workspacePackageRoots) {
        const normalizedRoot = normalizeText(workspacePackageRoot)
        if (normalizedRoot.length === 0 || pathPosix.isAbsolute(normalizedRoot)) {
            throw new AstTypeScriptImportResolverError(
                AST_TYPESCRIPT_IMPORT_RESOLVER_ERROR_CODE.INVALID_WORKSPACE_PACKAGE_ROOT,
                {
                    workspacePackageRoot,
                },
            )
        }

        try {
            normalizedRoots.add(
                FilePath.create(pathPosix.normalize(normalizedRoot)).toString(),
            )
        } catch {
            throw new AstTypeScriptImportResolverError(
                AST_TYPESCRIPT_IMPORT_RESOLVER_ERROR_CODE.INVALID_WORKSPACE_PACKAGE_ROOT,
                {
                    workspacePackageRoot,
                },
            )
        }
    }

    return [...normalizedRoots]
}

/**
 * Validates source directory candidates.
 *
 * @param sourceDirectoryCandidates Raw source directory candidates.
 * @returns Normalized source directory candidates.
 */
function normalizeSourceDirectoryCandidates(
    sourceDirectoryCandidates: readonly string[],
): readonly string[] {
    const normalizedCandidates = new Set<string>()

    for (const sourceDirectoryCandidate of sourceDirectoryCandidates) {
        const normalizedCandidate = normalizeText(sourceDirectoryCandidate)
        if (
            normalizedCandidate.length === 0 ||
            normalizedCandidate.startsWith(".") ||
            pathPosix.isAbsolute(normalizedCandidate)
        ) {
            continue
        }

        normalizedCandidates.add(normalizeRepositoryRelativePath(normalizedCandidate))
    }

    return normalizedCandidates.size > 0
        ? [...normalizedCandidates]
        : [...DEFAULT_SOURCE_DIRECTORY_CANDIDATES]
}

/**
 * Validates optional readFile function.
 *
 * @param readFileFn Optional readFile function.
 * @returns ReadFile function.
 */
function validateReadFile(
    readFileFn: AstTypeScriptImportResolverReadFile | undefined,
): AstTypeScriptImportResolverReadFile {
    if (readFileFn === undefined) {
        return defaultReadFile
    }

    if (typeof readFileFn !== "function") {
        throw new AstTypeScriptImportResolverError(
            AST_TYPESCRIPT_IMPORT_RESOLVER_ERROR_CODE.INVALID_READ_FILE,
        )
    }

    return readFileFn
}

/**
 * Validates optional readDirectory function.
 *
 * @param readDirectoryFn Optional readDirectory function.
 * @returns ReadDirectory function.
 */
function validateReadDirectory(
    readDirectoryFn: AstTypeScriptImportResolverReadDirectory | undefined,
): AstTypeScriptImportResolverReadDirectory {
    if (readDirectoryFn === undefined) {
        return defaultReadDirectory
    }

    if (typeof readDirectoryFn !== "function") {
        throw new AstTypeScriptImportResolverError(
            AST_TYPESCRIPT_IMPORT_RESOLVER_ERROR_CODE.INVALID_READ_DIRECTORY,
        )
    }

    return readDirectoryFn
}

/**
 * Resolves one repository-relative path to file-system path.
 *
 * @param repositoryRootPath Repository root path.
 * @param repositoryRelativePath Repository-relative path.
 * @returns File-system path.
 */
function resolveFileSystemPath(
    repositoryRootPath: string,
    repositoryRelativePath: string,
): string {
    if (repositoryRootPath === ".") {
        return repositoryRelativePath
    }

    if (repositoryRelativePath.length === 0) {
        return repositoryRootPath
    }

    return pathPosix.join(repositoryRootPath, repositoryRelativePath)
}

/**
 * Normalizes one package-manifest path (`./dist/index.js` -> `dist/index.js`).
 *
 * @param value Package-manifest path.
 * @returns Normalized path.
 */
function normalizePackageManifestPath(value: string): string {
    const withoutLeadingDotSlash = value.startsWith("./") ? value.slice(2) : value
    return normalizeRepositoryRelativePath(withoutLeadingDotSlash)
}

/**
 * Resolves directory path from one file path.
 *
 * @param filePath File path.
 * @returns Directory path or empty string.
 */
function resolveDirectoryPath(filePath: string): string {
    const directoryPath = pathPosix.dirname(filePath)
    return directoryPath === "." ? "" : normalizeRepositoryRelativePath(directoryPath)
}

/**
 * Joins two repository-relative path segments.
 *
 * @param left Left segment.
 * @param right Right segment.
 * @returns Joined normalized path.
 */
function joinRelativePath(left: string, right: string): string {
    if (left.length === 0) {
        return normalizeRepositoryRelativePath(right)
    }

    if (right.length === 0) {
        return normalizeRepositoryRelativePath(left)
    }

    return normalizeRepositoryRelativePath(pathPosix.join(left, right))
}

/**
 * Normalizes repository-relative path.
 *
 * @param value Raw path.
 * @returns Normalized path.
 */
function normalizeRepositoryRelativePath(value: string): string {
    const normalizedPath = pathPosix.normalize(normalizeText(value))
    if (normalizedPath === ".") {
        return ""
    }

    if (normalizedPath.startsWith("./")) {
        return normalizedPath.slice(2)
    }

    return normalizedPath
}

/**
 * Normalizes directory entries returned by custom readDirectory function.
 *
 * @param entries Raw directory entries.
 * @returns Normalized entry names.
 */
function normalizeDirectoryEntries(entries: readonly string[]): readonly string[] {
    const normalizedEntries = new Set<string>()

    for (const entry of entries) {
        const normalizedEntry = normalizeText(entry)
        if (normalizedEntry.length > 0) {
            normalizedEntries.add(normalizedEntry)
        }
    }

    return [...normalizedEntries]
}

/**
 * Normalizes optional text value.
 *
 * @param value Unknown text value.
 * @returns Trimmed text when available.
 */
function normalizeOptionalText(value: unknown): string | undefined {
    if (typeof value !== "string") {
        return undefined
    }

    const normalized = normalizeText(value)
    return normalized.length > 0 ? normalized : undefined
}

/**
 * Normalizes text value.
 *
 * @param value Raw text value.
 * @returns Trimmed and slash-normalized text.
 */
function normalizeText(value: string): string {
    return value.trim().replaceAll("\\", "/")
}

/**
 * Checks whether one import source references node built-in module.
 *
 * @param importSource Non-relative import source.
 * @returns True when import targets node built-in.
 */
function isNodeBuiltinImport(importSource: string): boolean {
    return importSource.startsWith("node:")
}

/**
 * Checks whether unknown value is a plain object.
 *
 * @param value Unknown value.
 * @returns True when value is plain object.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && Array.isArray(value) === false
}

/**
 * Converts unknown error to stable reason string.
 *
 * @param error Unknown error.
 * @returns Stable reason string.
 */
function normalizeErrorReason(error: unknown): string {
    if (error instanceof Error) {
        return error.message
    }

    if (typeof error === "string") {
        return error
    }

    return "Unknown file-system failure"
}

/**
 * Checks whether one failure is "file or directory not found".
 *
 * @param error Unknown error.
 * @returns True when error is ENOENT.
 */
function isFileNotFoundError(error: unknown): boolean {
    if (isPlainObject(error) === false) {
        return false
    }

    const code = error["code"]
    return code === "ENOENT"
}

/**
 * Default file reader.
 *
 * @param filePath File path.
 * @returns UTF-8 file content.
 */
async function defaultReadFile(filePath: string): Promise<string> {
    return readFile(filePath, "utf-8")
}

/**
 * Default directory reader.
 *
 * @param directoryPath Directory path.
 * @returns Direct child names.
 */
async function defaultReadDirectory(directoryPath: string): Promise<readonly string[]> {
    return readdir(directoryPath)
}
