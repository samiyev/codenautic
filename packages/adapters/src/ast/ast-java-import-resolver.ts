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
    AST_JAVA_IMPORT_RESOLVER_ERROR_CODE,
    AstJavaImportResolverError,
} from "./ast-java-import-resolver.error"

const DEFAULT_REPOSITORY_ROOT_PATH = "."
const DEFAULT_WORKSPACES_DIRECTORY = "packages"
const DEFAULT_SOURCE_DIRECTORY_CANDIDATES = ["src/main/java", "src/test/java", "src"] as const
const DEFAULT_JAVA_FILE_EXTENSION_CANDIDATES = [".java"] as const
const POM_FILE_NAME = "pom.xml"
const MODULE_DISCOVERY_LIMIT = 200

/**
 * Reads one UTF-8 file from file system.
 */
export type AstJavaImportResolverReadFile = (filePath: string) => Promise<string>

/**
 * Reads one directory and returns direct child entry names.
 */
export type AstJavaImportResolverReadDirectory = (
    directoryPath: string,
) => Promise<readonly string[]>

/**
 * Runtime options for Java import resolver.
 */
export interface IAstJavaImportResolverOptions extends IAstBaseImportResolverOptions {
    /**
     * Repository root path used to discover `pom.xml` files.
     */
    readonly repositoryRootPath?: string

    /**
     * Explicit workspace package roots used for `pom.xml` lookup.
     */
    readonly workspacePackageRoots?: readonly string[]

    /**
     * Additional classpath roots used before `pom.xml` roots.
     */
    readonly classPathRoots?: readonly string[]

    /**
     * Source directory candidates used for fallback classpath roots.
     */
    readonly sourceDirectoryCandidates?: readonly string[]

    /**
     * Optional custom file reader.
     */
    readonly readFile?: AstJavaImportResolverReadFile

    /**
     * Optional custom directory reader.
     */
    readonly readDirectory?: AstJavaImportResolverReadDirectory
}

interface IParsedJavaImportSource {
    readonly importPath: string
    readonly isWildcard: boolean
}

interface IJavaImportCandidatePath {
    readonly packagePath: string
    readonly isWildcard: boolean
}

interface IParsedPomDocument {
    readonly modulePaths: readonly string[]
    readonly sourceDirectories: readonly string[]
}

interface IJavaPomSnapshot {
    readonly pomPath: string
    readonly moduleRootPath: string
    readonly modulePaths: readonly string[]
    readonly classPathRoots: readonly string[]
}

/**
 * Java import resolver using classpath roots discovered from `pom.xml`.
 */
export class AstJavaImportResolver extends AstBaseImportResolver {
    private readonly repositoryRootPath: string
    private readonly explicitWorkspacePackageRoots: readonly string[]
    private readonly hasExplicitWorkspacePackageRoots: boolean
    private readonly classPathRoots: readonly string[]
    private readonly sourceDirectoryCandidates: readonly string[]
    private readonly readFile: AstJavaImportResolverReadFile
    private readonly readDirectory: AstJavaImportResolverReadDirectory
    private pomSnapshotsPromise: Promise<readonly IJavaPomSnapshot[]> | undefined
    private workspacePackageRootsPromise: Promise<readonly string[]> | undefined
    private readonly packageDirectoryEntriesByPath = new Map<string, Promise<readonly string[]>>()

    /**
     * Creates Java import resolver.
     *
     * @param options Optional runtime configuration.
     */
    public constructor(options: IAstJavaImportResolverOptions = {}) {
        super(resolveBaseImportResolverOptions(options))

        this.repositoryRootPath = normalizeRepositoryRootPath(
            options.repositoryRootPath ?? DEFAULT_REPOSITORY_ROOT_PATH,
        )
        this.explicitWorkspacePackageRoots = normalizeWorkspacePackageRoots(
            options.workspacePackageRoots ?? [],
        )
        this.hasExplicitWorkspacePackageRoots = options.workspacePackageRoots !== undefined
        this.classPathRoots = normalizeClassPathRoots(options.classPathRoots ?? [])
        this.sourceDirectoryCandidates = normalizeSourceDirectoryCandidates(
            options.sourceDirectoryCandidates ?? DEFAULT_SOURCE_DIRECTORY_CANDIDATES,
        )
        this.readFile = validateReadFile(options.readFile)
        this.readDirectory = validateReadDirectory(options.readDirectory)
    }

