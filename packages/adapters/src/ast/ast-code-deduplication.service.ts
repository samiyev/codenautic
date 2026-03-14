import {FilePath, type IParsedSourceFileDTO} from "@codenautic/core"

import {
    AST_CODE_DEDUPLICATION_ERROR_CODE,
    AstCodeDeduplicationError,
} from "./ast-code-deduplication.error"

const DEFAULT_MINIMUM_SIMILARITY = 0.8
const DEFAULT_MINIMUM_FEATURE_COUNT = 3

/**
 * One duplicate pair detected by AST structural similarity.
 */
export interface IAstCodeDuplicatePair {
    /**
     * First file path in deterministic pair order.
     */
    readonly sourceFilePath: string

    /**
     * Second file path in deterministic pair order.
     */
    readonly targetFilePath: string

    /**
     * Jaccard similarity score in `[0, 1]` range.
     */
    readonly similarity: number

    /**
     * Number of shared structural features.
     */
    readonly sharedFeatureCount: number

    /**
     * Number of features in source file.
     */
    readonly sourceFeatureCount: number

    /**
     * Number of features in target file.
     */
    readonly targetFeatureCount: number

    /**
     * Shared normalized features sorted in deterministic order.
     */
    readonly sharedFeatures: readonly string[]
}

/**
 * Summary payload for deduplication execution.
 */
export interface IAstCodeDeduplicationSummary {
    /**
     * Number of files participating in comparison.
     */
    readonly scannedFileCount: number

    /**
     * Number of evaluated file pairs.
     */
    readonly comparedPairs: number

    /**
     * Number of pairs that satisfied similarity threshold.
     */
    readonly duplicatePairCount: number
}

/**
 * Output payload for AST-based deduplication.
 */
export interface IAstCodeDeduplicationResult {
    /**
     * Duplicate pairs sorted by score and path.
     */
    readonly duplicatePairs: readonly IAstCodeDuplicatePair[]

    /**
     * Execution summary for diagnostics.
     */
    readonly summary: IAstCodeDeduplicationSummary
}

/**
 * Runtime options for AST-based deduplication.
 */
export interface IAstCodeDeduplicationInput {
    /**
     * Optional subset of repository-relative paths included in batch analysis.
     */
    readonly filePaths?: readonly string[]

    /**
     * Optional minimum Jaccard similarity in `[0, 1]`.
     */
    readonly minimumSimilarity?: number

    /**
     * Optional minimum feature count per file required for comparison.
     */
    readonly minimumFeatureCount?: number
}

/**
 * Construction options for AST-based deduplication.
 */
export interface IAstCodeDeduplicationServiceOptions {
    /**
     * Optional default minimum Jaccard similarity in `[0, 1]`.
     */
    readonly defaultMinimumSimilarity?: number

    /**
     * Optional default minimum feature count per file required for comparison.
     */
    readonly defaultMinimumFeatureCount?: number
}

/**
 * AST-based deduplication service contract.
 */
export interface IAstCodeDeduplicationService {
    /**
     * Detects duplicate file pairs via AST structural similarity.
     *
     * @param files Parsed source files to compare.
     * @param input Optional runtime configuration.
     * @returns Deterministic duplicate pair report.
     */
    findDuplicates(
        files: readonly IParsedSourceFileDTO[],
        input?: IAstCodeDeduplicationInput,
    ): Promise<IAstCodeDeduplicationResult>
}

interface IResolvedDeduplicationConfig {
    readonly filePaths?: readonly string[]
    readonly minimumSimilarity: number
    readonly minimumFeatureCount: number
}

interface IPreparedFileFeatures {
    readonly filePath: string
    readonly features: ReadonlySet<string>
}

/**
 * AST-based code deduplication using feature-level Jaccard similarity.
 */
export class AstCodeDeduplicationService implements IAstCodeDeduplicationService {
    private readonly defaultMinimumSimilarity: number
    private readonly defaultMinimumFeatureCount: number

    /**
     * Creates AST code deduplication service.
     *
     * @param options Optional defaults.
     */
    public constructor(options: IAstCodeDeduplicationServiceOptions = {}) {
        this.defaultMinimumSimilarity = validateMinimumSimilarity(
            options.defaultMinimumSimilarity ?? DEFAULT_MINIMUM_SIMILARITY,
        )
        this.defaultMinimumFeatureCount = validateMinimumFeatureCount(
            options.defaultMinimumFeatureCount ?? DEFAULT_MINIMUM_FEATURE_COUNT,
        )
    }

