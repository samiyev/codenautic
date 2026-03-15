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
    AST_GO_IMPORT_RESOLVER_ERROR_CODE,
    AstGoImportResolverError,
} from "./ast-go-import-resolver.error"

const DEFAULT_REPOSITORY_ROOT_PATH = "."
const DEFAULT_GO_FILE_EXTENSION_CANDIDATES = [".go"] as const
const DEFAULT_WORKSPACES_DIRECTORY = "packages"
const DEFAULT_SOURCE_DIRECTORY_CANDIDATES = ["src"] as const
const GO_MOD_FILE_NAME = "go.mod"
const GO_REPLACE_RESOLUTION_DEPTH_LIMIT = 20
const CGO_IMPORT_SOURCE = "C"

/**
 * Reads one UTF-8 file from file system.
 */
export type AstGoImportResolverReadFile = (filePath: string) => Promise<string>

/**
 * Reads one directory and returns direct child entry names.
 */
export type AstGoImportResolverReadDirectory = (
    directoryPath: string,
) => Promise<readonly string[]>

/**
 * Runtime options for Go import resolver.
 */
export interface IAstGoImportResolverOptions extends IAstBaseImportResolverOptions {
    /**
     * Repository root path used to discover go.mod files.
     */
    readonly repositoryRootPath?: string

    /**
     * Explicit workspace package roots used for go.mod lookup.
     */
    readonly workspacePackageRoots?: readonly string[]

    /**
     * Optional source directory candidates used by fallback resolution.
     */
    readonly sourceDirectoryCandidates?: readonly string[]

    /**
     * Optional custom file reader.
     */
    readonly readFile?: AstGoImportResolverReadFile

    /**
     * Optional custom directory reader.
     */
    readonly readDirectory?: AstGoImportResolverReadDirectory
}

interface IParsedGoModReplaceDirective {
    readonly sourceModulePath: string
    readonly target: string
}

interface IParsedGoModDocument {
    readonly modulePath: string
    readonly replaceDirectives: readonly IParsedGoModReplaceDirective[]
}

interface IGoModuleReplaceTargetLocalPath {
    readonly kind: "local-path"
    readonly localPath: string
}

interface IGoModuleReplaceTargetModulePath {
    readonly kind: "module-path"
    readonly modulePath: string
}

type IGoModuleReplaceTarget =
    | IGoModuleReplaceTargetLocalPath
    | IGoModuleReplaceTargetModulePath

interface IGoModuleReplaceDirective {
    readonly sourceModulePath: string
    readonly target: IGoModuleReplaceTarget
}

interface IGoModuleSnapshot {
    readonly modulePath: string
    readonly moduleRootPath: string
    readonly replaceDirectives: readonly IGoModuleReplaceDirective[]
}

/**
 * Go import resolver based on module mappings from one or more `go.mod` files.
 */
export class AstGoImportResolver extends AstBaseImportResolver {
    private readonly repositoryRootPath: string
    private readonly explicitWorkspacePackageRoots: readonly string[]
    private readonly hasExplicitWorkspacePackageRoots: boolean
    private readonly sourceDirectoryCandidates: readonly string[]
    private readonly readFile: AstGoImportResolverReadFile
    private readonly readDirectory: AstGoImportResolverReadDirectory
    private goModuleSnapshotsPromise: Promise<readonly IGoModuleSnapshot[]> | undefined
    private discoveredWorkspacePackageRootsPromise: Promise<readonly string[]> | undefined
    private readonly packageDirectoryEntriesByPath = new Map<string, Promise<readonly string[]>>()

    /**
     * Creates Go import resolver.
     *
     * @param options Optional runtime configuration.
     */
    public constructor(options: IAstGoImportResolverOptions = {}) {
        super(resolveBaseImportResolverOptions(options))

        this.repositoryRootPath = normalizeRepositoryRootPath(
            options.repositoryRootPath ?? DEFAULT_REPOSITORY_ROOT_PATH,
        )
        this.explicitWorkspacePackageRoots = normalizeWorkspacePackageRoots(
            options.workspacePackageRoots ?? [],
        )
        this.hasExplicitWorkspacePackageRoots = options.workspacePackageRoots !== undefined
        this.sourceDirectoryCandidates = normalizeSourceDirectoryCandidates(
            options.sourceDirectoryCandidates ?? DEFAULT_SOURCE_DIRECTORY_CANDIDATES,
        )
        this.readFile = validateReadFile(options.readFile)
        this.readDirectory = validateReadDirectory(options.readDirectory)
    }

