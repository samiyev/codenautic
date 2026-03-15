import {posix as pathPosix} from "node:path"

import {FilePath, type IParsedSourceFileDTO} from "@codenautic/core"

import {
    AST_MONOREPO_PACKAGE_BOUNDARY_CHECKER_ERROR_CODE,
    AstMonorepoPackageBoundaryCheckerError,
} from "./ast-monorepo-package-boundary-checker.error"

const DEFAULT_MAX_VIOLATIONS = 200
const DEFAULT_PACKAGE_ALIAS_PREFIX = "@codenautic/"

const FILE_EXTENSION_CANDIDATES = [
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".py",
    ".go",
    ".java",
    ".cs",
    ".rb",
    ".rs",
    ".php",
    ".kt",
] as const

const VIOLATION_SEVERITY_ORDER = [
    "HIGH",
    "MEDIUM",
    "LOW",
] as const

/**
 * Monorepo package boundary violation type.
 */
export const AST_MONOREPO_BOUNDARY_VIOLATION_TYPE = {
    CROSS_PACKAGE_RELATIVE_IMPORT: "CROSS_PACKAGE_RELATIVE_IMPORT",
    UNDECLARED_PACKAGE_DEPENDENCY: "UNDECLARED_PACKAGE_DEPENDENCY",
    SELF_PACKAGE_ALIAS_IMPORT: "SELF_PACKAGE_ALIAS_IMPORT",
    UNKNOWN_PACKAGE_IMPORT: "UNKNOWN_PACKAGE_IMPORT",
} as const

/**
 * Monorepo package boundary violation type literal.
 */
export type AstMonorepoBoundaryViolationType =
    (typeof AST_MONOREPO_BOUNDARY_VIOLATION_TYPE)[keyof typeof AST_MONOREPO_BOUNDARY_VIOLATION_TYPE]

/**
 * Monorepo package boundary violation severity bucket.
 */
export const AST_MONOREPO_BOUNDARY_VIOLATION_SEVERITY = {
    HIGH: "HIGH",
    MEDIUM: "MEDIUM",
    LOW: "LOW",
} as const

/**
 * Monorepo package boundary violation severity literal.
 */
export type AstMonorepoBoundaryViolationSeverity =
    (typeof AST_MONOREPO_BOUNDARY_VIOLATION_SEVERITY)[keyof typeof AST_MONOREPO_BOUNDARY_VIOLATION_SEVERITY]

/**
 * One monorepo package boundary violation.
 */
export interface IAstMonorepoBoundaryViolation {
    /**
     * Stable deterministic violation identifier.
     */
    readonly id: string

    /**
     * Violation category.
     */
    readonly type: AstMonorepoBoundaryViolationType

    /**
     * Violation severity bucket.
     */
    readonly severity: AstMonorepoBoundaryViolationSeverity

    /**
     * Source package name.
     */
    readonly sourcePackage: string

    /**
     * Optional target package name.
     */
    readonly targetPackage?: string

    /**
     * Source file path containing boundary-breaking import.
     */
    readonly sourceFilePath: string

    /**
     * Optional resolved target file path.
     */
    readonly targetFilePath?: string

    /**
     * Original import source string.
     */
    readonly importSource: string

    /**
     * Stable human-readable reason.
     */
    readonly reason: string
}

/**
 * Monorepo package boundary checker summary.
 */
export interface IAstMonorepoPackageBoundaryCheckerSummary {
    /**
     * Number of analyzed files after optional source filtering.
     */
    readonly scannedFileCount: number

    /**
     * Number of discovered monorepo packages.
     */
    readonly packageCount: number

    /**
     * Number of returned violations.
     */
    readonly violationCount: number

    /**
     * Number of high-severity returned violations.
     */
    readonly highSeverityCount: number

    /**
     * Whether output was truncated by max violations cap.
     */
    readonly truncated: boolean

    /**
     * Number of omitted violations after truncation.
     */
    readonly truncatedViolationCount: number

