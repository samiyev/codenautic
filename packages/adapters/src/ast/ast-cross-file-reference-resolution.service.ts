import {posix as pathPosix} from "node:path"

import {FilePath, type IParsedSourceFileDTO} from "@codenautic/core"

import {
    AST_CROSS_FILE_REFERENCE_RESOLUTION_ERROR_CODE,
    AstCrossFileReferenceResolutionError,
} from "./ast-cross-file-reference-resolution.error"

const DEFAULT_MINIMUM_CONFIDENCE = 0.5
const DEFAULT_MAX_CANDIDATES_PER_REFERENCE = 5

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

const REFERENCE_TYPE_ORDER = [
    "CALL",
    "IMPORT",
    "TYPE",
] as const

const UNRESOLVED_REASON = {
    AMBIGUOUS_SYMBOL: "AMBIGUOUS_SYMBOL",
    LOW_CONFIDENCE: "LOW_CONFIDENCE",
    RELATIVE_IMPORT_NOT_FOUND: "RELATIVE_IMPORT_NOT_FOUND",
    SYMBOL_NOT_FOUND: "SYMBOL_NOT_FOUND",
} as const

/**
 * Cross-file reference relation types.
 */
export const AST_CROSS_FILE_REFERENCE_TYPE = {
    CALL: "CALL",
    IMPORT: "IMPORT",
    TYPE: "TYPE",
} as const

/**
 * Cross-file reference relation type literal.
 */
export type AstCrossFileReferenceType =
    (typeof AST_CROSS_FILE_REFERENCE_TYPE)[keyof typeof AST_CROSS_FILE_REFERENCE_TYPE]

/**
 * One resolved cross-file reference relation.
 */
export interface IAstCrossFileReference {
    /**
     * Stable deterministic relation identifier.
     */
    readonly id: string

    /**
     * Reference relation type.
     */
    readonly type: AstCrossFileReferenceType

    /**
     * Source repository-relative file path.
     */
    readonly sourceFilePath: string

    /**
     * Target repository-relative file path.
     */
    readonly targetFilePath: string

    /**
     * Optional source symbol involved in relation.
     */
    readonly sourceSymbol?: string

    /**
     * Optional target symbol involved in relation.
     */
    readonly targetSymbol?: string

    /**
     * Deterministic confidence score in `[0, 1]`.
     */
    readonly confidence: number
}

/**
 * One unresolved cross-file reference.
 */
export interface IAstUnresolvedCrossFileReference {
    /**
     * Reference relation type.
     */
    readonly type: AstCrossFileReferenceType

    /**
     * Source repository-relative file path.
     */
    readonly sourceFilePath: string

    /**
     * Symbol or import source that could not be resolved.
     */
    readonly symbol: string

    /**
     * Candidate file paths considered by resolver.
     */
    readonly candidateFilePaths: readonly string[]

    /**
     * Stable unresolved reason code.
     */
    readonly reason: string
}

/**
 * Aggregated summary for one cross-file resolution run.
 */
export interface IAstCrossFileReferenceResolutionSummary {
    /**
     * Number of analyzed source files.
     */
    readonly scannedFileCount: number

    /**
     * Number of resolved cross-file references.
     */
    readonly resolvedReferenceCount: number

    /**
     * Number of unresolved references.
     */
    readonly unresolvedReferenceCount: number

    /**
     * Count of resolved references grouped by relation type.
     */
    readonly byType: Readonly<Record<AstCrossFileReferenceType, number>>
}

/**
 * Output payload for cross-file reference resolution.
 */
export interface IAstCrossFileReferenceResolutionResult {
    /**
     * Deterministic resolved references.
     */
    readonly references: readonly IAstCrossFileReference[]

    /**
     * Deterministic unresolved references.
     */
    readonly unresolvedReferences: readonly IAstUnresolvedCrossFileReference[]

    /**
     * Aggregated summary.
     */
    readonly summary: IAstCrossFileReferenceResolutionSummary
}

/**
 * Runtime options for cross-file reference resolution.
 */
export interface IAstCrossFileReferenceResolutionInput {
    /**
     * Optional subset of source file paths for batch resolution.
     */
    readonly filePaths?: readonly string[]

    /**
     * Optional minimum confidence threshold for resolved references.
     */
    readonly minimumConfidence?: number

    /**
     * Optional maximum candidate count persisted for unresolved references.
     */
    readonly maxCandidatesPerReference?: number
}

/**
 * Construction options for cross-file reference resolution service.
 */