    /**
     * Detects duplicate file pairs from parsed AST snapshots.
     *
     * @param files Parsed source files.
     * @param input Optional runtime configuration.
     * @returns Deterministic duplicate pair report.
     */
    public findDuplicates(
        files: readonly IParsedSourceFileDTO[],
        input: IAstCodeDeduplicationInput = {},
    ): Promise<IAstCodeDeduplicationResult> {
        const config = this.resolveConfig(input)
        const preparedFiles = prepareFiles(files)
        const filteredFiles = filterPreparedFiles(preparedFiles, config.filePaths)
        const comparisonResult = comparePreparedFiles(filteredFiles, config)

        return Promise.resolve({
            duplicatePairs: comparisonResult.duplicatePairs,
            summary: {
                scannedFileCount: filteredFiles.length,
                comparedPairs: comparisonResult.comparedPairs,
                duplicatePairCount: comparisonResult.duplicatePairs.length,
            },
        })
    }

    /**
     * Resolves runtime config with validated defaults.
     *
     * @param input Runtime deduplication options.
     * @returns Validated configuration.
     */
    private resolveConfig(input: IAstCodeDeduplicationInput): IResolvedDeduplicationConfig {
        return {
            filePaths: normalizeFilePaths(input.filePaths),
            minimumSimilarity: validateMinimumSimilarity(
                input.minimumSimilarity ?? this.defaultMinimumSimilarity,
            ),
            minimumFeatureCount: validateMinimumFeatureCount(
                input.minimumFeatureCount ?? this.defaultMinimumFeatureCount,
            ),
        }
    }
}

/**
 * Validates minimum Jaccard similarity.
 *
 * @param minimumSimilarity Raw similarity threshold.
 * @returns Validated threshold.
 */
function validateMinimumSimilarity(minimumSimilarity: number): number {
    if (Number.isFinite(minimumSimilarity) === false) {
        throw new AstCodeDeduplicationError(
            AST_CODE_DEDUPLICATION_ERROR_CODE.INVALID_MINIMUM_SIMILARITY,
            {minimumSimilarity},
        )
    }

    if (minimumSimilarity < 0 || minimumSimilarity > 1) {
        throw new AstCodeDeduplicationError(
            AST_CODE_DEDUPLICATION_ERROR_CODE.INVALID_MINIMUM_SIMILARITY,
            {minimumSimilarity},
        )
    }

    return minimumSimilarity
}

/**
 * Validates minimum feature count threshold.
 *
 * @param minimumFeatureCount Raw feature-count threshold.
 * @returns Validated threshold.
 */
function validateMinimumFeatureCount(minimumFeatureCount: number): number {
    if (Number.isSafeInteger(minimumFeatureCount) === false || minimumFeatureCount < 1) {
        throw new AstCodeDeduplicationError(
            AST_CODE_DEDUPLICATION_ERROR_CODE.INVALID_MINIMUM_FEATURE_COUNT,
            {minimumFeatureCount},
        )
    }

    return minimumFeatureCount
}

/**
 * Normalizes optional file-path filter.
 *
 * @param filePaths Raw file paths.
 * @returns Normalized sorted file paths or undefined.
 */
function normalizeFilePaths(filePaths?: readonly string[]): readonly string[] | undefined {
    if (filePaths === undefined) {
        return undefined
    }

    if (filePaths.length === 0) {
        throw new AstCodeDeduplicationError(AST_CODE_DEDUPLICATION_ERROR_CODE.EMPTY_FILE_PATHS)
    }

    const normalizedPaths = new Set<string>()

    for (const filePath of filePaths) {
        normalizedPaths.add(normalizeFilePath(filePath))
    }

    return [...normalizedPaths].sort()
}

/**
 * Prepares files for similarity comparison.
 *
 * @param files Parsed source files.
 * @returns Prepared file payload.
 */
function prepareFiles(files: readonly IParsedSourceFileDTO[]): readonly IPreparedFileFeatures[] {
    if (files.length === 0) {
        throw new AstCodeDeduplicationError(AST_CODE_DEDUPLICATION_ERROR_CODE.EMPTY_FILES)
    }

    const prepared: IPreparedFileFeatures[] = []
    const seenPaths = new Set<string>()

    for (const file of files) {
        const normalizedFilePath = normalizeFilePath(file.filePath)

        if (seenPaths.has(normalizedFilePath)) {
            throw new AstCodeDeduplicationError(
                AST_CODE_DEDUPLICATION_ERROR_CODE.DUPLICATE_FILE_PATH,
                {filePath: normalizedFilePath},
            )
        }

        seenPaths.add(normalizedFilePath)
        prepared.push({
            filePath: normalizedFilePath,
            features: extractFeatures(file),
        })
    }

    return prepared.sort((left, right) => left.filePath.localeCompare(right.filePath))
}