    /**
     * Returned violation counts by type.
     */
    readonly byType: Record<AstMonorepoBoundaryViolationType, number>

    /**
     * Returned violation counts by severity.
     */
    readonly bySeverity: Record<AstMonorepoBoundaryViolationSeverity, number>
}

/**
 * Monorepo package boundary checker result payload.
 */
export interface IAstMonorepoPackageBoundaryCheckerResult {
    /**
     * Deterministic sorted violations.
     */
    readonly violations: readonly IAstMonorepoBoundaryViolation[]

    /**
     * Aggregated summary.
     */
    readonly summary: IAstMonorepoPackageBoundaryCheckerSummary
}

/**
 * Runtime input for monorepo package boundary checker.
 */
export interface IAstMonorepoPackageBoundaryCheckerInput {
    /**
     * Parsed source files.
     */
    readonly files: readonly IParsedSourceFileDTO[]

    /**
     * Optional source file-path subset.
     */
    readonly filePaths?: readonly string[]

    /**
     * Optional package dependency map by package name.
     */
    readonly packageDependencies?: Readonly<Record<string, readonly string[]>>

    /**
     * Optional max number of returned violations.
     */
    readonly maxViolations?: number
}

/**
 * Monorepo package boundary checker options.
 */
export interface IAstMonorepoPackageBoundaryCheckerServiceOptions {
    /**
     * Optional default max returned violations.
     */
    readonly defaultMaxViolations?: number

    /**
     * Optional package alias prefix for cross-package imports.
     */
    readonly packageAliasPrefix?: string
}

/**
 * Monorepo package boundary checker contract.
 */
export interface IAstMonorepoPackageBoundaryCheckerService {
    /**
     * Detects monorepo package boundary violations from parsed imports.
     *
     * @param input Parsed source files and runtime options.
     * @returns Deterministic violation payload.
     */
    check(
        input: IAstMonorepoPackageBoundaryCheckerInput,
    ): Promise<IAstMonorepoPackageBoundaryCheckerResult>
}

interface IParsedFileContext {
    readonly filePath: string
    readonly directoryPath: string
    readonly packageName?: string
    readonly parsedFile: IParsedSourceFileDTO
}

interface INormalizedContext {
    readonly files: readonly IParsedFileContext[]
    readonly sourceFiles: readonly IParsedFileContext[]
    readonly fileLookup: ReadonlyMap<string, IParsedFileContext>
    readonly packageNames: ReadonlySet<string>
}

/**
 * Checks monorepo package boundary violations from parsed import statements.
 */
export class AstMonorepoPackageBoundaryCheckerService
    implements IAstMonorepoPackageBoundaryCheckerService
{
    private readonly defaultMaxViolations: number
    private readonly packageAliasPrefix: string

    /**
     * Creates monorepo package boundary checker service.
     *
     * @param options Optional checker configuration.
     */
    public constructor(options: IAstMonorepoPackageBoundaryCheckerServiceOptions = {}) {
        this.defaultMaxViolations = validateMaxViolations(
            options.defaultMaxViolations ?? DEFAULT_MAX_VIOLATIONS,
        )
        this.packageAliasPrefix = validatePackageAliasPrefix(
            options.packageAliasPrefix ?? DEFAULT_PACKAGE_ALIAS_PREFIX,
        )
    }

    /**
     * Detects monorepo package boundary violations from parsed imports.
     *
     * @param input Parsed source files and runtime options.
     * @returns Deterministic violation payload.
     */
    public check(
        input: IAstMonorepoPackageBoundaryCheckerInput,
    ): Promise<IAstMonorepoPackageBoundaryCheckerResult> {
        const context = normalizeContext(input.files, input.filePaths)
        const maxViolations = validateMaxViolations(
            input.maxViolations ?? this.defaultMaxViolations,
        )
        const dependenciesByPackage = normalizePackageDependencies(
            input.packageDependencies,
        )
        const violations = detectViolations(
            context,
            dependenciesByPackage,
            this.packageAliasPrefix,
        )
        const truncatedViolations = violations.slice(0, maxViolations)
        const truncatedViolationCount = Math.max(
            0,
            violations.length - truncatedViolations.length,
        )

        return Promise.resolve({
            violations: truncatedViolations,
            summary: createSummary(
                context.sourceFiles.length,
                context.packageNames.size,
                truncatedViolations,
                truncatedViolationCount,
            ),
        })
    }
}