export interface IAstCrossFileReferenceResolutionServiceOptions {
    /**
     * Optional default minimum confidence threshold.
     */
    readonly defaultMinimumConfidence?: number

    /**
     * Optional default max candidate count for unresolved references.
     */
    readonly defaultMaxCandidatesPerReference?: number
}

/**
 * Cross-file reference resolution service contract.
 */
export interface IAstCrossFileReferenceResolutionService {
    /**
     * Resolves import, call, and type references between parsed source files.
     *
     * @param files Parsed source files.
     * @param input Optional runtime settings.
     * @returns Deterministic cross-file resolution result.
     */
    resolve(
        files: readonly IParsedSourceFileDTO[],
        input?: IAstCrossFileReferenceResolutionInput,
    ): Promise<IAstCrossFileReferenceResolutionResult>
}

interface IResolvedReferenceConfig {
    readonly filePaths?: readonly string[]
    readonly minimumConfidence: number
    readonly maxCandidatesPerReference: number
}

interface INormalizedParsedFile {
    readonly filePath: string
    readonly parsedFile: IParsedSourceFileDTO
    readonly directoryPath: string
}

interface IReferenceSymbolCandidate {
    readonly filePath: string
    readonly symbol: string
}

interface IImportResolutionResult {
    readonly references: readonly IAstCrossFileReference[]
    readonly unresolvedReferences: readonly IAstUnresolvedCrossFileReference[]
    readonly importedTargetPaths: ReadonlySet<string>
}

interface ICandidateResolutionSuccess {
    readonly status: "resolved"
    readonly candidate: IReferenceSymbolCandidate
    readonly confidence: number
}

interface ICandidateResolutionFailure {
    readonly status: "unresolved"
    readonly reason: string
    readonly candidateFilePaths: readonly string[]
}

type CandidateResolutionOutcome = ICandidateResolutionSuccess | ICandidateResolutionFailure

/**
 * AST cross-file reference resolution using deterministic symbol indexes.
 */
export class AstCrossFileReferenceResolutionService
    implements IAstCrossFileReferenceResolutionService
{
    private readonly defaultMinimumConfidence: number
    private readonly defaultMaxCandidatesPerReference: number

    /**
     * Creates cross-file reference resolution service.
     *
     * @param options Optional defaults.
     */
    public constructor(options: IAstCrossFileReferenceResolutionServiceOptions = {}) {
        this.defaultMinimumConfidence = validateMinimumConfidence(
            options.defaultMinimumConfidence ?? DEFAULT_MINIMUM_CONFIDENCE,
        )
        this.defaultMaxCandidatesPerReference = validateMaxCandidatesPerReference(
            options.defaultMaxCandidatesPerReference ?? DEFAULT_MAX_CANDIDATES_PER_REFERENCE,
        )
    }

    /**
     * Resolves cross-file references for parsed source files.
     *
     * @param files Parsed source files.
     * @param input Optional runtime settings.
     * @returns Deterministic resolution result.
     */
    public resolve(
        files: readonly IParsedSourceFileDTO[],
        input: IAstCrossFileReferenceResolutionInput = {},
    ): Promise<IAstCrossFileReferenceResolutionResult> {
        const config = this.resolveConfig(input)
        const normalizedFiles = normalizeParsedFiles(files)
        const sourceFiles = filterSourceFiles(normalizedFiles, config.filePaths)
        const fileLookup = createFileLookup(normalizedFiles)
        const callableIndex = createCallableSymbolIndex(normalizedFiles)
        const typeIndex = createTypeSymbolIndex(normalizedFiles)
        const references: IAstCrossFileReference[] = []
        const unresolvedReferences: IAstUnresolvedCrossFileReference[] = []

        for (const sourceFile of sourceFiles) {
            const importResult = resolveImportReferences(
                sourceFile,
                fileLookup,
                config.minimumConfidence,
            )
            references.push(...importResult.references)
            unresolvedReferences.push(...importResult.unresolvedReferences)

            const callResolution = resolveCallReferences(
                sourceFile,
                callableIndex,
                importResult.importedTargetPaths,
                config,
            )
            references.push(...callResolution.references)
            unresolvedReferences.push(...callResolution.unresolvedReferences)

            const typeResolution = resolveTypeReferences(
                sourceFile,
                typeIndex,
                importResult.importedTargetPaths,
                config,
            )
            references.push(...typeResolution.references)
            unresolvedReferences.push(...typeResolution.unresolvedReferences)
        }

        const sortedReferences = deduplicateAndSortReferences(references)
        const sortedUnresolvedReferences = deduplicateAndSortUnresolved(unresolvedReferences)

        return Promise.resolve({
            references: sortedReferences,
            unresolvedReferences: sortedUnresolvedReferences,
            summary: createSummary(
                sourceFiles.length,
                sortedReferences,
                sortedUnresolvedReferences.length,
            ),
        })
    }

    /**
     * Resolves runtime configuration with validated defaults.
     *
     * @param input Runtime settings.
     * @returns Validated configuration.
     */
    private resolveConfig(
        input: IAstCrossFileReferenceResolutionInput,
    ): IResolvedReferenceConfig {
        return {
            filePaths: normalizeFilePathFilter(input.filePaths),
            minimumConfidence: validateMinimumConfidence(
                input.minimumConfidence ?? this.defaultMinimumConfidence,
            ),
            maxCandidatesPerReference: validateMaxCandidatesPerReference(
                input.maxCandidatesPerReference ?? this.defaultMaxCandidatesPerReference,
            ),
        }
    }
}

