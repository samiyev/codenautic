import {FilePath, type IParsedSourceFileDTO} from "@codenautic/core"

import {
    AST_CROSS_FILE_REFERENCE_TYPE,
    AstCrossFileReferenceResolutionService,
    type IAstCrossFileReference,
    type IAstCrossFileReferenceResolutionService,
    type IAstUnresolvedCrossFileReference,
} from "./ast-cross-file-reference-resolution.service"
import {
    AST_TYPE_FLOW_ANALYZER_ERROR_CODE,
    AstTypeFlowAnalyzerError,
} from "./ast-type-flow-analyzer.error"

const DEFAULT_MINIMUM_CONFIDENCE = 0.5
const DEFAULT_MAX_FLOWS = 500

/**
 * One resolved type-flow relation across files.
 */
export interface IAstTypeFlow {
    /**
     * Stable deterministic flow identifier.
     */
    readonly id: string

    /**
     * Source repository-relative file path.
     */
    readonly sourceFilePath: string

    /**
     * Target repository-relative file path.
     */
    readonly targetFilePath: string

    /**
     * Source type token that generated this relation.
     */
    readonly sourceType: string

    /**
     * Target resolved type symbol.
     */
    readonly targetType: string

    /**
     * Deterministic confidence score in `[0, 1]`.
     */
    readonly confidence: number
}

/**
 * One unresolved type-flow relation.
 */
export interface IAstUnresolvedTypeFlow {
    /**
     * Source repository-relative file path.
     */
    readonly sourceFilePath: string

    /**
     * Type token that could not be resolved.
     */
    readonly typeName: string

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
 * Type flow analyzer summary.
 */
export interface IAstTypeFlowAnalyzerSummary {
    /**
     * Number of analyzed source files.
     */
    readonly scannedFileCount: number

    /**
     * Number of returned resolved type flows.
     */
    readonly resolvedFlowCount: number

    /**
     * Number of unresolved type flows.
     */
    readonly unresolvedFlowCount: number

    /**
     * Number of high-confidence flows with score >= 0.9.
     */
    readonly highConfidenceFlowCount: number

    /**
     * Whether resolved flow output was truncated by max flow cap.
     */
    readonly truncated: boolean

    /**
     * Number of omitted resolved flows.
     */
    readonly truncatedFlowCount: number
}

/**
 * Type flow analyzer result payload.
 */
export interface IAstTypeFlowAnalyzerResult {
    /**
     * Deterministic resolved type flows.
     */
    readonly flows: readonly IAstTypeFlow[]

    /**
     * Deterministic unresolved type flows.
     */
    readonly unresolvedFlows: readonly IAstUnresolvedTypeFlow[]

    /**
     * Aggregated summary.
     */
    readonly summary: IAstTypeFlowAnalyzerSummary
}

/**
 * Type flow analyzer runtime input.
 */
export interface IAstTypeFlowAnalyzerInput {
    /**
     * Parsed source files.
     */
    readonly files: readonly IParsedSourceFileDTO[]

    /**
     * Optional source file-path filter.
     */
    readonly filePaths?: readonly string[]

    /**
     * Optional minimum confidence threshold.
     */
    readonly minimumConfidence?: number

    /**
     * Optional max number of returned resolved flows.
     */
    readonly maxFlows?: number
}

/**
 * Type flow analyzer service options.
 */
export interface IAstTypeFlowAnalyzerServiceOptions {
    /**
     * Optional cross-file reference resolver override.
     */
    readonly referenceResolutionService?: IAstCrossFileReferenceResolutionService

    /**
     * Optional default minimum confidence threshold.
     */
    readonly defaultMinimumConfidence?: number