/**
 * Validates max violations cap.
 *
 * @param maxViolations Raw cap value.
 * @returns Validated cap.
 */
function validateMaxViolations(maxViolations: number): number {
    if (Number.isSafeInteger(maxViolations) === false || maxViolations < 1) {
        throw new AstMonorepoPackageBoundaryCheckerError(
            AST_MONOREPO_PACKAGE_BOUNDARY_CHECKER_ERROR_CODE.INVALID_MAX_VIOLATIONS,
            {maxViolations},
        )
    }

    return maxViolations
}

/**
 * Validates package alias prefix.
 *
 * @param packageAliasPrefix Raw package alias prefix.
 * @returns Trimmed alias prefix.
 */
function validatePackageAliasPrefix(packageAliasPrefix: string): string {
    const normalizedPackageAliasPrefix = packageAliasPrefix.trim()
    if (normalizedPackageAliasPrefix.length === 0) {
        throw new AstMonorepoPackageBoundaryCheckerError(
            AST_MONOREPO_PACKAGE_BOUNDARY_CHECKER_ERROR_CODE.INVALID_PACKAGE_ALIAS_PREFIX,
            {packageAliasPrefix},
        )
    }

    return normalizedPackageAliasPrefix
}

/**
 * Normalizes parsed file context and optional file-path subset.
 *
 * @param files Parsed source files.
 * @param filePaths Optional source subset.
 * @returns Normalized analysis context.
 */
function normalizeContext(
    files: readonly IParsedSourceFileDTO[],
    filePaths?: readonly string[],
): INormalizedContext {
    const parsedFiles = normalizeParsedFiles(files)
    const fileLookup = createFileLookup(parsedFiles)
    const sourceFiles = selectSourceFiles(parsedFiles, filePaths)
    const packageNames = collectPackageNames(parsedFiles)

    return {
        files: parsedFiles,
        sourceFiles,
        fileLookup,
        packageNames,
    }
}

/**
 * Normalizes parsed files into deterministic sorted context entries.
 *
 * @param files Parsed source files.
 * @returns Sorted deterministic parsed file context entries.
 */
function normalizeParsedFiles(
    files: readonly IParsedSourceFileDTO[],
): readonly IParsedFileContext[] {
    if (files.length === 0) {
        throw new AstMonorepoPackageBoundaryCheckerError(
            AST_MONOREPO_PACKAGE_BOUNDARY_CHECKER_ERROR_CODE.EMPTY_FILES,
        )
    }

    const uniqueByPath = new Map<string, IParsedFileContext>()

    for (const parsedFile of files) {
        const normalizedFilePath = normalizeFilePath(parsedFile.filePath)
        if (uniqueByPath.has(normalizedFilePath)) {
            throw new AstMonorepoPackageBoundaryCheckerError(
                AST_MONOREPO_PACKAGE_BOUNDARY_CHECKER_ERROR_CODE.DUPLICATE_FILE_PATH,
                {filePath: normalizedFilePath},
            )
        }

        uniqueByPath.set(normalizedFilePath, {
            filePath: normalizedFilePath,
            directoryPath: pathPosix.dirname(normalizedFilePath),
            packageName: parsePackageName(normalizedFilePath),
            parsedFile,
        })
    }

    return [...uniqueByPath.values()].sort((left, right) =>
        left.filePath.localeCompare(right.filePath),
    )
}

/**
 * Selects source files by optional subset filter.
 *
 * @param files Parsed file context entries.
 * @param filePaths Optional source subset filter.
 * @returns Selected deterministic source file list.
 */