/**
 * Validates minimum confidence threshold in `[0, 1]` range.
 *
 * @param minimumConfidence Raw threshold.
 * @returns Validated threshold.
 */
function validateMinimumConfidence(minimumConfidence: number): number {
    if (Number.isFinite(minimumConfidence) === false) {
        throw new AstCrossFileReferenceResolutionError(
            AST_CROSS_FILE_REFERENCE_RESOLUTION_ERROR_CODE.INVALID_MINIMUM_CONFIDENCE,
            {minimumConfidence},
        )
    }

    if (minimumConfidence < 0 || minimumConfidence > 1) {
        throw new AstCrossFileReferenceResolutionError(
            AST_CROSS_FILE_REFERENCE_RESOLUTION_ERROR_CODE.INVALID_MINIMUM_CONFIDENCE,
            {minimumConfidence},
        )
    }

    return minimumConfidence
}

/**
 * Validates unresolved-candidate cap.
 *
 * @param maxCandidatesPerReference Raw cap value.
 * @returns Validated cap.
 */
function validateMaxCandidatesPerReference(maxCandidatesPerReference: number): number {
    if (Number.isSafeInteger(maxCandidatesPerReference) === false || maxCandidatesPerReference < 1) {
        throw new AstCrossFileReferenceResolutionError(
            AST_CROSS_FILE_REFERENCE_RESOLUTION_ERROR_CODE.INVALID_MAX_CANDIDATES_PER_REFERENCE,
            {maxCandidatesPerReference},
        )
    }

    return maxCandidatesPerReference
}

/**
 * Normalizes optional file-path filter.
 *
 * @param filePaths Raw filter paths.
 * @returns Sorted unique normalized paths or undefined.
 */
function normalizeFilePathFilter(filePaths?: readonly string[]): readonly string[] | undefined {
    if (filePaths === undefined) {
        return undefined
    }

    if (filePaths.length === 0) {
        throw new AstCrossFileReferenceResolutionError(
            AST_CROSS_FILE_REFERENCE_RESOLUTION_ERROR_CODE.EMPTY_FILE_PATHS,
        )
    }

    const normalizedPaths = new Set<string>()

    for (const filePath of filePaths) {
        normalizedPaths.add(normalizeFilePath(filePath))
    }

    return [...normalizedPaths].sort()
}

/**
 * Normalizes parsed-file input and validates duplicate paths.
 *
 * @param files Parsed source files.
 * @returns Sorted normalized files.
 */
function normalizeParsedFiles(files: readonly IParsedSourceFileDTO[]): readonly INormalizedParsedFile[] {
    if (files.length === 0) {
        throw new AstCrossFileReferenceResolutionError(
            AST_CROSS_FILE_REFERENCE_RESOLUTION_ERROR_CODE.EMPTY_FILES,
        )
    }

    const seenPaths = new Set<string>()
    const normalizedFiles: INormalizedParsedFile[] = []

    for (const file of files) {
        const filePath = normalizeFilePath(file.filePath)

        if (seenPaths.has(filePath)) {
            throw new AstCrossFileReferenceResolutionError(
                AST_CROSS_FILE_REFERENCE_RESOLUTION_ERROR_CODE.DUPLICATE_FILE_PATH,
                {filePath},
            )
        }

        seenPaths.add(filePath)
        normalizedFiles.push({
            filePath,
            parsedFile: file,
            directoryPath: pathPosix.dirname(filePath),
        })
    }

    return normalizedFiles.sort((left, right) => left.filePath.localeCompare(right.filePath))
}