    /**
     * Resolves candidate target file paths for one non-relative Go import source.
     *
     * @param input Normalized non-relative import payload.
     * @returns Candidate target paths.
     */
    protected async resolveNonRelativeCandidates(
        input: IAstBaseNonRelativeImportResolutionInput,
    ): Promise<readonly string[]> {
        const importPath = normalizeGoImportPath(input.importSource)
        if (importPath === undefined || importPath === CGO_IMPORT_SOURCE) {
            return []
        }

        const goModuleSnapshots = await this.getGoModuleSnapshots()
        const workspacePackageRoots = await this.resolveWorkspacePackageRoots()
        const packageDirectoryPaths = new Set<string>()

        addCandidates(
            packageDirectoryPaths,
            resolveGoModulePackageDirectories(importPath, goModuleSnapshots),
        )
        addCandidates(
            packageDirectoryPaths,
            resolveFallbackPackageDirectories(
                importPath,
                workspacePackageRoots,
                this.sourceDirectoryCandidates,
            ),
        )

        const fileCandidates = new Set<string>()
        for (const packageDirectoryPath of packageDirectoryPaths) {
            addCandidates(
                fileCandidates,
                await this.resolveFileCandidatesForPackageDirectory(
                    packageDirectoryPath,
                    input.fileExtensionCandidates,
                ),
            )
        }

        return [...fileCandidates]
    }

    /**
     * Returns cached go module snapshots.
     *
     * @returns Parsed go module snapshots.
     */
    private async getGoModuleSnapshots(): Promise<readonly IGoModuleSnapshot[]> {
        if (this.goModuleSnapshotsPromise === undefined) {
            this.goModuleSnapshotsPromise = this.loadGoModuleSnapshots()
        }

        return this.goModuleSnapshotsPromise
    }

    /**
     * Loads go module snapshots from repository and workspace package roots.
     *
     * @returns Parsed go module snapshots.
     */
    private async loadGoModuleSnapshots(): Promise<readonly IGoModuleSnapshot[]> {
        const workspacePackageRoots = await this.resolveWorkspacePackageRoots()
        const goModPaths = new Set<string>([GO_MOD_FILE_NAME])

        for (const workspacePackageRoot of workspacePackageRoots) {
            goModPaths.add(pathPosix.join(workspacePackageRoot, GO_MOD_FILE_NAME))
        }

        const snapshots: IGoModuleSnapshot[] = []
        for (const goModPath of goModPaths) {
            const snapshot = await this.readGoModuleSnapshot(goModPath)
            if (snapshot !== undefined) {
                snapshots.push(snapshot)
            }
        }

        return snapshots
    }

    /**
     * Reads one optional go.mod snapshot.
     *
     * @param goModPath Repository-relative go.mod path.
     * @returns Parsed snapshot when file exists.
     */
    private async readGoModuleSnapshot(goModPath: string): Promise<IGoModuleSnapshot | undefined> {
        const goModContent = await this.readOptionalFile(goModPath)
        if (goModContent === undefined) {
            return undefined
        }

        const parsedGoModDocument = parseGoModDocument(goModContent, goModPath)
        return createGoModuleSnapshot(
            parsedGoModDocument,
            goModPath,
            this.repositoryRootPath,
        )
    }

    /**
     * Reads one optional file content.
     *
     * @param filePath Repository-relative file path.
     * @returns File content when file exists.
     */
    private async readOptionalFile(filePath: string): Promise<string | undefined> {
        const fileSystemPath = resolveFileSystemPath(this.repositoryRootPath, filePath)

        try {
            return await this.readFile(fileSystemPath)
        } catch (error: unknown) {
            if (isFileNotFoundError(error)) {
                return undefined
            }

            throw new AstGoImportResolverError(
                AST_GO_IMPORT_RESOLVER_ERROR_CODE.GO_MOD_READ_FAILED,
                {
                    goModPath: filePath,
                    reason: normalizeErrorReason(error),
                },
            )
        }
    }