function selectSourceFiles(
    files: readonly IParsedFileContext[],
    filePaths?: readonly string[],
): readonly IParsedFileContext[] {
    if (filePaths === undefined) {
        return files
    }

    if (filePaths.length === 0) {
        throw new AstMonorepoPackageBoundaryCheckerError(
            AST_MONOREPO_PACKAGE_BOUNDARY_CHECKER_ERROR_CODE.EMPTY_FILE_PATHS,
        )
    }

    const normalizedFilterSet = new Set<string>()

    for (const filePath of filePaths) {
        normalizedFilterSet.add(normalizeFilePath(filePath))
    }

    return files.filter((file) => normalizedFilterSet.has(file.filePath))
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
        throw new AstMonorepoPackageBoundaryCheckerError(
            AST_MONOREPO_PACKAGE_BOUNDARY_CHECKER_ERROR_CODE.INVALID_FILE_PATH,
            {filePath},
        )
    }
}

/**
 * Parses package name from normalized repository file path.
 *
 * @param filePath Normalized repository file path.
 * @returns Package name when file belongs to monorepo package.
 */
function parsePackageName(filePath: string): string | undefined {
    const segments = filePath.split("/")
    const rootSegment = segments[0]
    const packageSegment = segments[1]
    const hasNestedPath = segments.length > 2

    if (rootSegment !== "packages" || packageSegment === undefined || hasNestedPath === false) {
        return undefined
    }

    const packageName = packageSegment.trim()
    if (packageName.length === 0) {
        return undefined
    }

    return packageName
}

/**
 * Creates file lookup by normalized file path.
 *
 * @param files Parsed file context entries.
 * @returns File lookup by file path.
 */
function createFileLookup(
    files: readonly IParsedFileContext[],
): ReadonlyMap<string, IParsedFileContext> {
    const lookup = new Map<string, IParsedFileContext>()

    for (const file of files) {
        lookup.set(file.filePath, file)
    }

    return lookup
}

/**
 * Collects discovered monorepo package names.
 *
 * @param files Parsed file context entries.
 * @returns Unique package names.
 */
function collectPackageNames(files: readonly IParsedFileContext[]): ReadonlySet<string> {
    const packageNames = new Set<string>()

    for (const file of files) {
        if (file.packageName !== undefined) {
            packageNames.add(file.packageName)
        }
    }

    return packageNames
}

/**
 * Normalizes optional package dependency map.
 *
 * @param packageDependencies Raw dependency map.
 * @returns Normalized dependency map by package name.
 */
function normalizePackageDependencies(
    packageDependencies?: Readonly<Record<string, readonly string[]>>,
): ReadonlyMap<string, ReadonlySet<string>> {
    const normalizedDependencies = new Map<string, ReadonlySet<string>>()
    if (packageDependencies === undefined) {
        return normalizedDependencies
    }

    for (const [packageName, dependencies] of Object.entries(packageDependencies)) {
        const normalizedPackageName = normalizePackageName(packageName)
        const normalizedDependencySet = new Set<string>()

        for (const dependencyName of dependencies) {
            normalizedDependencySet.add(normalizePackageName(dependencyName))
        }

        normalizedDependencies.set(normalizedPackageName, normalizedDependencySet)
    }

    return normalizedDependencies
}

/**
 * Normalizes package name.
 *
 * @param packageName Raw package name.
 * @returns Normalized package name.
 */
function normalizePackageName(packageName: string): string {
    const normalizedPackageName = packageName.trim()
    if (normalizedPackageName.length === 0) {
        throw new AstMonorepoPackageBoundaryCheckerError(
            AST_MONOREPO_PACKAGE_BOUNDARY_CHECKER_ERROR_CODE.INVALID_PACKAGE_NAME,
            {packageName},
        )
    }

    return normalizedPackageName
}

/**
 * Detects boundary violations from normalized analysis context.
 *
 * @param context Normalized analysis context.
 * @param dependenciesByPackage Allowed package dependency map.
 * @param packageAliasPrefix Package alias prefix.
 * @returns Deterministic sorted violations.
 */