/**
 * Applies optional file-path batch filter to prepared files.
 *
 * @param preparedFiles Prepared file payload.
 * @param filePaths Optional file-path filter.
 * @returns Filtered prepared file list.
 */
function filterPreparedFiles(
    preparedFiles: readonly IPreparedFileFeatures[],
    filePaths?: readonly string[],
): readonly IPreparedFileFeatures[] {
    if (filePaths === undefined) {
        return preparedFiles
    }

    const filePathSet = new Set<string>(filePaths)
    return preparedFiles.filter((preparedFile) => filePathSet.has(preparedFile.filePath))
}

/**
 * Extracts deterministic structural features from one parsed file.
 *
 * @param file Parsed file DTO.
 * @returns Structural feature set.
 */
function extractFeatures(file: IParsedSourceFileDTO): ReadonlySet<string> {
    const features = new Set<string>()
    const language = normalizeFeatureToken(file.language)

    addMetaFeatures(features, language, file)
    addImportFeatures(features, file)
    addTypeAliasFeatures(features, file)
    addInterfaceFeatures(features, file)
    addEnumFeatures(features, file)
    addClassFeatures(features, file)
    addFunctionFeatures(features, file)
    addCallFeatures(features, file)

    return features
}

/**
 * Adds global file metadata features.
 *
 * @param features Mutable feature set.
 * @param language Normalized language token.
 * @param file Parsed file DTO.
 */
function addMetaFeatures(
    features: Set<string>,
    language: string,
    file: IParsedSourceFileDTO,
): void {
    features.add(`meta:language:${language}`)
    features.add(`meta:imports:${file.imports.length}`)
    features.add(`meta:classes:${file.classes.length}`)
    features.add(`meta:functions:${file.functions.length}`)
    features.add(`meta:calls:${file.calls.length}`)
}

/**
 * Adds import-level structural features.
 *
 * @param features Mutable feature set.
 * @param file Parsed file DTO.
 */
function addImportFeatures(features: Set<string>, file: IParsedSourceFileDTO): void {
    for (const item of file.imports) {
        features.add(`import:${normalizeFeatureToken(item.source)}`)
    }
}

/**
 * Adds type-alias structural features.
 *
 * @param features Mutable feature set.
 * @param file Parsed file DTO.
 */
function addTypeAliasFeatures(features: Set<string>, file: IParsedSourceFileDTO): void {
    for (const item of file.typeAliases) {
        features.add(`type-alias:${normalizeFeatureToken(item.name)}`)
    }
}

/**
 * Adds interface-level structural features.
 *
 * @param features Mutable feature set.
 * @param file Parsed file DTO.
 */
function addInterfaceFeatures(features: Set<string>, file: IParsedSourceFileDTO): void {
    for (const item of file.interfaces) {
        const extendsCount = item.extendsTypes.length
        features.add(`interface:${normalizeFeatureToken(item.name)}:extends:${extendsCount}`)
    }
}

/**
 * Adds enum-level structural features.
 *
 * @param features Mutable feature set.
 * @param file Parsed file DTO.
 */
function addEnumFeatures(features: Set<string>, file: IParsedSourceFileDTO): void {
    for (const item of file.enums) {
        features.add(`enum:${normalizeFeatureToken(item.name)}:members:${item.members.length}`)
    }
}

/**
 * Adds class-level structural features.
 *
 * @param features Mutable feature set.
 * @param file Parsed file DTO.
 */
function addClassFeatures(features: Set<string>, file: IParsedSourceFileDTO): void {
    for (const item of file.classes) {
        const extendsCount = item.extendsTypes.length
        const implementsCount = item.implementsTypes.length
        features.add(
            `class:${normalizeFeatureToken(item.name)}:extends:${extendsCount}:implements:${implementsCount}`,
        )
    }
}

/**
 * Adds function-level structural features.
 *
 * @param features Mutable feature set.
 * @param file Parsed file DTO.
 */
function addFunctionFeatures(features: Set<string>, file: IParsedSourceFileDTO): void {
    for (const item of file.functions) {
        const parentClassName = normalizeFeatureToken(item.parentClassName ?? "")
        const asyncFlag = item.async ? "1" : "0"
        features.add(
            `function:${item.kind}:${normalizeFeatureToken(item.name)}:async:${asyncFlag}:owner:${parentClassName}`,
        )
    }
}

/**
 * Adds call-site structural features.
 *
 * @param features Mutable feature set.
 * @param file Parsed file DTO.
 */