    /**
     * Resolves workspace package roots from explicit options or discovery.
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
        const entryNames = await this.readOptionalDirectory(
            workspaceDirectoryPath,
            AST_GO_IMPORT_RESOLVER_ERROR_CODE.GO_MOD_DISCOVERY_FAILED,
        )
        const workspacePackageRoots = new Set<string>()

        for (const entryName of entryNames) {
            const normalizedEntryName = normalizeText(entryName)
            if (normalizedEntryName.length === 0 || normalizedEntryName.startsWith(".")) {
                continue
            }

            workspacePackageRoots.add(pathPosix.join(DEFAULT_WORKSPACES_DIRECTORY, normalizedEntryName))
        }

        return [...workspacePackageRoots]
    }

    /**
     * Resolves file candidates for one package directory.
     *
     * @param packageDirectoryPath Package directory path.
     * @param fileExtensionCandidates Extension candidates from base resolver.
     * @returns Candidate file paths.
     */
    private async resolveFileCandidatesForPackageDirectory(
        packageDirectoryPath: string,
        fileExtensionCandidates: readonly string[],
    ): Promise<readonly string[]> {
        const candidates = new Set<string>()
        addCandidates(
            candidates,
            buildDirectFileCandidates(packageDirectoryPath, fileExtensionCandidates),
        )

        const directoryEntries = await this.readOptionalPackageDirectoryEntries(packageDirectoryPath)
        addCandidates(
            candidates,
            buildDirectoryFileCandidates(
                packageDirectoryPath,
                directoryEntries,
                fileExtensionCandidates,
            ),
        )

        return [...candidates]
    }

    /**
     * Reads package directory entries with promise-level cache.
     *
     * @param packageDirectoryPath Package directory path.
     * @returns Directory entries.
     */
    private async readOptionalPackageDirectoryEntries(
        packageDirectoryPath: string,
    ): Promise<readonly string[]> {
        const cachedEntriesPromise = this.packageDirectoryEntriesByPath.get(packageDirectoryPath)
        if (cachedEntriesPromise !== undefined) {
            return cachedEntriesPromise
        }

        const entriesPromise = this.readOptionalDirectory(
            resolveFileSystemPath(this.repositoryRootPath, packageDirectoryPath),
            AST_GO_IMPORT_RESOLVER_ERROR_CODE.GO_PACKAGE_DISCOVERY_FAILED,
        )
        this.packageDirectoryEntriesByPath.set(packageDirectoryPath, entriesPromise)
        return entriesPromise
    }

    /**
     * Reads optional directory entries and normalizes them.
     *
     * @param directoryPath File-system directory path.
     * @param errorCode Error code used for non-ENOENT failures.
     * @returns Directory entry names.
     */
    private async readOptionalDirectory(
        directoryPath: string,
        errorCode:
            | typeof AST_GO_IMPORT_RESOLVER_ERROR_CODE.GO_MOD_DISCOVERY_FAILED
            | typeof AST_GO_IMPORT_RESOLVER_ERROR_CODE.GO_PACKAGE_DISCOVERY_FAILED,
    ): Promise<readonly string[]> {
        try {
            const entries = await this.readDirectory(directoryPath)
            return normalizeDirectoryEntries(entries)
        } catch (error: unknown) {
            if (isFileNotFoundError(error)) {
                return []
            }

            throw new AstGoImportResolverError(errorCode, {
                packageDirectoryPath: directoryPath,
                reason: normalizeErrorReason(error),
            })
        }
    }
}

/**
 * Resolves base resolver options with Go file-extension defaults and retry behavior.
 *
 * @param options Resolver options.
 * @returns Base resolver options.
 */
function resolveBaseImportResolverOptions(
    options: IAstGoImportResolverOptions,
): IAstBaseImportResolverOptions {
    return {
        ...options,
        fileExtensionCandidates:
            options.fileExtensionCandidates ?? DEFAULT_GO_FILE_EXTENSION_CANDIDATES,
        retryPolicy: resolveRetryPolicy(options.retryPolicy),
    }
}

/**
 * Wraps retry classifier to surface typed Go resolver errors.
 *
 * @param retryPolicy Optional retry policy.
 * @returns Retry policy with typed-error passthrough.
 */
function resolveRetryPolicy(
    retryPolicy: IAstBaseImportResolverRetryPolicy | undefined,
): IAstBaseImportResolverRetryPolicy {
    return {
        ...retryPolicy,
        shouldRetry: createShouldRetry(retryPolicy?.shouldRetry),
    }
}

/**
 * Creates retry classifier that rethrows typed resolver errors.
 *
 * @param baseShouldRetry Optional upstream retry classifier.
 * @returns Retry classifier used by base resolver.
 */
function createShouldRetry(
    baseShouldRetry: AstBaseImportResolverShouldRetry | undefined,
): AstBaseImportResolverShouldRetry {
    return (error: unknown, attempt: number): boolean => {
        if (error instanceof AstGoImportResolverError) {
            throw error
        }

        if (baseShouldRetry !== undefined) {
            return baseShouldRetry(error, attempt)
        }

        return true
    }
}

/**
 * Resolves package directory candidates using module mappings from go.mod snapshots.
 *
 * @param importPath Normalized import path.
 * @param goModuleSnapshots Parsed go module snapshots.
 * @returns Candidate package directories.
 */