/**
 * Applies optional source-file batch filter.
 *
 * @param files Normalized files.
 * @param filePaths Optional source-file filter.
 * @returns Filtered source files.
 */
function filterSourceFiles(
    files: readonly INormalizedParsedFile[],
    filePaths?: readonly string[],
): readonly INormalizedParsedFile[] {
    if (filePaths === undefined) {
        return files
    }

    const pathSet = new Set<string>(filePaths)
    return files.filter((file) => pathSet.has(file.filePath))
}

/**
 * Creates lookup for normalized files by path.
 *
 * @param files Normalized files.
 * @returns File lookup.
 */
function createFileLookup(
    files: readonly INormalizedParsedFile[],
): ReadonlyMap<string, INormalizedParsedFile> {
    const entries = files.map((file): readonly [string, INormalizedParsedFile] => {
        return [file.filePath, file]
    })

    return new Map<string, INormalizedParsedFile>(entries)
}

/**
 * Creates callable symbol index across files.
 *
 * @param files Normalized files.
 * @returns Callable symbol index.
 */
function createCallableSymbolIndex(
    files: readonly INormalizedParsedFile[],
): ReadonlyMap<string, readonly IReferenceSymbolCandidate[]> {
    const index = new Map<string, IReferenceSymbolCandidate[]>()

    for (const file of files) {
        for (const fn of file.parsedFile.functions) {
            if (fn.exported === false) {
                continue
            }

            addCandidate(index, normalizeSymbolKey(fn.name), {
                filePath: file.filePath,
                symbol: fn.name,
            })
        }
    }

    return freezeSymbolIndex(index)
}

/**
 * Creates type symbol index across files.
 *
 * @param files Normalized files.
 * @returns Type symbol index.
 */
function createTypeSymbolIndex(
    files: readonly INormalizedParsedFile[],
): ReadonlyMap<string, readonly IReferenceSymbolCandidate[]> {
    const index = new Map<string, IReferenceSymbolCandidate[]>()

    for (const file of files) {
        for (const declaration of file.parsedFile.classes) {
            if (declaration.exported === false) {
                continue
            }
            addCandidate(index, normalizeSymbolKey(declaration.name), {
                filePath: file.filePath,
                symbol: declaration.name,
            })
        }

        for (const declaration of file.parsedFile.interfaces) {
            if (declaration.exported === false) {
                continue
            }
            addCandidate(index, normalizeSymbolKey(declaration.name), {
                filePath: file.filePath,
                symbol: declaration.name,
            })
        }

        for (const declaration of file.parsedFile.typeAliases) {
            if (declaration.exported === false) {
                continue
            }
            addCandidate(index, normalizeSymbolKey(declaration.name), {
                filePath: file.filePath,
                symbol: declaration.name,
            })
        }

        for (const declaration of file.parsedFile.enums) {
            if (declaration.exported === false) {
                continue
            }
            addCandidate(index, normalizeSymbolKey(declaration.name), {
                filePath: file.filePath,
                symbol: declaration.name,
            })
        }
    }

    return freezeSymbolIndex(index)
}

/**
 * Adds one symbol candidate into mutable index.
 *
 * @param index Mutable index.
 * @param key Symbol key.
 * @param candidate Symbol candidate.
 */
function addCandidate(
    index: Map<string, IReferenceSymbolCandidate[]>,
    key: string,
    candidate: IReferenceSymbolCandidate,
): void {
    const bucket = index.get(key)

    if (bucket === undefined) {
        index.set(key, [candidate])
        return
    }

    bucket.push(candidate)
}

/**
 * Freezes mutable symbol index into deterministic immutable map.
 *
 * @param index Mutable symbol index.
 * @returns Immutable index.
 */
function freezeSymbolIndex(
    index: Map<string, IReferenceSymbolCandidate[]>,
): ReadonlyMap<string, readonly IReferenceSymbolCandidate[]> {
    const entries = [...index.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, candidates]): [string, readonly IReferenceSymbolCandidate[]] => {
            const sortedCandidates = [...candidates].sort(compareSymbolCandidates)
            return [key, sortedCandidates]
        })

    return new Map<string, readonly IReferenceSymbolCandidate[]>(entries)
}

/**
 * Resolves import references for one source file.
 *
 * @param sourceFile Source file.
 * @param fileLookup File lookup.
 * @param minimumConfidence Minimum accepted confidence.
 * @returns Import references and unresolved import entries.
 */