    /**
     * Resolves candidate file paths for one non-relative Java import source.
     *
     * @param input Normalized non-relative import payload.
     * @returns Candidate file paths.
     */
    protected async resolveNonRelativeCandidates(
        input: IAstBaseNonRelativeImportResolutionInput,
    ): Promise<readonly string[]> {
        const parsedImportSource = parseJavaImportSource(input.importSource)
        if (parsedImportSource === undefined) {
            return []
        }

        const workspacePackageRoots = await this.resolveWorkspacePackageRoots()
        const pomSnapshots = await this.getPomSnapshots()
        const resolvedClassPathRoots = resolveClassPathRoots(
            this.classPathRoots,
            this.sourceDirectoryCandidates,
            workspacePackageRoots,
            pomSnapshots,
        )

        const importCandidatePaths = buildImportCandidatePaths(parsedImportSource)
        const candidates = new Set<string>()

        for (const classPathRoot of resolvedClassPathRoots) {
            for (const importCandidatePath of importCandidatePaths) {
                const packageDirectoryPath = joinRelativePath(
                    classPathRoot,
                    importCandidatePath.packagePath,
                )

                if (importCandidatePath.isWildcard) {
                    addCandidates(
                        candidates,
                        await this.resolveWildcardCandidates(
                            packageDirectoryPath,
                            input.fileExtensionCandidates,
                        ),
                    )
                    continue
                }

                addCandidates(
                    candidates,
                    buildDirectClassCandidates(
                        packageDirectoryPath,
                        input.fileExtensionCandidates,
                    ),
                )
            }
        }

        return [...candidates]
    }

    /**
     * Resolves candidates for one wildcard package import path.
     *
     * @param packageDirectoryPath Package directory path.
     * @param fileExtensionCandidates Extension candidates.
     * @returns Candidate file paths.
     */
    private async resolveWildcardCandidates(
        packageDirectoryPath: string,
        fileExtensionCandidates: readonly string[],
    ): Promise<readonly string[]> {
        const directoryEntries = await this.readPackageDirectoryEntries(packageDirectoryPath)
        return buildWildcardClassCandidates(
            packageDirectoryPath,
            directoryEntries,
            fileExtensionCandidates,
        )
    }

    /**
     * Reads one package directory and caches entry names by path.
     *
     * @param packageDirectoryPath Package directory path.
     * @returns Directory entry names.
     */
    private async readPackageDirectoryEntries(
        packageDirectoryPath: string,
    ): Promise<readonly string[]> {
        const cachedEntriesPromise = this.packageDirectoryEntriesByPath.get(packageDirectoryPath)
        if (cachedEntriesPromise !== undefined) {
            return cachedEntriesPromise
        }

        const directoryPath = resolveFileSystemPath(this.repositoryRootPath, packageDirectoryPath)
        const entriesPromise = this.readOptionalDirectory(
            directoryPath,
            AST_JAVA_IMPORT_RESOLVER_ERROR_CODE.PACKAGE_DISCOVERY_FAILED,
        )
        this.packageDirectoryEntriesByPath.set(packageDirectoryPath, entriesPromise)
        return entriesPromise
    }

    /**
     * Returns cached pom snapshots.
     *
     * @returns pom snapshots.
     */
    private async getPomSnapshots(): Promise<readonly IJavaPomSnapshot[]> {
        if (this.pomSnapshotsPromise === undefined) {
            this.pomSnapshotsPromise = this.loadPomSnapshots()
        }

        return this.pomSnapshotsPromise
    }