function resolveGoModulePackageDirectories(
    importPath: string,
    goModuleSnapshots: readonly IGoModuleSnapshot[],
): readonly string[] {
    const packageDirectories = new Set<string>()
    const pendingImportPaths = [importPath]
    const visitedImportPaths = new Set<string>()

    while (pendingImportPaths.length > 0) {
        const currentImportPath = pendingImportPaths.shift()
        if (currentImportPath === undefined || visitedImportPaths.has(currentImportPath)) {
            continue
        }

        visitedImportPaths.add(currentImportPath)
        if (visitedImportPaths.size > GO_REPLACE_RESOLUTION_DEPTH_LIMIT) {
            break
        }

        for (const goModuleSnapshot of goModuleSnapshots) {
            addCandidates(
                packageDirectories,
                resolveModuleOwnedPackageDirectories(currentImportPath, goModuleSnapshot),
            )
            addCandidates(
                packageDirectories,
                resolveLocalReplacePackageDirectories(currentImportPath, goModuleSnapshot),
            )
            appendPendingImportPaths(
                pendingImportPaths,
                resolveModulePathRewrites(currentImportPath, goModuleSnapshot),
            )
        }
    }

    return [...packageDirectories]
}

/**
 * Resolves package directories owned by one module snapshot.
 *
 * @param importPath Normalized import path.
 * @param goModuleSnapshot Go module snapshot.
 * @returns Candidate package directories.
 */
function resolveModuleOwnedPackageDirectories(
    importPath: string,
    goModuleSnapshot: IGoModuleSnapshot,
): readonly string[] {
    const moduleSubPath = resolveModuleSubPath(importPath, goModuleSnapshot.modulePath)
    if (moduleSubPath === undefined) {
        return []
    }

    return [joinRelativePath(goModuleSnapshot.moduleRootPath, moduleSubPath)]
}

/**
 * Resolves package directories from local-path replace directives.
 *
 * @param importPath Normalized import path.
 * @param goModuleSnapshot Go module snapshot.
 * @returns Candidate package directories.
 */
function resolveLocalReplacePackageDirectories(
    importPath: string,
    goModuleSnapshot: IGoModuleSnapshot,
): readonly string[] {
    const packageDirectories = new Set<string>()

    for (const replaceDirective of goModuleSnapshot.replaceDirectives) {
        if (replaceDirective.target.kind !== "local-path") {
            continue
        }

        const replacedSubPath = resolveModuleSubPath(importPath, replaceDirective.sourceModulePath)
        if (replacedSubPath === undefined) {
            continue
        }

        addCandidates(
            packageDirectories,
            [joinRelativePath(replaceDirective.target.localPath, replacedSubPath)],
        )
    }

    return [...packageDirectories]
}

/**
 * Resolves module-path rewrites for replace directives.
 *
 * @param importPath Normalized import path.
 * @param goModuleSnapshot Go module snapshot.
 * @returns Rewritten import paths.
 */
function resolveModulePathRewrites(
    importPath: string,
    goModuleSnapshot: IGoModuleSnapshot,
): readonly string[] {
    const rewrittenImportPaths = new Set<string>()

    for (const replaceDirective of goModuleSnapshot.replaceDirectives) {
        if (replaceDirective.target.kind !== "module-path") {
            continue
        }

        const replacedSubPath = resolveModuleSubPath(importPath, replaceDirective.sourceModulePath)
        if (replacedSubPath === undefined) {
            continue
        }

        rewrittenImportPaths.add(joinGoImportPath(replaceDirective.target.modulePath, replacedSubPath))
    }

    return [...rewrittenImportPaths]
}

/**
 * Resolves sub-path from one full import path by module path prefix.
 *
 * @param importPath Full import path.
 * @param modulePath Module path prefix.
 * @returns Module-relative sub-path when prefix matches.
 */
function resolveModuleSubPath(importPath: string, modulePath: string): string | undefined {
    if (importPath === modulePath) {
        return ""
    }

    const modulePrefix = `${modulePath}/`
    if (importPath.startsWith(modulePrefix) === false) {
        return undefined
    }

    return importPath.slice(modulePrefix.length)
}

/**
 * Joins module import path and sub-path.
 *
 * @param modulePath Module import path.
 * @param moduleSubPath Module sub-path.
 * @returns Joined import path.
 */
function joinGoImportPath(modulePath: string, moduleSubPath: string): string {
    if (moduleSubPath.length === 0) {
        return modulePath
    }

    return `${modulePath}/${moduleSubPath}`
}