function resolveImportReferences(
    sourceFile: INormalizedParsedFile,
    fileLookup: ReadonlyMap<string, INormalizedParsedFile>,
    minimumConfidence: number,
): IImportResolutionResult {
    const references: IAstCrossFileReference[] = []
    const unresolvedReferences: IAstUnresolvedCrossFileReference[] = []
    const importedTargetPaths = new Set<string>()

    for (const statement of sourceFile.parsedFile.imports) {
        if (isRelativeImport(statement.source) === false) {
            continue
        }

        const candidates = buildRelativeImportCandidates(sourceFile.directoryPath, statement.source)
        const resolvedTarget = candidates.find((candidate) => fileLookup.has(candidate))

        if (resolvedTarget === undefined) {
            unresolvedReferences.push({
                type: AST_CROSS_FILE_REFERENCE_TYPE.IMPORT,
                sourceFilePath: sourceFile.filePath,
                symbol: statement.source,
                candidateFilePaths: candidates,
                reason: UNRESOLVED_REASON.RELATIVE_IMPORT_NOT_FOUND,
            })
            continue
        }

        importedTargetPaths.add(resolvedTarget)
        addResolvedReferenceOrUnresolvedFallback(
            references,
            unresolvedReferences,
            {
                type: AST_CROSS_FILE_REFERENCE_TYPE.IMPORT,
                sourceFilePath: sourceFile.filePath,
                targetFilePath: resolvedTarget,
                sourceSymbol: statement.source,
                confidence: 1,
            },
            minimumConfidence,
        )
    }

    return {
        references,
        unresolvedReferences,
        importedTargetPaths,
    }
}

/**
 * Resolves call references for one source file.
 *
 * @param sourceFile Source file.
 * @param callableIndex Callable symbol index.
 * @param importedTargetPaths Resolved imported targets.
 * @param config Runtime config.
 * @returns Call references and unresolved entries.
 */
function resolveCallReferences(
    sourceFile: INormalizedParsedFile,
    callableIndex: ReadonlyMap<string, readonly IReferenceSymbolCandidate[]>,
    importedTargetPaths: ReadonlySet<string>,
    config: IResolvedReferenceConfig,
): {readonly references: readonly IAstCrossFileReference[]; readonly unresolvedReferences: readonly IAstUnresolvedCrossFileReference[]} {
    const references: IAstCrossFileReference[] = []
    const unresolvedReferences: IAstUnresolvedCrossFileReference[] = []

    for (const call of sourceFile.parsedFile.calls) {
        const symbol = extractCallSymbol(call.callee)

        if (symbol === undefined) {
            continue
        }

        const candidates = excludeSameFileCandidates(
            callableIndex.get(normalizeSymbolKey(symbol)) ?? [],
            sourceFile.filePath,
        )
        const outcome = resolveCandidateOutcome(
            candidates,
            importedTargetPaths,
            config.maxCandidatesPerReference,
            0.8,
            0.7,
        )

        if (outcome.status === "resolved") {
            addResolvedReferenceOrUnresolvedFallback(
                references,
                unresolvedReferences,
                {
                    type: AST_CROSS_FILE_REFERENCE_TYPE.CALL,
                    sourceFilePath: sourceFile.filePath,
                    sourceSymbol: symbol,
                    targetFilePath: outcome.candidate.filePath,
                    targetSymbol: outcome.candidate.symbol,
                    confidence: outcome.confidence,
                },
                config.minimumConfidence,
            )
            continue
        }

        unresolvedReferences.push({
            type: AST_CROSS_FILE_REFERENCE_TYPE.CALL,
            sourceFilePath: sourceFile.filePath,
            symbol,
            candidateFilePaths: outcome.candidateFilePaths,
            reason: outcome.reason,
        })
    }

    return {
        references,
        unresolvedReferences,
    }
}

/**
 * Resolves type references for one source file.
 *
 * @param sourceFile Source file.
 * @param typeIndex Type symbol index.
 * @param importedTargetPaths Resolved imported targets.
 * @param config Runtime config.
 * @returns Type references and unresolved entries.
 */