function detectViolations(
    context: INormalizedContext,
    dependenciesByPackage: ReadonlyMap<string, ReadonlySet<string>>,
    packageAliasPrefix: string,
): readonly IAstMonorepoBoundaryViolation[] {
    const violationsById = new Map<string, IAstMonorepoBoundaryViolation>()

    for (const sourceFile of context.sourceFiles) {
        const sourcePackage = sourceFile.packageName
        if (sourcePackage === undefined) {
            continue
        }

        for (const statement of sourceFile.parsedFile.imports) {
            const relativeViolation = detectRelativeImportViolation(
                statement.source,
                sourceFile,
                context.fileLookup,
            )

            if (relativeViolation !== undefined) {
                violationsById.set(relativeViolation.id, relativeViolation)
                continue
            }

            const aliasViolation = detectAliasImportViolation({
                importSource: statement.source,
                sourceFile,
                packageAliasPrefix,
                packageNames: context.packageNames,
                dependenciesByPackage,
            })
            if (aliasViolation !== undefined) {
                violationsById.set(aliasViolation.id, aliasViolation)
            }
        }
    }

    return [...violationsById.values()].sort(compareViolations)
}

/**
 * Detects cross-package relative import violations.
 *
 * @param importSource Raw import source.
 * @param sourceFile Source file context.
 * @param fileLookup File lookup by path.
 * @returns Relative-import violation when detected.
 */
function detectRelativeImportViolation(
    importSource: string,
    sourceFile: IParsedFileContext,
    fileLookup: ReadonlyMap<string, IParsedFileContext>,
): IAstMonorepoBoundaryViolation | undefined {
    if (importSource.startsWith(".") === false) {
        return undefined
    }

    const resolvedTargetFile = resolveRelativeImportTarget(
        sourceFile.directoryPath,
        importSource,
        fileLookup,
    )
    if (resolvedTargetFile === undefined) {
        return undefined
    }

    const sourcePackage = sourceFile.packageName
    const targetPackage = resolvedTargetFile.packageName

    if (
        sourcePackage === undefined ||
        targetPackage === undefined ||
        sourcePackage === targetPackage
    ) {
        return undefined
    }

    return createViolation({
        type: AST_MONOREPO_BOUNDARY_VIOLATION_TYPE.CROSS_PACKAGE_RELATIVE_IMPORT,
        severity: AST_MONOREPO_BOUNDARY_VIOLATION_SEVERITY.HIGH,
        sourcePackage,
        targetPackage,
        sourceFilePath: sourceFile.filePath,
        targetFilePath: resolvedTargetFile.filePath,
        importSource,
        reason: `Relative import crosses package boundary from ${sourcePackage} to ${targetPackage}`,
    })
}

interface IAliasViolationInput {
    readonly importSource: string
    readonly sourceFile: IParsedFileContext
    readonly packageAliasPrefix: string
    readonly packageNames: ReadonlySet<string>
    readonly dependenciesByPackage: ReadonlyMap<string, ReadonlySet<string>>
}

/**
 * Detects alias-based package boundary violations.
 *
 * @param input Alias detection input.
 * @returns Alias violation when detected.
 */