/**
 * Builds fallback package directories for imports outside known module map.
 *
 * @param importPath Normalized import path.
 * @param workspacePackageRoots Workspace package roots.
 * @param sourceDirectoryCandidates Source directory candidates.
 * @returns Candidate package directories.
 */
function resolveFallbackPackageDirectories(
    importPath: string,
    workspacePackageRoots: readonly string[],
    sourceDirectoryCandidates: readonly string[],
): readonly string[] {
    const directories = new Set<string>()
    addCandidates(directories, [importPath])

    for (const sourceDirectoryCandidate of sourceDirectoryCandidates) {
        addCandidates(directories, [joinRelativePath(sourceDirectoryCandidate, importPath)])
    }

    for (const workspacePackageRoot of workspacePackageRoots) {
        addCandidates(directories, [joinRelativePath(workspacePackageRoot, importPath)])

        for (const sourceDirectoryCandidate of sourceDirectoryCandidates) {
            const workspaceSourceDirectory = joinRelativePath(
                workspacePackageRoot,
                sourceDirectoryCandidate,
            )
            addCandidates(
                directories,
                [joinRelativePath(workspaceSourceDirectory, importPath)],
            )
        }
    }

    return [...directories]
}

/**
 * Builds direct file candidates from package path (`pkg/foo` -> `pkg/foo.go`).
 *
 * @param packageDirectoryPath Package directory path.
 * @param fileExtensionCandidates Extension candidates.
 * @returns Direct file candidates.
 */
function buildDirectFileCandidates(
    packageDirectoryPath: string,
    fileExtensionCandidates: readonly string[],
): readonly string[] {
    const normalizedPackageDirectoryPath = normalizeRepositoryRelativePath(packageDirectoryPath)
    if (normalizedPackageDirectoryPath.length === 0) {
        return []
    }

    const fileCandidates = new Set<string>()
    for (const extension of fileExtensionCandidates) {
        fileCandidates.add(`${normalizedPackageDirectoryPath}${extension}`)
    }

    return [...fileCandidates]
}

/**
 * Builds directory-based file candidates for one package.
 *
 * @param packageDirectoryPath Package directory path.
 * @param directoryEntries Directory entries.
 * @param fileExtensionCandidates Extension candidates.
 * @returns Directory file candidates.
 */
function buildDirectoryFileCandidates(
    packageDirectoryPath: string,
    directoryEntries: readonly string[],
    fileExtensionCandidates: readonly string[],
): readonly string[] {
    const normalizedPackageDirectoryPath = normalizeRepositoryRelativePath(packageDirectoryPath)
    if (normalizedPackageDirectoryPath.length === 0 || directoryEntries.length === 0) {
        return []
    }

    const extensionSet = new Set(fileExtensionCandidates)
    const sourceFileEntries = directoryEntries.filter((entry) =>
        isSupportedGoSourceFile(entry, extensionSet),
    )
    sourceFileEntries.sort(compareGoSourceEntries)

    const fileCandidates = new Set<string>()
    for (const sourceFileEntry of sourceFileEntries) {
        fileCandidates.add(joinRelativePath(normalizedPackageDirectoryPath, sourceFileEntry))
    }

    return [...fileCandidates]
}

/**
 * Compares Go source file entries so non-test files come before test files.
 *
 * @param left Left file name.
 * @param right Right file name.
 * @returns Sort compare result.
 */
function compareGoSourceEntries(left: string, right: string): number {
    const leftIsTestFile = isGoTestFile(left)
    const rightIsTestFile = isGoTestFile(right)

    if (leftIsTestFile !== rightIsTestFile) {
        return leftIsTestFile ? 1 : -1
    }

    return left.localeCompare(right)
}

/**
 * Checks whether one file entry is supported Go source candidate.
 *
 * @param fileName File entry name.
 * @param extensionSet Allowed extensions.
 * @returns True when entry is a source file candidate.
 */
function isSupportedGoSourceFile(fileName: string, extensionSet: ReadonlySet<string>): boolean {
    const extension = pathPosix.extname(fileName)
    if (extensionSet.has(extension) === false) {
        return false
    }

    return fileName.includes("/") === false
}

/**
 * Checks whether one Go file name represents a test file.
 *
 * @param fileName File entry name.
 * @returns True when file name ends with `_test.go`.
 */
function isGoTestFile(fileName: string): boolean {
    return fileName.endsWith("_test.go")
}

/**
 * Parses one go.mod file.
 *
 * @param source go.mod source.
 * @param goModPath go.mod file path.
 * @returns Parsed go.mod document.
 */