function resolveTypeReferences(
    sourceFile: INormalizedParsedFile,
    typeIndex: ReadonlyMap<string, readonly IReferenceSymbolCandidate[]>,
    importedTargetPaths: ReadonlySet<string>,
    config: IResolvedReferenceConfig,
): {readonly references: readonly IAstCrossFileReference[]; readonly unresolvedReferences: readonly IAstUnresolvedCrossFileReference[]} {
    const references: IAstCrossFileReference[] = []
    const unresolvedReferences: IAstUnresolvedCrossFileReference[] = []
    const rawTypeNames = collectTypeReferenceNames(sourceFile.parsedFile)

    for (const rawTypeName of rawTypeNames) {
        const symbol = normalizeTypeName(rawTypeName)

        if (symbol === undefined) {
            continue
        }

        const candidates = excludeSameFileCandidates(
            typeIndex.get(normalizeSymbolKey(symbol)) ?? [],
            sourceFile.filePath,
        )
        const outcome = resolveCandidateOutcome(
            candidates,
            importedTargetPaths,
            config.maxCandidatesPerReference,
            0.9,
            0.75,
        )

        if (outcome.status === "resolved") {
            addResolvedReferenceOrUnresolvedFallback(
                references,
                unresolvedReferences,
                {
                    type: AST_CROSS_FILE_REFERENCE_TYPE.TYPE,
                    sourceFilePath: sourceFile.filePath,
                    sourceSymbol: symbol,
                    targetFilePath: outcome.candidate.filePath,
                    targetSymbol: outcome.candidate.symbol,
                    confidence: outcome.confidence,
                },
                config.minimumConfidence,
            )
            continue
        }

        unresolvedReferences.push({
            type: AST_CROSS_FILE_REFERENCE_TYPE.TYPE,
            sourceFilePath: sourceFile.filePath,
            symbol,
            candidateFilePaths: outcome.candidateFilePaths,
            reason: outcome.reason,
        })
    }

    return {
        references,
        unresolvedReferences,
    }
}

/**
 * Resolves best candidate or unresolved metadata.
 *
 * @param candidates Candidate symbols.
 * @param importedTargetPaths Imported target paths for disambiguation.
 * @param maxCandidatesPerReference Max unresolved candidates to persist.
 * @param importedConfidence Confidence when disambiguated by imports.
 * @param directConfidence Confidence when single unambiguous candidate exists.
 * @returns Candidate resolution outcome.
 */
function resolveCandidateOutcome(
    candidates: readonly IReferenceSymbolCandidate[],
    importedTargetPaths: ReadonlySet<string>,
    maxCandidatesPerReference: number,
    importedConfidence: number,
    directConfidence: number,
): CandidateResolutionOutcome {
    if (candidates.length === 0) {
        return {
            status: "unresolved",
            reason: UNRESOLVED_REASON.SYMBOL_NOT_FOUND,
            candidateFilePaths: [],
        }
    }

    const importedCandidates = candidates.filter((candidate) => {
        return importedTargetPaths.has(candidate.filePath)
    })

    if (importedCandidates.length === 1) {
        const importedCandidate = importedCandidates[0]
        if (importedCandidate !== undefined) {
            return {
                status: "resolved",
                candidate: importedCandidate,
                confidence: importedConfidence,
            }
        }
    }

    if (candidates.length === 1) {
        const singleCandidate = candidates[0]
        if (singleCandidate !== undefined) {
            return {
                status: "resolved",
                candidate: singleCandidate,
                confidence: directConfidence,
            }
        }
    }

    return {
        status: "unresolved",
        reason: UNRESOLVED_REASON.AMBIGUOUS_SYMBOL,
        candidateFilePaths: candidates
            .map((candidate) => candidate.filePath)
            .slice(0, maxCandidatesPerReference),
    }
}

/**
 * Adds resolved reference or unresolved low-confidence fallback.
 *
 * @param references Mutable resolved references.
 * @param unresolvedReferences Mutable unresolved references.
 * @param reference Candidate resolved reference.
 * @param minimumConfidence Minimum confidence threshold.
 */
function addResolvedReferenceOrUnresolvedFallback(
    references: IAstCrossFileReference[],
    unresolvedReferences: IAstUnresolvedCrossFileReference[],
    reference: Omit<IAstCrossFileReference, "id">,
    minimumConfidence: number,
): void {
    if (reference.confidence < minimumConfidence) {
        unresolvedReferences.push({
            type: reference.type,
            sourceFilePath: reference.sourceFilePath,
            symbol: reference.sourceSymbol ?? reference.targetSymbol ?? "",
            candidateFilePaths: [reference.targetFilePath],
            reason: UNRESOLVED_REASON.LOW_CONFIDENCE,
        })
        return
    }

    references.push({
        ...reference,
        id: createReferenceId(reference),
    })
}

/**
 * Collects type reference names from class/interface inheritance declarations.
 *
 * @param file Parsed source file.
 * @returns Raw type reference names.
 */