    /**
     * Discovers and parses all reachable pom snapshots.
     *
     * @returns pom snapshots.
     */
    private async loadPomSnapshots(): Promise<readonly IJavaPomSnapshot[]> {
        const workspacePackageRoots = await this.resolveWorkspacePackageRoots()
        const pendingPomPaths = [
            POM_FILE_NAME,
            ...workspacePackageRoots.map((workspacePackageRoot) =>
                joinRelativePath(workspacePackageRoot, POM_FILE_NAME),
            ),
        ]

        const visitedPomPaths = new Set<string>()
        const snapshots: IJavaPomSnapshot[] = []

        while (pendingPomPaths.length > 0 && visitedPomPaths.size < MODULE_DISCOVERY_LIMIT) {
            const pomPath = pendingPomPaths.shift()
            if (pomPath === undefined) {
                break
            }

            const normalizedPomPath = normalizeRepositoryRelativePath(pomPath)
            if (visitedPomPaths.has(normalizedPomPath)) {
                continue
            }

            visitedPomPaths.add(normalizedPomPath)
            const snapshot = await this.readPomSnapshot(normalizedPomPath)
            if (snapshot === undefined) {
                continue
            }

            snapshots.push(snapshot)
            appendModulePomPaths(pendingPomPaths, snapshot)
        }

        return snapshots
    }

    /**
     * Reads one optional pom snapshot.
     *
     * @param pomPath Repository-relative pom path.
     * @returns Pom snapshot when file exists.
     */
    private async readPomSnapshot(pomPath: string): Promise<IJavaPomSnapshot | undefined> {
        const pomContent = await this.readOptionalPomFile(pomPath)
        if (pomContent === undefined) {
            return undefined
        }

        const parsedPomDocument = parsePomDocument(pomContent, pomPath)
        return createPomSnapshot(parsedPomDocument, pomPath, this.sourceDirectoryCandidates)
    }