function parseGoModDocument(source: string, goModPath: string): IParsedGoModDocument {
    const lines = source.split(/\r?\n/)
    let modulePath: string | undefined
    let isInsideReplaceBlock = false
    const replaceDirectives: IParsedGoModReplaceDirective[] = []

    for (const rawLine of lines) {
        const line = normalizeText(stripGoModLineComment(rawLine))
        if (line.length === 0) {
            continue
        }

        if (isInsideReplaceBlock) {
            if (line === ")") {
                isInsideReplaceBlock = false
                continue
            }

            replaceDirectives.push(parseGoModReplaceDirective(line, goModPath))
            continue
        }

        if (line.startsWith("module ")) {
            modulePath = parseGoModModulePath(line, goModPath)
            continue
        }

        if (line === "replace (" || line.startsWith("replace (")) {
            isInsideReplaceBlock = true
            continue
        }

        if (line.startsWith("replace ")) {
            replaceDirectives.push(
                parseGoModReplaceDirective(line.slice("replace ".length), goModPath),
            )
        }
    }

    if (modulePath === undefined) {
        throw new AstGoImportResolverError(AST_GO_IMPORT_RESOLVER_ERROR_CODE.INVALID_GO_MOD, {
            goModPath,
        })
    }

    return {
        modulePath,
        replaceDirectives,
    }
}

/**
 * Parses go.mod module path directive.
 *
 * @param line Normalized `module ...` line.
 * @param goModPath go.mod file path.
 * @returns Normalized module path.
 */
function parseGoModModulePath(line: string, goModPath: string): string {
    const modulePath = normalizeGoModulePath(line.slice("module ".length))
    if (modulePath === undefined) {
        throw new AstGoImportResolverError(AST_GO_IMPORT_RESOLVER_ERROR_CODE.INVALID_GO_MOD, {
            goModPath,
        })
    }

    return modulePath
}

/**
 * Parses one go.mod replace directive line.
 *
 * @param replaceDirectiveSource Source after optional `replace ` prefix.
 * @param goModPath go.mod file path.
 * @returns Parsed replace directive.
 */
function parseGoModReplaceDirective(
    replaceDirectiveSource: string,
    goModPath: string,
): IParsedGoModReplaceDirective {
    const arrowIndex = replaceDirectiveSource.indexOf("=>")
    if (arrowIndex < 0) {
        throw new AstGoImportResolverError(AST_GO_IMPORT_RESOLVER_ERROR_CODE.INVALID_GO_MOD, {
            goModPath,
        })
    }

    const sourcePart = replaceDirectiveSource.slice(0, arrowIndex).trim()
    const targetPart = replaceDirectiveSource.slice(arrowIndex + 2).trim()
    const sourceModulePath = parseGoModReplaceModulePath(sourcePart, goModPath)
    const target = parseGoModReplaceTarget(targetPart, goModPath)

    return {
        sourceModulePath,
        target,
    }
}

/**
 * Parses module side of one replace directive.
 *
 * @param sourcePart Source replace part.
 * @param goModPath go.mod file path.
 * @returns Parsed source module path.
 */
function parseGoModReplaceModulePath(sourcePart: string, goModPath: string): string {
    const sourceTokens = sourcePart.split(/\s+/)
    const sourceModulePath = normalizeGoModulePath(sourceTokens[0] ?? "")
    if (sourceModulePath === undefined) {
        throw new AstGoImportResolverError(AST_GO_IMPORT_RESOLVER_ERROR_CODE.INVALID_GO_MOD, {
            goModPath,
        })
    }

    return sourceModulePath
}

/**
 * Parses target side of one replace directive.
 *
 * @param targetPart Target replace part.
 * @param goModPath go.mod file path.
 * @returns Parsed target string.
 */
function parseGoModReplaceTarget(targetPart: string, goModPath: string): string {
    const targetTokens = targetPart.split(/\s+/)
    const targetToken = normalizeText(targetTokens[0] ?? "")
    if (targetToken.length === 0) {
        throw new AstGoImportResolverError(AST_GO_IMPORT_RESOLVER_ERROR_CODE.INVALID_GO_MOD, {
            goModPath,
        })
    }

    return targetToken
}

/**
 * Creates one normalized go module snapshot.
 *
 * @param parsedGoModDocument Parsed go.mod document.
 * @param goModPath go.mod file path.
 * @param repositoryRootPath Repository root path.
 * @returns Go module snapshot.
 */