    /**
     * Optional default max flow cap.
     */
    readonly defaultMaxFlows?: number
}

/**
 * Type flow analyzer service contract.
 */
export interface IAstTypeFlowAnalyzerService {
    /**
     * Analyzes type flows across files.
     *
     * @param input Parsed source files and optional runtime settings.
     * @returns Deterministic type-flow payload.
     */
    analyze(input: IAstTypeFlowAnalyzerInput): Promise<IAstTypeFlowAnalyzerResult>
}

interface IResolvedTypeFlowConfig {
    readonly filePaths?: readonly string[]
    readonly minimumConfidence: number
    readonly maxFlows: number
}

/**
 * Builds deterministic type-flow projection over cross-file type references.
 */
export class AstTypeFlowAnalyzerService implements IAstTypeFlowAnalyzerService {
    private readonly referenceResolutionService: IAstCrossFileReferenceResolutionService
    private readonly defaultMinimumConfidence: number
    private readonly defaultMaxFlows: number

    /**
     * Creates type flow analyzer service.
     *
     * @param options Optional service configuration.
     */
    public constructor(options: IAstTypeFlowAnalyzerServiceOptions = {}) {
        this.referenceResolutionService =
            options.referenceResolutionService ?? new AstCrossFileReferenceResolutionService()
        this.defaultMinimumConfidence = validateMinimumConfidence(
            options.defaultMinimumConfidence ?? DEFAULT_MINIMUM_CONFIDENCE,
        )
        this.defaultMaxFlows = validateMaxFlows(options.defaultMaxFlows ?? DEFAULT_MAX_FLOWS)
    }

    /**
     * Analyzes type flows across files.
     *
     * @param input Parsed source files and optional runtime settings.
     * @returns Deterministic type-flow payload.
     */
    public async analyze(
        input: IAstTypeFlowAnalyzerInput,
    ): Promise<IAstTypeFlowAnalyzerResult> {
        const config = this.resolveConfig(input)
        const resolution = await this.referenceResolutionService.resolve(input.files, {
            filePaths: config.filePaths,
            minimumConfidence: config.minimumConfidence,
        })
        const allFlows = collectResolvedTypeFlows(resolution.references)
        const unresolvedFlows = collectUnresolvedTypeFlows(resolution.unresolvedReferences)
        const flows = allFlows.slice(0, config.maxFlows)
        const truncatedFlowCount = Math.max(0, allFlows.length - flows.length)

        return {
            flows,
            unresolvedFlows,
            summary: createSummary(
                resolution.summary.scannedFileCount,
                flows,
                unresolvedFlows,
                truncatedFlowCount,
            ),
        }
    }

