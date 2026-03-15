import {readdir} from "node:fs/promises"
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
    AST_PYTHON_IMPORT_RESOLVER_ERROR_CODE,
    AstPythonImportResolverError,
} from "./ast-python-import-resolver.error"

const DEFAULT_REPOSITORY_ROOT_PATH = "."
const DEFAULT_PYTHON_FILE_EXTENSION_CANDIDATES = [".py", ".pyi"] as const
const DEFAULT_SOURCE_DIRECTORY_CANDIDATES = ["src"] as const
const DEFAULT_WORKSPACES_DIRECTORY = "packages"
const PYTHON_INIT_MODULE_NAME = "__init__"

/**
 * Reads one directory and returns direct child entry names.
 */
export type AstPythonImportResolverReadDirectory = (
    directoryPath: string,
) => Promise<readonly string[]>

/**
 * Runtime options for Python import resolver.
 */
export interface IAstPythonImportResolverOptions extends IAstBaseImportResolverOptions {
    /**
     * Repository root path used to discover workspace roots.
     */
    readonly repositoryRootPath?: string

    /**
     * Explicit PYTHONPATH roots in repository-relative format.
     */
    readonly pythonPathRoots?: readonly string[]

    /**
     * Explicit workspace package roots.
     */
    readonly workspacePackageRoots?: readonly string[]

    /**
     * Optional PYTHONPATH environment override.
     */
    readonly pythonPathEnvironment?: string

    /**
     * Optional custom directory reader.
     */
    readonly readDirectory?: AstPythonImportResolverReadDirectory

    /**
     * Optional source directory candidates used under repository and workspace roots.
     */
    readonly sourceDirectoryCandidates?: readonly string[]
}

interface IParsedRelativeImport {
    readonly level: number
    readonly modulePath: string | undefined
}

/**
 * Python import resolver with `__init__.py` and PYTHONPATH-aware lookup strategy.
 */
export class AstPythonImportResolver extends AstBaseImportResolver {
    private readonly repositoryRootPath: string
    private readonly explicitPythonPathRoots: readonly string[]
    private readonly explicitWorkspacePackageRoots: readonly string[]
    private readonly hasExplicitWorkspacePackageRoots: boolean
    private readonly pythonPathEnvironment: string | undefined
    private readonly readDirectory: AstPythonImportResolverReadDirectory
    private readonly sourceDirectoryCandidates: readonly string[]
    private discoveredWorkspacePackageRootsPromise: Promise<readonly string[]> | undefined
    private searchRootsPromise: Promise<readonly string[]> | undefined

    /**
     * Creates Python import resolver.
     *
     * @param options Optional runtime configuration.
     */
    public constructor(options: IAstPythonImportResolverOptions = {}) {
        super(resolveBaseImportResolverOptions(options))

        this.repositoryRootPath = normalizeRepositoryRootPath(
            options.repositoryRootPath ?? DEFAULT_REPOSITORY_ROOT_PATH,
        )
        this.explicitPythonPathRoots = normalizePythonPathRoots(
            options.pythonPathRoots ?? [],
            this.repositoryRootPath,
            false,
        )
        this.explicitWorkspacePackageRoots = normalizeWorkspacePackageRoots(
            options.workspacePackageRoots ?? [],
        )
        this.hasExplicitWorkspacePackageRoots = options.workspacePackageRoots !== undefined
        this.pythonPathEnvironment = normalizeOptionalText(options.pythonPathEnvironment)
        this.readDirectory = validateReadDirectory(options.readDirectory)
        this.sourceDirectoryCandidates = normalizeSourceDirectoryCandidates(
            options.sourceDirectoryCandidates ?? DEFAULT_SOURCE_DIRECTORY_CANDIDATES,
        )
    }

    /**
     * Resolves candidate paths for one Python import source.
     *
     * @param input Normalized non-relative import payload.
     * @returns Candidate target paths.
     */
    protected async resolveNonRelativeCandidates(
        input: IAstBaseNonRelativeImportResolutionInput,
    ): Promise<readonly string[]> {
        const relativeImport = parseRelativeImportSource(input.importSource)
        if (relativeImport !== undefined) {
            return resolveRelativeImportCandidates(
                input.sourceDirectoryPath,
                relativeImport,
                input.fileExtensionCandidates,
            )
        }

        const modulePath = normalizePythonModulePath(input.importSource)
        if (modulePath === undefined) {
            return []
        }

        const searchRoots = await this.resolveSearchRoots()
        const candidates = new Set<string>()
        for (const searchRoot of searchRoots) {
            const moduleBasePath = joinRelativePath(searchRoot, modulePath)
            addCandidates(
                candidates,
                buildPythonModuleCandidates(moduleBasePath, input.fileExtensionCandidates),
            )
        }

        return [...candidates]
    }