function createGoModuleSnapshot(
    parsedGoModDocument: IParsedGoModDocument,
    goModPath: string,
    repositoryRootPath: string,
): IGoModuleSnapshot {
    const moduleRootPath = resolveDirectoryPath(goModPath)
    const replaceDirectives = parsedGoModDocument.replaceDirectives
        .map((replaceDirective) =>
            normalizeGoModuleReplaceDirective(
                replaceDirective,
                moduleRootPath,
                repositoryRootPath,
            ),
        )
        .filter((replaceDirective): replaceDirective is IGoModuleReplaceDirective => {
            return replaceDirective !== undefined
        })

    return {
        modulePath: parsedGoModDocument.modulePath,
        moduleRootPath,
        replaceDirectives,
    }
}

/**
 * Normalizes one parsed replace directive.
 *
 * @param parsedReplaceDirective Parsed replace directive.
 * @param moduleRootPath Module root path.
 * @param repositoryRootPath Repository root path.
 * @returns Normalized replace directive.
 */
function normalizeGoModuleReplaceDirective(
    parsedReplaceDirective: IParsedGoModReplaceDirective,
    moduleRootPath: string,
    repositoryRootPath: string,
): IGoModuleReplaceDirective | undefined {
    const sourceModulePath = parsedReplaceDirective.sourceModulePath
    const normalizedTarget = normalizeGoModuleReplaceTarget(
        parsedReplaceDirective.target,
        moduleRootPath,
        repositoryRootPath,
    )
    if (normalizedTarget === undefined) {
        return undefined
    }

    return {
        sourceModulePath,
        target: normalizedTarget,
    }
}

/**
 * Normalizes one replace target.
 *
 * @param target Parsed replace target.
 * @param moduleRootPath Module root path.
 * @param repositoryRootPath Repository root path.
 * @returns Normalized replace target.
 */
function normalizeGoModuleReplaceTarget(
    target: string,
    moduleRootPath: string,
    repositoryRootPath: string,
): IGoModuleReplaceTarget | undefined {
    if (isGoReplaceLocalPathTarget(target)) {
        return normalizeGoReplaceLocalPathTarget(target, moduleRootPath, repositoryRootPath)
    }

    const modulePath = normalizeGoModulePath(target)
    if (modulePath === undefined) {
        return undefined
    }

    return {
        kind: "module-path",
        modulePath,
    }
}

/**
 * Checks whether one replace target looks like local file-system path.
 *
 * @param target Replace target.
 * @returns True when target is local file path.
 */
function isGoReplaceLocalPathTarget(target: string): boolean {
    return target.startsWith(".") || target.startsWith("/")
}

/**
 * Normalizes local file-system replace target.
 *
 * @param target Replace target.
 * @param moduleRootPath Module root path.
 * @param repositoryRootPath Repository root path.
 * @returns Normalized local-path replace target.
 */
function normalizeGoReplaceLocalPathTarget(
    target: string,
    moduleRootPath: string,
    repositoryRootPath: string,
): IGoModuleReplaceTargetLocalPath | undefined {
    if (target.startsWith("/")) {
        const repositoryRelativePath = toRepositoryRelativePath(target, repositoryRootPath)
        if (repositoryRelativePath === undefined) {
            return undefined
        }

        return {
            kind: "local-path",
            localPath: repositoryRelativePath,
        }
    }

    return {
        kind: "local-path",
        localPath: joinRelativePath(moduleRootPath, target),
    }
}

/**
 * Converts absolute path to repository-relative path when possible.
 *
 * @param absolutePath Absolute path candidate.
 * @param repositoryRootPath Repository root path.
 * @returns Repository-relative path when possible.
 */
function toRepositoryRelativePath(
    absolutePath: string,
    repositoryRootPath: string,
): string | undefined {
    if (pathPosix.isAbsolute(repositoryRootPath) === false) {
        return undefined
    }

    const normalizedAbsolutePath = pathPosix.normalize(absolutePath)
    const normalizedRepositoryRootPath = pathPosix.normalize(repositoryRootPath)
    const repositoryRootPrefix = `${normalizedRepositoryRootPath}/`

    if (normalizedAbsolutePath.startsWith(repositoryRootPrefix) === false) {
        return undefined
    }

    return normalizeRepositoryRelativePath(
        normalizedAbsolutePath.slice(repositoryRootPrefix.length),
    )
}

/**
 * Strips trailing line comment from one go.mod line.
 *
 * @param line Raw go.mod line.
 * @returns Line without trailing `// ...` comment.
 */