function detectAliasImportViolation(
    input: IAliasViolationInput,
): IAstMonorepoBoundaryViolation | undefined {
    const targetPackage = parseAliasTargetPackage(
        input.importSource,
        input.packageAliasPrefix,
    )
    if (targetPackage === undefined) {
        return undefined
    }

    const sourcePackage = input.sourceFile.packageName
    if (sourcePackage === undefined) {
        return undefined
    }

    if (targetPackage === sourcePackage) {
        return createViolation({
            type: AST_MONOREPO_BOUNDARY_VIOLATION_TYPE.SELF_PACKAGE_ALIAS_IMPORT,
            severity: AST_MONOREPO_BOUNDARY_VIOLATION_SEVERITY.LOW,
            sourcePackage,
            targetPackage,
            sourceFilePath: input.sourceFile.filePath,
            importSource: input.importSource,
            reason: `Package ${sourcePackage} imports itself via alias instead of relative path`,
        })
    }

    if (input.packageNames.has(targetPackage) === false) {
        return createViolation({
            type: AST_MONOREPO_BOUNDARY_VIOLATION_TYPE.UNKNOWN_PACKAGE_IMPORT,
            severity: AST_MONOREPO_BOUNDARY_VIOLATION_SEVERITY.MEDIUM,
            sourcePackage,
            targetPackage,
            sourceFilePath: input.sourceFile.filePath,
            importSource: input.importSource,
            reason: `Alias import targets unknown monorepo package ${targetPackage}`,
        })
    }

    const allowedDependencies = input.dependenciesByPackage.get(sourcePackage)
    if (allowedDependencies === undefined) {
        return undefined
    }

    if (allowedDependencies.has(targetPackage)) {
        return undefined
    }

    return createViolation({
        type: AST_MONOREPO_BOUNDARY_VIOLATION_TYPE.UNDECLARED_PACKAGE_DEPENDENCY,
        severity: AST_MONOREPO_BOUNDARY_VIOLATION_SEVERITY.MEDIUM,
        sourcePackage,
        targetPackage,
        sourceFilePath: input.sourceFile.filePath,
        importSource: input.importSource,
        reason: `Package ${sourcePackage} imports ${targetPackage} without declared dependency`,
    })
}

/**
 * Parses alias target package from import source.
 *
 * @param importSource Raw import source.
 * @param packageAliasPrefix Alias prefix.
 * @returns Alias target package when import uses alias prefix.
 */
function parseAliasTargetPackage(
    importSource: string,
    packageAliasPrefix: string,
): string | undefined {
    if (importSource.startsWith(packageAliasPrefix) === false) {
        return undefined
    }

    const aliasPath = importSource.slice(packageAliasPrefix.length)
    const [targetPackageSegment] = aliasPath.split("/")
    if (targetPackageSegment === undefined) {
        return undefined
    }

    const targetPackage = targetPackageSegment.trim()
    if (targetPackage.length === 0) {
        return undefined
    }

    return targetPackage
}

/**
 * Resolves relative import to parsed file when available.
 *
 * @param directoryPath Source file directory.
 * @param importSource Raw relative import source.
 * @param fileLookup File lookup by path.
 * @returns Resolved parsed file context.
 */
function resolveRelativeImportTarget(
    directoryPath: string,
    importSource: string,
    fileLookup: ReadonlyMap<string, IParsedFileContext>,
): IParsedFileContext | undefined {
    const candidates = buildRelativeImportCandidates(directoryPath, importSource)
    for (const candidate of candidates) {
        const resolvedTarget = fileLookup.get(candidate)
        if (resolvedTarget !== undefined) {
            return resolvedTarget
        }
    }

    return undefined
}

/**
 * Builds relative import candidate paths.
 *
 * @param directoryPath Source file directory.
 * @param importSource Raw import source.
 * @returns Relative import candidate paths.
 */
function buildRelativeImportCandidates(
    directoryPath: string,
    importSource: string,
): readonly string[] {
    const absoluteImportPath = normalizePath(pathPosix.join(directoryPath, importSource))
    const candidates = new Set<string>()
    candidates.add(absoluteImportPath)

    for (const extension of FILE_EXTENSION_CANDIDATES) {
        candidates.add(`${absoluteImportPath}${extension}`)
    }

    for (const extension of FILE_EXTENSION_CANDIDATES) {
        candidates.add(pathPosix.join(absoluteImportPath, `index${extension}`))
    }

    return [...candidates]
}

/**
 * Normalizes path into repository-style POSIX string.
 *
 * @param filePath Raw path.
 * @returns Normalized path.
 */
function normalizePath(filePath: string): string {
    return pathPosix.normalize(filePath).replace(/^(\.\/)+/, "")
}