    /**
     * Returns cached search roots used for non-relative imports.
     *
     * @returns Search roots.
     */
    private async resolveSearchRoots(): Promise<readonly string[]> {
        if (this.searchRootsPromise === undefined) {
            this.searchRootsPromise = this.loadSearchRoots()
        }

        return this.searchRootsPromise
    }

    /**
     * Resolves search roots from repository, PYTHONPATH and workspace package roots.
     *
     * @returns Search roots.
     */
    private async loadSearchRoots(): Promise<readonly string[]> {
        const workspacePackageRoots = await this.resolveWorkspacePackageRoots()
        const searchRoots = new Set<string>([""])

        addCandidates(searchRoots, this.sourceDirectoryCandidates)
        addCandidates(searchRoots, this.explicitPythonPathRoots)
        addCandidates(
            searchRoots,
            normalizePythonPathRoots(
                parsePythonPathEnvironment(this.pythonPathEnvironment),
                this.repositoryRootPath,
                true,
            ),
        )
        addCandidates(searchRoots, workspacePackageRoots)

        for (const workspacePackageRoot of workspacePackageRoots) {
            for (const sourceDirectoryCandidate of this.sourceDirectoryCandidates) {
                addCandidates(
                    searchRoots,
                    [joinRelativePath(workspacePackageRoot, sourceDirectoryCandidate)],
                )
            }
        }

        return [...searchRoots]
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
        const entryNames = await this.readOptionalDirectory(workspaceDirectoryPath)
        const discoveredRoots = new Set<string>()

        for (const entryName of entryNames) {
            const normalizedEntryName = normalizeText(entryName)
            if (normalizedEntryName.length === 0 || normalizedEntryName.startsWith(".")) {
                continue
            }

            discoveredRoots.add(pathPosix.join(DEFAULT_WORKSPACES_DIRECTORY, normalizedEntryName))
        }

        return [...discoveredRoots]
    }

    /**
     * Reads one optional directory and returns direct child names.
     *
     * @param directoryPath File-system directory path.
     * @returns Directory entry names.
     */
    private async readOptionalDirectory(directoryPath: string): Promise<readonly string[]> {
        try {
            const entries = await this.readDirectory(directoryPath)
            return normalizeDirectoryEntries(entries)
        } catch (error: unknown) {
            if (isFileNotFoundError(error)) {
                return []
            }

            throw new AstPythonImportResolverError(
                AST_PYTHON_IMPORT_RESOLVER_ERROR_CODE.PYTHON_PATH_DISCOVERY_FAILED,
                {
                    directoryPath,
                    reason: normalizeErrorReason(error),
                },
            )
        }
    }
}

/**
 * Resolves base-resolver options with Python-specific file extensions and retry behavior.
 *
 * @param options Resolver options.
 * @returns Base resolver options.
 */
function resolveBaseImportResolverOptions(
    options: IAstPythonImportResolverOptions,
): IAstBaseImportResolverOptions {
    return {
        ...options,
        fileExtensionCandidates:
            options.fileExtensionCandidates ?? DEFAULT_PYTHON_FILE_EXTENSION_CANDIDATES,
        retryPolicy: resolveRetryPolicy(options.retryPolicy),
    }
}

/**
 * Wraps retry classifier to surface Python resolver errors without base-level wrapping.
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
        if (error instanceof AstPythonImportResolverError) {
            throw error
        }

        if (baseShouldRetry !== undefined) {
            return baseShouldRetry(error, attempt)
        }

        return true
    }
}

/**
 * Resolves candidates for Python relative imports (`.foo`, `..bar`).
 *
 * @param sourceDirectoryPath Source directory path.
 * @param relativeImport Parsed relative import.
 * @param fileExtensionCandidates Extension candidates from base resolver.
 * @returns Candidate paths.
 */
function resolveRelativeImportCandidates(
    sourceDirectoryPath: string,
    relativeImport: IParsedRelativeImport,
    fileExtensionCandidates: readonly string[],
): readonly string[] {
    const ancestorPath = resolveAncestorPath(sourceDirectoryPath, relativeImport.level - 1)
    const moduleBasePath =
        relativeImport.modulePath === undefined
            ? ancestorPath
            : joinRelativePath(ancestorPath, relativeImport.modulePath)

    return buildPythonModuleCandidates(moduleBasePath, fileExtensionCandidates)
}