function stripGoModLineComment(line: string): string {
    const commentIndex = line.indexOf("//")
    if (commentIndex < 0) {
        return line
    }

    return line.slice(0, commentIndex)
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
        throw new AstGoImportResolverError(
            AST_GO_IMPORT_RESOLVER_ERROR_CODE.INVALID_REPOSITORY_ROOT_PATH,
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
            throw new AstGoImportResolverError(
                AST_GO_IMPORT_RESOLVER_ERROR_CODE.INVALID_WORKSPACE_PACKAGE_ROOT,
                {
                    workspacePackageRoot,
                },
            )
        }

        try {
            normalizedRoots.add(FilePath.create(pathPosix.normalize(normalizedRoot)).toString())
        } catch {
            throw new AstGoImportResolverError(
                AST_GO_IMPORT_RESOLVER_ERROR_CODE.INVALID_WORKSPACE_PACKAGE_ROOT,
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
function validateReadFile(readFileFn: AstGoImportResolverReadFile | undefined): AstGoImportResolverReadFile {
    if (readFileFn === undefined) {
        return defaultReadFile
    }

    if (typeof readFileFn !== "function") {
        throw new AstGoImportResolverError(AST_GO_IMPORT_RESOLVER_ERROR_CODE.INVALID_READ_FILE)
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
    readDirectoryFn: AstGoImportResolverReadDirectory | undefined,
): AstGoImportResolverReadDirectory {
    if (readDirectoryFn === undefined) {
        return defaultReadDirectory
    }

    if (typeof readDirectoryFn !== "function") {
        throw new AstGoImportResolverError(
            AST_GO_IMPORT_RESOLVER_ERROR_CODE.INVALID_READ_DIRECTORY,
        )
    }

    return readDirectoryFn
}

/**
 * Normalizes one Go module path.
 *
 * @param modulePath Raw module path.
 * @returns Normalized module path.
 */
function normalizeGoModulePath(modulePath: string): string | undefined {
    const normalizedModulePath = normalizeText(modulePath)
    if (normalizedModulePath.length === 0) {
        return undefined
    }

    if (normalizedModulePath.includes(" ") || normalizedModulePath.includes("=>")) {
        return undefined
    }

    return normalizedModulePath
}

/**
 * Normalizes one Go import path.
 *
 * @param importSource Raw import source.
 * @returns Normalized import path.
 */
function normalizeGoImportPath(importSource: string): string | undefined {
    const normalizedImportSource = normalizeText(importSource)
    if (normalizedImportSource.length === 0) {
        return undefined
    }

    const unquotedImportSource = stripOnePairOfMatchingQuotes(normalizedImportSource)
    if (unquotedImportSource.length === 0) {
        return undefined
    }

    if (unquotedImportSource.includes(" ")) {
        return undefined
    }

    return unquotedImportSource
}

/**
 * Strips one pair of matching quote characters.
 *
 * @param value Source value.
 * @returns Unquoted value when wrapped with matching quotes.
 */
function stripOnePairOfMatchingQuotes(value: string): string {
    if (value.length < 2) {
        return value
    }

    const firstChar = value.charAt(0)
    const lastChar = value.charAt(value.length - 1)
    const isQuoted =
        (firstChar === "\"" && lastChar === "\"") ||
        (firstChar === "'" && lastChar === "'") ||
        (firstChar === "`" && lastChar === "`")
    if (isQuoted === false) {
        return value
    }

    return value.slice(1, -1)
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
 * @param left Left path segment.
 * @param right Right path segment.
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
 * Appends import paths to pending queue.
 *
 * @param pendingImportPaths Pending import paths queue.
 * @param importPaths Import paths to append.
 */
function appendPendingImportPaths(
    pendingImportPaths: string[],
    importPaths: readonly string[],
): void {
    for (const importPath of importPaths) {
        pendingImportPaths.push(importPath)
    }
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
 * Normalizes text value.
 *
 * @param value Raw value.
 * @returns Trimmed and slash-normalized value.
 */
function normalizeText(value: string): string {
    return value.trim().replaceAll("\\", "/")
}

/**
 * Normalizes directory entries returned by readDirectory.
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
 * Checks whether unknown value is plain object.
 *
 * @param value Unknown value.
 * @returns True when value is plain object.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && Array.isArray(value) === false
}

/**
 * Default file reader.
 *
 * @param filePath File path.
 * @returns UTF-8 file content.
 */
function defaultReadFile(filePath: string): Promise<string> {
    return readFile(filePath, "utf-8")
}

/**
 * Default directory reader.
 *
 * @param directoryPath Directory path.
 * @returns Directory entry names.
 */
function defaultReadDirectory(directoryPath: string): Promise<readonly string[]> {
    return readdir(directoryPath)
}