interface ICreateViolationInput {
    readonly type: AstMonorepoBoundaryViolationType
    readonly severity: AstMonorepoBoundaryViolationSeverity
    readonly sourcePackage: string
    readonly targetPackage?: string
    readonly sourceFilePath: string
    readonly targetFilePath?: string
    readonly importSource: string
    readonly reason: string
}

/**
 * Creates stable deterministic boundary violation.
 *
 * @param input Violation fields.
 * @returns Boundary violation.
 */
function createViolation(input: ICreateViolationInput): IAstMonorepoBoundaryViolation {
    return {
        id: [
            input.type,
            input.sourceFilePath,
            input.importSource,
            input.targetFilePath ?? "",
            input.targetPackage ?? "",
        ].join("|"),
        type: input.type,
        severity: input.severity,
        sourcePackage: input.sourcePackage,
        targetPackage: input.targetPackage,
        sourceFilePath: input.sourceFilePath,
        targetFilePath: input.targetFilePath,
        importSource: input.importSource,
        reason: input.reason,
    }
}

/**
 * Compares boundary violations deterministically.
 *
 * @param left Left violation.
 * @param right Right violation.
 * @returns Sort result.
 */
function compareViolations(
    left: IAstMonorepoBoundaryViolation,
    right: IAstMonorepoBoundaryViolation,
): number {
    if (left.severity !== right.severity) {
        return VIOLATION_SEVERITY_ORDER.indexOf(left.severity) - VIOLATION_SEVERITY_ORDER.indexOf(right.severity)
    }

    if (left.sourceFilePath !== right.sourceFilePath) {
        return left.sourceFilePath.localeCompare(right.sourceFilePath)
    }

    if (left.importSource !== right.importSource) {
        return left.importSource.localeCompare(right.importSource)
    }

    if (left.type !== right.type) {
        return left.type.localeCompare(right.type)
    }

    return left.id.localeCompare(right.id)
}

/**
 * Creates summary payload from boundary violations.
 *
 * @param scannedFileCount Number of analyzed files.
 * @param packageCount Number of discovered packages.
 * @param violations Returned violations.
 * @param truncatedViolationCount Number of omitted violations.
 * @returns Boundary checker summary.
 */
function createSummary(
    scannedFileCount: number,
    packageCount: number,
    violations: readonly IAstMonorepoBoundaryViolation[],
    truncatedViolationCount: number,
): IAstMonorepoPackageBoundaryCheckerSummary {
    const byType = createEmptyByTypeRecord()
    const bySeverity = createEmptyBySeverityRecord()
    let highSeverityCount = 0

    for (const violation of violations) {
        byType[violation.type] += 1
        bySeverity[violation.severity] += 1

        if (violation.severity === AST_MONOREPO_BOUNDARY_VIOLATION_SEVERITY.HIGH) {
            highSeverityCount += 1
        }
    }

    return {
        scannedFileCount,
        packageCount,
        violationCount: violations.length,
        highSeverityCount,
        truncated: truncatedViolationCount > 0,
        truncatedViolationCount,
        byType,
        bySeverity,
    }
}

/**
 * Creates empty by-type summary record.
 *
 * @returns Zero-initialized by-type record.
 */
function createEmptyByTypeRecord(): Record<AstMonorepoBoundaryViolationType, number> {
    return {
        CROSS_PACKAGE_RELATIVE_IMPORT: 0,
        UNDECLARED_PACKAGE_DEPENDENCY: 0,
        SELF_PACKAGE_ALIAS_IMPORT: 0,
        UNKNOWN_PACKAGE_IMPORT: 0,
    }
}

/**
 * Creates empty by-severity summary record.
 *
 * @returns Zero-initialized by-severity record.
 */
function createEmptyBySeverityRecord(): Record<AstMonorepoBoundaryViolationSeverity, number> {
    return {
        HIGH: 0,
        MEDIUM: 0,
        LOW: 0,
    }
}