/**
 * Resolves ancestor directory path.
 *
 * @param sourceDirectoryPath Source directory path.
 * @param levelsToParent Number of parent ascents.
 * @returns Ancestor directory path.
 */
function resolveAncestorPath(sourceDirectoryPath: string, levelsToParent: number): string {
    let currentDirectoryPath = normalizeRepositoryRelativePath(sourceDirectoryPath)
    let remainingLevels = levelsToParent

    while (remainingLevels > 0) {
        currentDirectoryPath = resolveParentDirectoryPath(currentDirectoryPath)
        remainingLevels -= 1
    }

    return currentDirectoryPath
}

/**
 * Resolves parent directory path.
 *
 * @param directoryPath Directory path.
 * @returns Parent directory path.
 */
function resolveParentDirectoryPath(directoryPath: string): string {
    if (directoryPath.length === 0) {
        return ""
    }

    const parentDirectoryPath = pathPosix.dirname(directoryPath)
    return parentDirectoryPath === "." ? "" : normalizeRepositoryRelativePath(parentDirectoryPath)
}

/**
 * Parses one Python relative import source.
 *
 * @param importSource Raw import source.
 * @returns Parsed relative import when source starts with dots.
 */
function parseRelativeImportSource(importSource: string): IParsedRelativeImport | undefined {
    if (importSource.startsWith(".") === false) {
        return undefined
    }

    const trimmedImportSource = importSource.trim()
    let level = 0

    while (trimmedImportSource.charAt(level) === ".") {
        level += 1
    }

    const moduleSource = trimmedImportSource.slice(level)
    const modulePath =
        moduleSource.length === 0 ? undefined : normalizePythonModulePath(moduleSource)
    if (moduleSource.length > 0 && modulePath === undefined) {
        return undefined
    }

    return {
        level,
        modulePath,
    }
}

/**
 * Normalizes Python import source to module path.
 *
 * @param importSource Raw import source.
 * @returns Repository-relative module path.
 */
function normalizePythonModulePath(importSource: string): string | undefined {
    const normalizedImportSource = normalizeText(importSource)
    if (normalizedImportSource.length === 0) {
        return undefined
    }

    const moduleSegments = normalizedImportSource
        .replaceAll("/", ".")
        .split(".")
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0)
    if (moduleSegments.length === 0) {
        return undefined
    }

    const hasInvalidSegments = moduleSegments.some(
        (segment) => PYTHON_MODULE_SEGMENT_PATTERN.test(segment) === false,
    )
    if (hasInvalidSegments) {
        return undefined
    }

    return moduleSegments.join("/")
}

const PYTHON_MODULE_SEGMENT_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/

/**
 * Builds python module candidates including package `__init__` files.
 *
 * @param moduleBasePath Module base path.
 * @param fileExtensionCandidates Extension candidates.
 * @returns Candidate paths.
 */
function buildPythonModuleCandidates(
    moduleBasePath: string,
    fileExtensionCandidates: readonly string[],
): readonly string[] {
    const normalizedModuleBasePath = normalizeRepositoryRelativePath(moduleBasePath)
    if (normalizedModuleBasePath.length === 0) {
        return []
    }

    const hasExtension = pathPosix.extname(normalizedModuleBasePath).length > 0
    const candidates = new Set<string>()

    if (hasExtension) {
        candidates.add(normalizedModuleBasePath)
        return [...candidates]
    }

    for (const extension of fileExtensionCandidates) {
        candidates.add(`${normalizedModuleBasePath}${extension}`)
        candidates.add(
            pathPosix.join(
                normalizedModuleBasePath,
                `${PYTHON_INIT_MODULE_NAME}${extension}`,
            ),
        )
    }

    return [...candidates]
}

/**
 * Parses PYTHONPATH environment value into roots.
 *
 * @param pythonPathEnvironment PYTHONPATH value.
 * @returns Raw python path roots.
 */
function parsePythonPathEnvironment(pythonPathEnvironment: string | undefined): readonly string[] {
    if (pythonPathEnvironment === undefined) {
        const environmentValue = normalizeOptionalText(process.env.PYTHONPATH)
        if (environmentValue === undefined) {
            return []
        }

        return splitPythonPath(environmentValue)
    }

    return splitPythonPath(pythonPathEnvironment)
}

/**
 * Splits PYTHONPATH-like value into path items.
 *
 * @param pythonPath PYTHONPATH-like value.
 * @returns Path items.
 */
function splitPythonPath(pythonPath: string): readonly string[] {
    return pythonPath
        .split(PYTHON_PATH_SEPARATOR_PATTERN)
        .map((item) => normalizeText(item))
        .filter((item) => item.length > 0)
}