function collectTypeReferenceNames(file: IParsedSourceFileDTO): readonly string[] {
    const names: string[] = []

    for (const declaration of file.classes) {
        names.push(...declaration.extendsTypes)
        names.push(...declaration.implementsTypes)
    }

    for (const declaration of file.interfaces) {
        names.push(...declaration.extendsTypes)
    }

    return names
}

/**
 * Builds candidate target file paths for one relative import.
 *
 * @param directoryPath Source file directory.
 * @param importSource Relative import source.
 * @returns Candidate target file paths.
 */
function buildRelativeImportCandidates(
    directoryPath: string,
    importSource: string,
): readonly string[] {
    const normalizedSource = pathPosix.normalize(pathPosix.join(directoryPath, importSource))
    const candidates = new Set<string>()
    const extension = pathPosix.extname(normalizedSource)

    if (extension.length > 0) {
        candidates.add(normalizedSource)
    } else {
        for (const item of FILE_EXTENSION_CANDIDATES) {
            candidates.add(`${normalizedSource}${item}`)
            candidates.add(pathPosix.join(normalizedSource, `index${item}`))
        }
    }

    return [...candidates].map((candidate) => {
        return normalizeFilePath(candidate)
    })
}

/**
 * Deduplicates and sorts resolved references deterministically.
 *
 * @param references Mutable resolved references.
 * @returns Sorted unique resolved references.
 */
function deduplicateAndSortReferences(
    references: readonly IAstCrossFileReference[],
): readonly IAstCrossFileReference[] {
    const uniqueById = new Map<string, IAstCrossFileReference>()

    for (const reference of references) {
        uniqueById.set(reference.id, reference)
    }

    return [...uniqueById.values()].sort(compareReferences)
}

/**
 * Deduplicates and sorts unresolved references deterministically.
 *
 * @param unresolvedReferences Mutable unresolved references.
 * @returns Sorted unique unresolved references.
 */
function deduplicateAndSortUnresolved(
    unresolvedReferences: readonly IAstUnresolvedCrossFileReference[],
): readonly IAstUnresolvedCrossFileReference[] {
    const uniqueByKey = new Map<string, IAstUnresolvedCrossFileReference>()

    for (const unresolvedReference of unresolvedReferences) {
        const key = createUnresolvedKey(unresolvedReference)
        uniqueByKey.set(key, unresolvedReference)
    }

    return [...uniqueByKey.values()].sort(compareUnresolvedReferences)
}

/**
 * Builds summary payload from resolution result.
 *
 * @param scannedFileCount Number of analyzed source files.
 * @param references Resolved references.
 * @param unresolvedReferenceCount Number of unresolved references.
 * @returns Aggregated summary.
 */
function createSummary(
    scannedFileCount: number,
    references: readonly IAstCrossFileReference[],
    unresolvedReferenceCount: number,
): IAstCrossFileReferenceResolutionSummary {
    const byType: Record<AstCrossFileReferenceType, number> = {
        CALL: 0,
        IMPORT: 0,
        TYPE: 0,
    }

    for (const reference of references) {
        byType[reference.type] += 1
    }

    return {
        scannedFileCount,
        resolvedReferenceCount: references.length,
        unresolvedReferenceCount,
        byType,
    }
}

/**
 * Creates stable identifier for resolved reference.
 *
 * @param reference Candidate reference.
 * @returns Stable reference id.
 */
function createReferenceId(reference: Omit<IAstCrossFileReference, "id">): string {
    return [
        reference.type,
        reference.sourceFilePath,
        reference.sourceSymbol ?? "",
        reference.targetFilePath,
        reference.targetSymbol ?? "",
    ].join("|")
}

/**
 * Creates stable key for unresolved reference.
 *
 * @param unresolvedReference Unresolved reference.
 * @returns Stable unresolved key.
 */
function createUnresolvedKey(unresolvedReference: IAstUnresolvedCrossFileReference): string {
    return [
        unresolvedReference.type,
        unresolvedReference.sourceFilePath,
        unresolvedReference.symbol,
        unresolvedReference.reason,
        unresolvedReference.candidateFilePaths.join(","),
    ].join("|")
}

/**
 * Compares resolved references deterministically.
 *
 * @param left Left reference.
 * @param right Right reference.
 * @returns Sort result.
 */