    /**
     * Reads one optional pom file.
     *
     * @param pomPath Repository-relative pom path.
     * @returns pom content when file exists.
     */
    private async readOptionalPomFile(pomPath: string): Promise<string | undefined> {
        const fileSystemPath = resolveFileSystemPath(this.repositoryRootPath, pomPath)

        try {
            return await this.readFile(fileSystemPath)
        } catch (error: unknown) {
            if (isFileNotFoundError(error)) {
                return undefined
            }

            throw new AstJavaImportResolverError(AST_JAVA_IMPORT_RESOLVER_ERROR_CODE.POM_READ_FAILED, {
                pomPath,
                reason: normalizeErrorReason(error),
            })
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

        if (this.workspacePackageRootsPromise === undefined) {
            this.workspacePackageRootsPromise = this.discoverWorkspacePackageRoots()
        }

        return this.workspacePackageRootsPromise
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
            AST_JAVA_IMPORT_RESOLVER_ERROR_CODE.POM_DISCOVERY_FAILED,
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
     * Reads optional directory entries and normalizes them.
     *
     * @param directoryPath File-system directory path.
     * @param errorCode Error code used for non-ENOENT failures.
     * @returns Directory entries.
     */
    private async readOptionalDirectory(
        directoryPath: string,
        errorCode:
            | typeof AST_JAVA_IMPORT_RESOLVER_ERROR_CODE.POM_DISCOVERY_FAILED
            | typeof AST_JAVA_IMPORT_RESOLVER_ERROR_CODE.PACKAGE_DISCOVERY_FAILED,
    ): Promise<readonly string[]> {
        try {
            const entries = await this.readDirectory(directoryPath)
            return normalizeDirectoryEntries(entries)
        } catch (error: unknown) {
            if (isFileNotFoundError(error)) {
                return []
            }

            throw new AstJavaImportResolverError(errorCode, {
                packageDirectoryPath: directoryPath,
                reason: normalizeErrorReason(error),
            })
        }
    }
}

/**
 * Resolves base resolver options with Java defaults and retry behavior.
 *
 * @param options Resolver options.
 * @returns Base resolver options.
 */
function resolveBaseImportResolverOptions(
    options: IAstJavaImportResolverOptions,
): IAstBaseImportResolverOptions {
    return {
        ...options,
        fileExtensionCandidates:
            options.fileExtensionCandidates ?? DEFAULT_JAVA_FILE_EXTENSION_CANDIDATES,
        retryPolicy: resolveRetryPolicy(options.retryPolicy),
    }
}

/**
 * Wraps retry classifier to surface typed Java resolver errors.
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
 * @returns Retry classifier.
 */
function createShouldRetry(
    baseShouldRetry: AstBaseImportResolverShouldRetry | undefined,
): AstBaseImportResolverShouldRetry {
    return (error: unknown, attempt: number): boolean => {
        if (error instanceof AstJavaImportResolverError) {
            throw error
        }

        if (baseShouldRetry !== undefined) {
            return baseShouldRetry(error, attempt)
        }

        return true
    }
}

/**
 * Parses Java import source.
 *
 * @param importSource Raw import source.
 * @returns Parsed Java import source.
 */
function parseJavaImportSource(importSource: string): IParsedJavaImportSource | undefined {
    const normalizedImportSource = normalizeText(importSource).replace(/;$/, "")
    if (normalizedImportSource.length === 0) {
        return undefined
    }

    const withoutImportKeyword = normalizedImportSource.startsWith("import ")
        ? normalizedImportSource.slice("import ".length)
        : normalizedImportSource
    const withoutStaticKeyword = withoutImportKeyword.startsWith("static ")
        ? withoutImportKeyword.slice("static ".length)
        : withoutImportKeyword

    const isWildcard = withoutStaticKeyword.endsWith(".*")
    const importPath = isWildcard
        ? withoutStaticKeyword.slice(0, -2)
        : withoutStaticKeyword
    const normalizedImportPath = normalizeJavaQualifiedName(importPath)
    if (normalizedImportPath === undefined) {
        return undefined
    }

    return {
        importPath: normalizedImportPath,
        isWildcard,
    }
}

/**
 * Normalizes Java qualified name.
 *
 * @param value Raw qualified name.
 * @returns Normalized qualified name.
 */
function normalizeJavaQualifiedName(value: string): string | undefined {
    const normalizedValue = normalizeText(value).replaceAll("/", ".")
    if (normalizedValue.length === 0) {
        return undefined
    }

    const segments = normalizedValue
        .split(".")
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0)
    if (segments.length === 0) {
        return undefined
    }

    if (segments.some((segment) => JAVA_IDENTIFIER_PATTERN.test(segment) === false)) {
        return undefined
    }

    return segments.join(".")
}

const JAVA_IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/

/**
 * Builds candidate package paths from one parsed Java import source.
 *
 * @param parsedImportSource Parsed import source.
 * @returns Candidate package paths.
 */
function buildImportCandidatePaths(
    parsedImportSource: IParsedJavaImportSource,
): readonly IJavaImportCandidatePath[] {
    const candidates: IJavaImportCandidatePath[] = []
    const pathSegments = parsedImportSource.importPath.split(".")
    const fullPackagePath = pathSegments.join("/")

    if (parsedImportSource.isWildcard) {
        candidates.push({
            packagePath: fullPackagePath,
            isWildcard: true,
        })
        return candidates
    }

    candidates.push({
        packagePath: fullPackagePath,
        isWildcard: false,
    })

    if (pathSegments.length > 1) {
        const parentPackagePath = pathSegments.slice(0, -1).join("/")
        candidates.push({
            packagePath: parentPackagePath,
            isWildcard: false,
        })
    }

    return deduplicateImportCandidatePaths(candidates)
}

/**
 * Deduplicates candidate import paths.
 *
 * @param candidates Raw candidates.
 * @returns Unique candidates.
 */
function deduplicateImportCandidatePaths(
    candidates: readonly IJavaImportCandidatePath[],
): readonly IJavaImportCandidatePath[] {
    const uniqueCandidates = new Map<string, IJavaImportCandidatePath>()

    for (const candidate of candidates) {
        const key = `${candidate.packagePath}:${candidate.isWildcard ? "wildcard" : "type"}`
        if (uniqueCandidates.has(key) === false) {
            uniqueCandidates.set(key, candidate)
        }
    }

    return [...uniqueCandidates.values()]
}

/**
 * Resolves classpath roots from options, workspace and pom snapshots.
 *
 * @param classPathRoots Explicit classpath roots.
 * @param sourceDirectoryCandidates Source directory candidates.
 * @param workspacePackageRoots Workspace package roots.
 * @param pomSnapshots Pom snapshots.
 * @returns Classpath roots.
 */
function resolveClassPathRoots(
    classPathRoots: readonly string[],
    sourceDirectoryCandidates: readonly string[],
    workspacePackageRoots: readonly string[],
    pomSnapshots: readonly IJavaPomSnapshot[],
): readonly string[] {
    const resolvedRoots = new Set<string>()
    addCandidates(resolvedRoots, classPathRoots)

    addCandidates(
        resolvedRoots,
        sourceDirectoryCandidates.map((sourceDirectoryCandidate) =>
            normalizeRepositoryRelativePath(sourceDirectoryCandidate),
        ),
    )

    for (const workspacePackageRoot of workspacePackageRoots) {
        addCandidates(resolvedRoots, [workspacePackageRoot])

        addCandidates(
            resolvedRoots,
            sourceDirectoryCandidates.map((sourceDirectoryCandidate) =>
                joinRelativePath(workspacePackageRoot, sourceDirectoryCandidate),
            ),
        )
    }

    for (const pomSnapshot of pomSnapshots) {
        addCandidates(resolvedRoots, pomSnapshot.classPathRoots)
    }

    return [...resolvedRoots]
}

/**
 * Builds direct class file candidates from one package path.
 *
 * @param packagePath Package path.
 * @param fileExtensionCandidates Extension candidates.
 * @returns Direct class file candidates.
 */
function buildDirectClassCandidates(
    packagePath: string,
    fileExtensionCandidates: readonly string[],
): readonly string[] {
    const normalizedPackagePath = normalizeRepositoryRelativePath(packagePath)
    if (normalizedPackagePath.length === 0) {
        return []
    }

    const candidates = new Set<string>()
    for (const extension of fileExtensionCandidates) {
        candidates.add(`${normalizedPackagePath}${extension}`)
    }

    return [...candidates]
}

/**
 * Builds wildcard class file candidates from one package directory listing.
 *
 * @param packageDirectoryPath Package directory path.
 * @param directoryEntries Directory entries.
 * @param fileExtensionCandidates Extension candidates.
 * @returns Wildcard class file candidates.
 */
function buildWildcardClassCandidates(
    packageDirectoryPath: string,
    directoryEntries: readonly string[],
    fileExtensionCandidates: readonly string[],
): readonly string[] {
    const normalizedPackageDirectoryPath = normalizeRepositoryRelativePath(packageDirectoryPath)
    if (normalizedPackageDirectoryPath.length === 0 || directoryEntries.length === 0) {
        return []
    }

    const extensionSet = new Set(fileExtensionCandidates)
    const sourceFiles = directoryEntries.filter((entry) => isSupportedSourceFile(entry, extensionSet))
    sourceFiles.sort(compareJavaSourceFileNames)

    const candidates = new Set<string>()
    for (const sourceFile of sourceFiles) {
        candidates.add(joinRelativePath(normalizedPackageDirectoryPath, sourceFile))
    }

    return [...candidates]
}

/**
 * Checks whether one entry is supported Java source file.
 *
 * @param fileName File entry name.
 * @param extensionSet Supported extension set.
 * @returns True when entry is supported source file.
 */
function isSupportedSourceFile(fileName: string, extensionSet: ReadonlySet<string>): boolean {
    const extension = pathPosix.extname(fileName)
    if (extensionSet.has(extension) === false) {
        return false
    }

    return fileName.includes("/") === false
}

/**
 * Sorts Java source files so non-test files go first.
 *
 * @param left Left file name.
 * @param right Right file name.
 * @returns Sort compare result.
 */
function compareJavaSourceFileNames(left: string, right: string): number {
    const leftIsTestFile = isJavaTestFile(left)
    const rightIsTestFile = isJavaTestFile(right)

    if (leftIsTestFile !== rightIsTestFile) {
        return leftIsTestFile ? 1 : -1
    }

    return left.localeCompare(right)
}

/**
 * Checks whether one Java source file is a test file.
 *
 * @param fileName File name.
 * @returns True when file ends with `Test.java`.
 */
function isJavaTestFile(fileName: string): boolean {
    return fileName.endsWith("Test.java")
}

/**
 * Appends module pom paths discovered in one snapshot.
 *
 * @param pendingPomPaths Pending pom path queue.
 * @param snapshot Pom snapshot.
 */
function appendModulePomPaths(pendingPomPaths: string[], snapshot: IJavaPomSnapshot): void {
    for (const modulePath of snapshot.modulePaths) {
        pendingPomPaths.push(joinRelativePath(snapshot.moduleRootPath, `${modulePath}/${POM_FILE_NAME}`))
    }
}

/**
 * Parses pom document.
 *
 * @param source pom.xml source.
 * @param pomPath pom file path.
 * @returns Parsed pom document.
 */
function parsePomDocument(source: string, pomPath: string): IParsedPomDocument {
    if (source.includes("<project") === false || source.includes("</project>") === false) {
        throw new AstJavaImportResolverError(AST_JAVA_IMPORT_RESOLVER_ERROR_CODE.INVALID_POM, {
            pomPath,
        })
    }

    return {
        modulePaths: extractPomTagValues(source, "module"),
        sourceDirectories: extractPomSourceDirectories(source),
    }
}

/**
 * Extracts source directories from pom source.
 *
 * @param source pom.xml source.
 * @returns Source directories.
 */
function extractPomSourceDirectories(source: string): readonly string[] {
    const sourceDirectories = [
        ...extractPomTagValues(source, "sourceDirectory"),
        ...extractPomTagValues(source, "testSourceDirectory"),
    ]

    return deduplicateTextValues(sourceDirectories)
}

/**
 * Extracts all tag values by tag name.
 *
 * @param source Source text.
 * @param tagName XML tag name.
 * @returns Extracted values.
 */
function extractPomTagValues(source: string, tagName: string): readonly string[] {
    const values: string[] = []
    const tagPattern = new RegExp(`<${tagName}>\\s*([^<]+?)\\s*</${tagName}>`, "g")
    let match: RegExpExecArray | null = tagPattern.exec(source)

    while (match !== null) {
        const value = normalizeText(match[1] ?? "")
        if (value.length > 0) {
            values.push(value)
        }

        match = tagPattern.exec(source)
    }

    return values
}

/**
 * Creates pom snapshot from parsed document.
 *
 * @param parsedPomDocument Parsed pom document.
 * @param pomPath pom file path.
 * @param sourceDirectoryCandidates Fallback source directory candidates.
 * @returns Pom snapshot.
 */
function createPomSnapshot(
    parsedPomDocument: IParsedPomDocument,
    pomPath: string,
    sourceDirectoryCandidates: readonly string[],
): IJavaPomSnapshot {
    const moduleRootPath = resolveDirectoryPath(pomPath)
    const classPathRoots = new Set<string>()

    for (const sourceDirectoryCandidate of sourceDirectoryCandidates) {
        classPathRoots.add(joinRelativePath(moduleRootPath, sourceDirectoryCandidate))
    }

    for (const sourceDirectory of parsedPomDocument.sourceDirectories) {
        classPathRoots.add(joinRelativePath(moduleRootPath, sourceDirectory))
    }

    return {
        pomPath,
        moduleRootPath,
        modulePaths: parsedPomDocument.modulePaths,
        classPathRoots: [...classPathRoots],
    }
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
        throw new AstJavaImportResolverError(
            AST_JAVA_IMPORT_RESOLVER_ERROR_CODE.INVALID_REPOSITORY_ROOT_PATH,
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
            throw new AstJavaImportResolverError(
                AST_JAVA_IMPORT_RESOLVER_ERROR_CODE.INVALID_WORKSPACE_PACKAGE_ROOT,
                {
                    workspacePackageRoot,
                },
            )
        }

        try {
            normalizedRoots.add(FilePath.create(pathPosix.normalize(normalizedRoot)).toString())
        } catch {
            throw new AstJavaImportResolverError(
                AST_JAVA_IMPORT_RESOLVER_ERROR_CODE.INVALID_WORKSPACE_PACKAGE_ROOT,
                {
                    workspacePackageRoot,
                },
            )
        }
    }