const PYTHON_PATH_SEPARATOR_PATTERN = /[:;]/

/**
 * Validates and normalizes PYTHONPATH roots.
 *
 * @param pythonPathRoots Raw PYTHONPATH roots.
 * @param repositoryRootPath Repository root path.
 * @returns Normalized PYTHONPATH roots.
 */
function normalizePythonPathRoots(
    pythonPathRoots: readonly string[],
    repositoryRootPath: string,
    allowExternalAbsolutePaths: boolean,
): readonly string[] {
    const normalizedRoots = new Set<string>()

    for (const pythonPathRoot of pythonPathRoots) {
        const normalizedPathRoot = normalizeText(pythonPathRoot)
        if (normalizedPathRoot.length === 0) {
            continue
        }

        const repositoryRelativeRoot = toRepositoryRelativePath(
            normalizedPathRoot,
            repositoryRootPath,
        )
        if (repositoryRelativeRoot === undefined) {
            if (allowExternalAbsolutePaths && pathPosix.isAbsolute(normalizedPathRoot)) {
                continue
            }

            throw new AstPythonImportResolverError(
                AST_PYTHON_IMPORT_RESOLVER_ERROR_CODE.INVALID_PYTHON_PATH_ROOT,
                {
                    pythonPathRoot,
                },
            )
        }

        normalizedRoots.add(repositoryRelativeRoot)
    }

    return [...normalizedRoots]
}

/**
 * Converts candidate path to repository-relative path when possible.
 *
 * @param candidatePath Candidate path.
 * @param repositoryRootPath Repository root path.
 * @returns Repository-relative path when candidate is valid.
 */
function toRepositoryRelativePath(
    candidatePath: string,
    repositoryRootPath: string,
): string | undefined {
    const normalizedCandidatePath = pathPosix.normalize(candidatePath)

    if (pathPosix.isAbsolute(normalizedCandidatePath) === false) {
        return normalizeRepositoryRelativePath(normalizedCandidatePath)
    }

    if (pathPosix.isAbsolute(repositoryRootPath) === false) {
        return undefined
    }

    const normalizedRepositoryRoot = pathPosix.normalize(repositoryRootPath)
    const repositoryRootPrefix = `${normalizedRepositoryRoot}/`
    if (normalizedCandidatePath.startsWith(repositoryRootPrefix) === false) {
        return undefined
    }

    const repositoryRelativePath = normalizedCandidatePath.slice(repositoryRootPrefix.length)
    return normalizeRepositoryRelativePath(repositoryRelativePath)
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
        throw new AstPythonImportResolverError(
            AST_PYTHON_IMPORT_RESOLVER_ERROR_CODE.INVALID_REPOSITORY_ROOT_PATH,
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
            throw new AstPythonImportResolverError(
                AST_PYTHON_IMPORT_RESOLVER_ERROR_CODE.INVALID_WORKSPACE_PACKAGE_ROOT,
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
            throw new AstPythonImportResolverError(
                AST_PYTHON_IMPORT_RESOLVER_ERROR_CODE.INVALID_WORKSPACE_PACKAGE_ROOT,
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
 * Validates optional readDirectory function.
 *
 * @param readDirectoryFn Optional readDirectory function.
 * @returns ReadDirectory function.
 */
function validateReadDirectory(
    readDirectoryFn: AstPythonImportResolverReadDirectory | undefined,
): AstPythonImportResolverReadDirectory {
    if (readDirectoryFn === undefined) {
        return defaultReadDirectory
    }

    if (typeof readDirectoryFn !== "function") {
        throw new AstPythonImportResolverError(
            AST_PYTHON_IMPORT_RESOLVER_ERROR_CODE.INVALID_READ_DIRECTORY,
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
 * Adds candidate paths to target set.
 *
 * @param targetSet Target set.
 * @param candidates Candidate paths.
 */
function addCandidates(targetSet: Set<string>, candidates: readonly string[]): void {
    for (const candidate of candidates) {
        const normalizedCandidate = normalizeRepositoryRelativePath(candidate)
        targetSet.add(normalizedCandidate)
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
 * Checks whether unknown value is a plain object.
 *
 * @param value Unknown value.
 * @returns True when value is plain object.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && Array.isArray(value) === false
}

/**
 * Default directory reader.
 *
 * @param directoryPath Directory path.
 * @returns Direct child names.
 */
function defaultReadDirectory(directoryPath: string): Promise<readonly string[]> {
    return readdir(directoryPath)
}