function addCallFeatures(features: Set<string>, file: IParsedSourceFileDTO): void {
    for (const item of file.calls) {
        const caller = normalizeFeatureToken(item.caller ?? "")
        features.add(`call:${normalizeFeatureToken(item.callee)}:caller:${caller}`)
    }
}

/**
 * Normalizes one feature token.
 *
 * @param token Raw feature token.
 * @returns Normalized token.
 */
function normalizeFeatureToken(token: string): string {
    return token.trim().toLowerCase()
}

/**
 * Compares prepared files and returns duplicate pairs.
 *
 * @param preparedFiles Prepared files.
 * @param config Resolved deduplication config.
 * @returns Pair comparison result.
 */
function comparePreparedFiles(
    preparedFiles: readonly IPreparedFileFeatures[],
    config: IResolvedDeduplicationConfig,
): {readonly duplicatePairs: readonly IAstCodeDuplicatePair[]; readonly comparedPairs: number} {
    const duplicatePairs: IAstCodeDuplicatePair[] = []
    let comparedPairs = 0

    for (let index = 0; index < preparedFiles.length; index += 1) {
        const left = preparedFiles[index]
        if (left === undefined) {
            continue
        }

        for (let innerIndex = index + 1; innerIndex < preparedFiles.length; innerIndex += 1) {
            const right = preparedFiles[innerIndex]
            if (right === undefined) {
                continue
            }

            comparedPairs += 1
            const duplicatePair = comparePreparedPair(left, right, config)

            if (duplicatePair !== undefined) {
                duplicatePairs.push(duplicatePair)
            }
        }
    }

    return {
        duplicatePairs: duplicatePairs.sort(compareDuplicatePairs),
        comparedPairs,
    }
}

/**
 * Compares one file pair against deduplication thresholds.
 *
 * @param left Left file features.
 * @param right Right file features.
 * @param config Resolved deduplication config.
 * @returns Duplicate pair when thresholds are satisfied.
 */
function comparePreparedPair(
    left: IPreparedFileFeatures,
    right: IPreparedFileFeatures,
    config: IResolvedDeduplicationConfig,
): IAstCodeDuplicatePair | undefined {
    if (
        left.features.size < config.minimumFeatureCount ||
        right.features.size < config.minimumFeatureCount
    ) {
        return undefined
    }

    const sharedFeatures = collectSharedFeatures(left.features, right.features)
    const unionSize = left.features.size + right.features.size - sharedFeatures.length

    if (unionSize === 0) {
        return undefined
    }

    const similarity = roundSimilarity(sharedFeatures.length / unionSize)
    if (similarity < config.minimumSimilarity) {
        return undefined
    }

    return {
        sourceFilePath: left.filePath,
        targetFilePath: right.filePath,
        similarity,
        sharedFeatureCount: sharedFeatures.length,
        sourceFeatureCount: left.features.size,
        targetFeatureCount: right.features.size,
        sharedFeatures,
    }
}

/**
 * Collects sorted shared features for one file pair.
 *
 * @param leftFeatures Left feature set.
 * @param rightFeatures Right feature set.
 * @returns Sorted shared features.
 */
function collectSharedFeatures(
    leftFeatures: ReadonlySet<string>,
    rightFeatures: ReadonlySet<string>,
): readonly string[] {
    const sharedFeatures: string[] = []

    for (const feature of leftFeatures) {
        if (rightFeatures.has(feature) === false) {
            continue
        }

        sharedFeatures.push(feature)
    }

    return sharedFeatures.sort()
}

/**
 * Rounds similarity score for deterministic output.
 *
 * @param similarity Raw similarity.
 * @returns Rounded similarity.
 */
function roundSimilarity(similarity: number): number {
    return Math.round(similarity * 10000) / 10000
}

/**
 * Compares duplicate pairs by rank and path.
 *
 * @param left Left duplicate pair.
 * @param right Right duplicate pair.
 * @returns Sort result.
 */
function compareDuplicatePairs(left: IAstCodeDuplicatePair, right: IAstCodeDuplicatePair): number {
    if (left.similarity !== right.similarity) {
        return right.similarity - left.similarity
    }

    const sourceCompare = left.sourceFilePath.localeCompare(right.sourceFilePath)
    if (sourceCompare !== 0) {
        return sourceCompare
    }

    return left.targetFilePath.localeCompare(right.targetFilePath)
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
        throw new AstCodeDeduplicationError(
            AST_CODE_DEDUPLICATION_ERROR_CODE.INVALID_FILE_PATH,
            {filePath},
        )
    }
}