    return [...normalizedRoots]
}

/**
 * Validates explicit classpath roots.
 *
 * @param classPathRoots Raw classpath roots.
 * @returns Normalized classpath roots.
 */
function normalizeClassPathRoots(classPathRoots: readonly string[]): readonly string[] {
    const normalizedRoots = new Set<string>()

    for (const classPathRoot of classPathRoots) {
        const normalizedRoot = normalizeText(classPathRoot)
        if (normalizedRoot.length === 0 || pathPosix.isAbsolute(normalizedRoot)) {
            throw new AstJavaImportResolverError(
                AST_JAVA_IMPORT_RESOLVER_ERROR_CODE.INVALID_CLASS_PATH_ROOT,
                {
                    classPathRoot,
                },
            )
        }

        normalizedRoots.add(normalizeRepositoryRelativePath(normalizedRoot))
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
    readFileFn: AstJavaImportResolverReadFile | undefined,
): AstJavaImportResolverReadFile {
    if (readFileFn === undefined) {
        return defaultReadFile
    }

    if (typeof readFileFn !== "function") {
        throw new AstJavaImportResolverError(AST_JAVA_IMPORT_RESOLVER_ERROR_CODE.INVALID_READ_FILE)
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
    readDirectoryFn: AstJavaImportResolverReadDirectory | undefined,
): AstJavaImportResolverReadDirectory {
    if (readDirectoryFn === undefined) {
        return defaultReadDirectory
    }

    if (typeof readDirectoryFn !== "function") {
        throw new AstJavaImportResolverError(
            AST_JAVA_IMPORT_RESOLVER_ERROR_CODE.INVALID_READ_DIRECTORY,
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
 * Joins two repository-relative paths.
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
 * Deduplicates and filters text values.
 *
 * @param values Raw values.
 * @returns Unique non-empty values.
 */
function deduplicateTextValues(values: readonly string[]): readonly string[] {
    const uniqueValues = new Set<string>()

    for (const value of values) {
        const normalizedValue = normalizeText(value)
        if (normalizedValue.length > 0) {
            uniqueValues.add(normalizedValue)
        }
    }

    return [...uniqueValues]
}

/**
 * Normalizes directory entries returned by readDirectory.
 *
 * @param entries Raw entries.
 * @returns Normalized entry names.
 */
function normalizeDirectoryEntries(entries: readonly string[]): readonly string[] {
    return deduplicateTextValues(entries)
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