    /**
     * Resolves runtime config with validated defaults.
     *
     * @param input Runtime input.
     * @returns Validated runtime config.
     */
    private resolveConfig(input: IAstTypeFlowAnalyzerInput): IResolvedTypeFlowConfig {
        return {
            filePaths: normalizeFilePathFilter(input.filePaths),
            minimumConfidence: validateMinimumConfidence(
                input.minimumConfidence ?? this.defaultMinimumConfidence,
            ),
            maxFlows: validateMaxFlows(input.maxFlows ?? this.defaultMaxFlows),
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
        throw new AstTypeFlowAnalyzerError(
            AST_TYPE_FLOW_ANALYZER_ERROR_CODE.INVALID_MINIMUM_CONFIDENCE,
            {minimumConfidence},
        )
    }

    if (minimumConfidence < 0 || minimumConfidence > 1) {
        throw new AstTypeFlowAnalyzerError(
            AST_TYPE_FLOW_ANALYZER_ERROR_CODE.INVALID_MINIMUM_CONFIDENCE,
            {minimumConfidence},
        )
    }

    return minimumConfidence
}

/**
 * Validates max flow cap.
 *
 * @param maxFlows Raw max flow cap.
 * @returns Validated max flow cap.
 */
function validateMaxFlows(maxFlows: number): number {
    if (Number.isSafeInteger(maxFlows) === false || maxFlows < 1) {
        throw new AstTypeFlowAnalyzerError(
            AST_TYPE_FLOW_ANALYZER_ERROR_CODE.INVALID_MAX_FLOWS,
            {maxFlows},
        )
    }

    return maxFlows
}

/**
 * Normalizes optional file-path filter.
 *
 * @param filePaths Raw file-path filter.
 * @returns Sorted unique normalized file paths or undefined.
 */
function normalizeFilePathFilter(
    filePaths: readonly string[] | undefined,
): readonly string[] | undefined {
    if (filePaths === undefined) {
        return undefined
    }

    if (filePaths.length === 0) {
        throw new AstTypeFlowAnalyzerError(
            AST_TYPE_FLOW_ANALYZER_ERROR_CODE.EMPTY_FILE_PATHS,
        )
    }

    const normalizedPathSet = new Set<string>()

    for (const filePath of filePaths) {
        normalizedPathSet.add(normalizeFilePath(filePath))
    }

    return [...normalizedPathSet].sort((left, right) => left.localeCompare(right))
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
        throw new AstTypeFlowAnalyzerError(
            AST_TYPE_FLOW_ANALYZER_ERROR_CODE.INVALID_FILE_PATH,
            {filePath},
        )
    }
}

/**
 * Collects deterministic resolved type-flow relations.
 *
 * @param references Resolved cross-file references.
 * @returns Sorted unique type flows.
 */
function collectResolvedTypeFlows(
    references: readonly IAstCrossFileReference[],
): readonly IAstTypeFlow[] {
    const flows: IAstTypeFlow[] = []

    for (const reference of references) {
        if (reference.type !== AST_CROSS_FILE_REFERENCE_TYPE.TYPE) {
            continue
        }

        const flow = createTypeFlow(reference)
        flows.push(flow)
    }

    return deduplicateAndSortFlows(flows)
}

/**
 * Creates one deterministic type-flow relation from resolved type reference.
 *
 * @param reference Resolved type reference.
 * @returns Type-flow relation.
 */
function createTypeFlow(reference: IAstCrossFileReference): IAstTypeFlow {
    const sourceType = normalizeSymbol(reference.sourceSymbol ?? reference.targetSymbol)
    const targetType = normalizeSymbol(reference.targetSymbol ?? reference.sourceSymbol)

    return {
        id: createTypeFlowId(reference.sourceFilePath, reference.targetFilePath, sourceType, targetType),
        sourceFilePath: reference.sourceFilePath,
        targetFilePath: reference.targetFilePath,
        sourceType,
        targetType,
        confidence: reference.confidence,
    }
}

/**
 * Creates stable type-flow identifier.
 *
 * @param sourceFilePath Source file path.
 * @param targetFilePath Target file path.
 * @param sourceType Source type token.
 * @param targetType Target type token.
 * @returns Stable identifier.
 */
function createTypeFlowId(
    sourceFilePath: string,
    targetFilePath: string,
    sourceType: string,
    targetType: string,
): string {
    return [sourceFilePath, targetFilePath, sourceType, targetType].join("|")
}

/**
 * Normalizes optional type symbol for stable output.
 *
 * @param symbol Optional symbol.
 * @returns Normalized symbol.
 */
function normalizeSymbol(symbol: string | undefined): string {
    const normalized = symbol?.trim() ?? ""
    return normalized.length > 0 ? normalized : "<unknown>"
}

/**
 * Deduplicates and sorts resolved flows deterministically.
 *
 * @param flows Mutable flow list.
 * @returns Sorted unique flow list.
 */
function deduplicateAndSortFlows(
    flows: readonly IAstTypeFlow[],
): readonly IAstTypeFlow[] {
    const uniqueById = new Map<string, IAstTypeFlow>()

    for (const flow of flows) {
        uniqueById.set(flow.id, flow)
    }

    return [...uniqueById.values()].sort(compareFlows)
}

/**
 * Compares resolved flows deterministically.
 *
 * @param left Left flow.
 * @param right Right flow.
 * @returns Sort result.
 */
function compareFlows(left: IAstTypeFlow, right: IAstTypeFlow): number {
    const sourceFileCompare = left.sourceFilePath.localeCompare(right.sourceFilePath)
    if (sourceFileCompare !== 0) {
        return sourceFileCompare
    }

    const sourceTypeCompare = left.sourceType.localeCompare(right.sourceType)
    if (sourceTypeCompare !== 0) {
        return sourceTypeCompare
    }

    const targetFileCompare = left.targetFilePath.localeCompare(right.targetFilePath)
    if (targetFileCompare !== 0) {
        return targetFileCompare
    }

    return left.targetType.localeCompare(right.targetType)
}

/**
 * Collects deterministic unresolved type-flow entries.
 *
 * @param unresolvedReferences Unresolved cross-file references.
 * @returns Sorted unresolved type flows.
 */
function collectUnresolvedTypeFlows(
    unresolvedReferences: readonly IAstUnresolvedCrossFileReference[],
): readonly IAstUnresolvedTypeFlow[] {
    const unresolvedFlows: IAstUnresolvedTypeFlow[] = []

    for (const unresolvedReference of unresolvedReferences) {
        if (unresolvedReference.type !== AST_CROSS_FILE_REFERENCE_TYPE.TYPE) {
            continue
        }

        unresolvedFlows.push({
            sourceFilePath: unresolvedReference.sourceFilePath,
            typeName: unresolvedReference.symbol,
            candidateFilePaths: [...unresolvedReference.candidateFilePaths].sort((left, right) => {
                return left.localeCompare(right)
            }),
            reason: unresolvedReference.reason,
        })
    }

    return deduplicateAndSortUnresolvedFlows(unresolvedFlows)
}

/**
 * Deduplicates and sorts unresolved flows deterministically.
 *
 * @param unresolvedFlows Mutable unresolved flow list.
 * @returns Sorted unique unresolved flow list.
 */
function deduplicateAndSortUnresolvedFlows(
    unresolvedFlows: readonly IAstUnresolvedTypeFlow[],
): readonly IAstUnresolvedTypeFlow[] {
    const uniqueByKey = new Map<string, IAstUnresolvedTypeFlow>()

    for (const unresolvedFlow of unresolvedFlows) {
        uniqueByKey.set(createUnresolvedFlowKey(unresolvedFlow), unresolvedFlow)
    }

    return [...uniqueByKey.values()].sort(compareUnresolvedFlows)
}

/**
 * Creates stable key for unresolved type-flow entry.
 *
 * @param unresolvedFlow Unresolved type-flow entry.
 * @returns Stable key.
 */
function createUnresolvedFlowKey(unresolvedFlow: IAstUnresolvedTypeFlow): string {
    return [
        unresolvedFlow.sourceFilePath,
        unresolvedFlow.typeName,
        unresolvedFlow.reason,
        unresolvedFlow.candidateFilePaths.join(","),
    ].join("|")
}

/**
 * Compares unresolved flows deterministically.
 *
 * @param left Left unresolved flow.
 * @param right Right unresolved flow.
 * @returns Sort result.
 */
function compareUnresolvedFlows(
    left: IAstUnresolvedTypeFlow,
    right: IAstUnresolvedTypeFlow,
): number {
    const sourceFileCompare = left.sourceFilePath.localeCompare(right.sourceFilePath)
    if (sourceFileCompare !== 0) {
        return sourceFileCompare
    }

    const typeNameCompare = left.typeName.localeCompare(right.typeName)
    if (typeNameCompare !== 0) {
        return typeNameCompare
    }

    return left.reason.localeCompare(right.reason)
}

/**
 * Builds aggregated summary from resolved and unresolved flows.
 *
 * @param scannedFileCount Number of analyzed source files.
 * @param flows Resolved type flows.
 * @param unresolvedFlows Unresolved type flows.
 * @param truncatedFlowCount Number of omitted resolved flows.
 * @returns Aggregated summary.
 */
function createSummary(
    scannedFileCount: number,
    flows: readonly IAstTypeFlow[],
    unresolvedFlows: readonly IAstUnresolvedTypeFlow[],
    truncatedFlowCount: number,
): IAstTypeFlowAnalyzerSummary {
    const highConfidenceFlowCount = flows.filter((flow) => flow.confidence >= 0.9).length

    return {
        scannedFileCount,
        resolvedFlowCount: flows.length,
        unresolvedFlowCount: unresolvedFlows.length,
        highConfidenceFlowCount,
        truncated: truncatedFlowCount > 0,
        truncatedFlowCount,
    }
}