function compareReferences(left: IAstCrossFileReference, right: IAstCrossFileReference): number {
    const leftTypeIndex = REFERENCE_TYPE_ORDER.indexOf(left.type)
    const rightTypeIndex = REFERENCE_TYPE_ORDER.indexOf(right.type)

    if (leftTypeIndex !== rightTypeIndex) {
        return leftTypeIndex - rightTypeIndex
    }

    const sourceCompare = left.sourceFilePath.localeCompare(right.sourceFilePath)
    if (sourceCompare !== 0) {
        return sourceCompare
    }

    const targetCompare = left.targetFilePath.localeCompare(right.targetFilePath)
    if (targetCompare !== 0) {
        return targetCompare
    }

    const sourceSymbolCompare = (left.sourceSymbol ?? "").localeCompare(right.sourceSymbol ?? "")
    if (sourceSymbolCompare !== 0) {
        return sourceSymbolCompare
    }

    return (left.targetSymbol ?? "").localeCompare(right.targetSymbol ?? "")
}

/**
 * Compares unresolved references deterministically.
 *
 * @param left Left unresolved reference.
 * @param right Right unresolved reference.
 * @returns Sort result.
 */
function compareUnresolvedReferences(
    left: IAstUnresolvedCrossFileReference,
    right: IAstUnresolvedCrossFileReference,
): number {
    const leftTypeIndex = REFERENCE_TYPE_ORDER.indexOf(left.type)
    const rightTypeIndex = REFERENCE_TYPE_ORDER.indexOf(right.type)

    if (leftTypeIndex !== rightTypeIndex) {
        return leftTypeIndex - rightTypeIndex
    }

    const sourceCompare = left.sourceFilePath.localeCompare(right.sourceFilePath)
    if (sourceCompare !== 0) {
        return sourceCompare
    }

    const symbolCompare = left.symbol.localeCompare(right.symbol)
    if (symbolCompare !== 0) {
        return symbolCompare
    }

    return left.reason.localeCompare(right.reason)
}

/**
 * Compares symbol candidates deterministically.
 *
 * @param left Left symbol candidate.
 * @param right Right symbol candidate.
 * @returns Sort result.
 */
function compareSymbolCandidates(
    left: IReferenceSymbolCandidate,
    right: IReferenceSymbolCandidate,
): number {
    const filePathCompare = left.filePath.localeCompare(right.filePath)
    if (filePathCompare !== 0) {
        return filePathCompare
    }

    return left.symbol.localeCompare(right.symbol)
}

/**
 * Excludes candidates from source file path.
 *
 * @param candidates Symbol candidates.
 * @param sourceFilePath Source file path.
 * @returns Candidates excluding source file.
 */
function excludeSameFileCandidates(
    candidates: readonly IReferenceSymbolCandidate[],
    sourceFilePath: string,
): readonly IReferenceSymbolCandidate[] {
    return candidates.filter((candidate) => candidate.filePath !== sourceFilePath)
}

/**
 * Extracts call symbol from call expression text.
 *
 * @param expression Raw callee expression.
 * @returns Extracted symbol when available.
 */
function extractCallSymbol(expression: string): string | undefined {
    const matches = expression.match(/[A-Za-z_$][A-Za-z0-9_$]*/g)

    if (matches === null || matches.length === 0) {
        return undefined
    }

    const lastMatch = matches.at(-1)
    if (lastMatch === undefined || lastMatch.length === 0) {
        return undefined
    }

    return lastMatch
}

/**
 * Normalizes type reference name.
 *
 * @param typeName Raw type reference.
 * @returns Normalized symbol when available.
 */
function normalizeTypeName(typeName: string): string | undefined {
    const cleanedName = typeName
        .replace(/[<>{}[\](),]/g, " ")
        .trim()
        .split(/\s+/)
        .at(0)

    if (cleanedName === undefined || cleanedName.length === 0) {
        return undefined
    }

    return cleanedName
}

/**
 * Checks whether import source is relative.
 *
 * @param importSource Raw import source.
 * @returns True when source is relative.
 */
function isRelativeImport(importSource: string): boolean {
    return importSource.startsWith("./") || importSource.startsWith("../")
}

/**
 * Normalizes one symbol key for index lookup.
 *
 * @param symbol Raw symbol name.
 * @returns Normalized symbol key.
 */
function normalizeSymbolKey(symbol: string): string {
    return symbol.trim().toLowerCase()
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
        throw new AstCrossFileReferenceResolutionError(
            AST_CROSS_FILE_REFERENCE_RESOLUTION_ERROR_CODE.INVALID_FILE_PATH,
            {filePath},
        )
    }
}
