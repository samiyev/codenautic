import {FilePath, type IParsedSourceFileDTO} from "@codenautic/core"

import {
    AST_IMPACT_RADIUS_CALCULATOR_ERROR_CODE,
    AstImpactRadiusCalculatorError,
} from "./ast-impact-radius-calculator.error"
import {
    AstImportExportGraphBuilder,
    type IAstImportExportGraphBuilder,
    type IAstImportExportGraphResult,
} from "./ast-import-export-graph-builder"

const DEFAULT_MAX_DEPTH = 6
const DEFAULT_MAX_AFFECTED_FILES = 500
const DEFAULT_DIRECTION = "INCOMING"

/**
 * Impact traversal direction.
 */
export const AST_IMPACT_RADIUS_DIRECTION = {
    OUTGOING: "OUTGOING",
    INCOMING: "INCOMING",
    BOTH: "BOTH",
} as const

/**
 * Impact traversal direction literal.
 */
export type AstImpactRadiusDirection =
    (typeof AST_IMPACT_RADIUS_DIRECTION)[keyof typeof AST_IMPACT_RADIUS_DIRECTION]

/**
 * One impacted file entry.
 */
export interface IAstImpactedFile {
    /**
     * Impacted repository-relative file path.
     */
    readonly filePath: string

    /**
     * Minimal graph distance from changed files.
     */
    readonly distance: number
}

/**
 * Impact radius summary.
 */
export interface IAstImpactRadiusCalculatorSummary {
    /**
     * Number of analyzed source files.
     */
    readonly scannedFileCount: number

    /**
     * Number of changed files present in graph.
     */
    readonly changedFileCount: number

    /**
     * Number of changed files missing in graph.
     */
    readonly missingChangedFileCount: number

    /**
     * Number of returned impacted files.
     */
    readonly affectedFileCount: number

    /**
     * Maximum distance observed among all impacted files.
     */
    readonly impactRadius: number

    /**
     * Traversal direction used for impact analysis.
     */
    readonly direction: AstImpactRadiusDirection

    /**
     * Whether impacted file output was truncated.
     */
    readonly truncated: boolean

    /**
     * Number of omitted impacted files.
     */
    readonly truncatedAffectedFileCount: number
}

/**
 * Impact radius calculator result payload.
 */
export interface IAstImpactRadiusCalculatorResult {
    /**
     * Deterministic impacted files.
     */
    readonly affectedFiles: readonly IAstImpactedFile[]

    /**
     * Aggregated summary.
     */
    readonly summary: IAstImpactRadiusCalculatorSummary
}

/**
 * Impact radius calculator runtime input.
 */
export interface IAstImpactRadiusCalculatorInput {
    /**
     * Parsed source files.
     */
    readonly files: readonly IParsedSourceFileDTO[]

    /**
     * Changed file paths used as traversal start set.
     */
    readonly changedFilePaths: readonly string[]

    /**
     * Optional traversal direction.
     */
    readonly direction?: AstImpactRadiusDirection

    /**
     * Optional max traversal depth.
     */
    readonly maxDepth?: number

    /**
     * Optional max number of returned impacted files.
     */
    readonly maxAffectedFiles?: number
}

/**
 * Impact radius calculator options.
 */
export interface IAstImpactRadiusCalculatorServiceOptions {
    /**
     * Optional import/export graph builder override.
     */
    readonly graphBuilder?: IAstImportExportGraphBuilder

    /**
     * Optional default traversal depth.
     */
    readonly defaultMaxDepth?: number

    /**
     * Optional default max affected file cap.
     */
    readonly defaultMaxAffectedFiles?: number

    /**
     * Optional default traversal direction.
     */
    readonly defaultDirection?: AstImpactRadiusDirection
}

/**
 * Impact radius calculator contract.
 */
export interface IAstImpactRadiusCalculatorService {
    /**
     * Calculates impact radius from changed file set.
     *
     * @param input Parsed source files and impact settings.
     * @returns Deterministic impacted file payload.
     */
    calculate(
        input: IAstImpactRadiusCalculatorInput,
    ): Promise<IAstImpactRadiusCalculatorResult>
}

interface IResolvedImpactRadiusConfig {
    readonly changedFilePaths: readonly string[]
    readonly direction: AstImpactRadiusDirection
    readonly maxDepth: number
    readonly maxAffectedFiles: number
}

interface IImpactComputationResult {
    readonly affectedFiles: readonly IAstImpactedFile[]
    readonly impactRadius: number
    readonly truncatedAffectedFileCount: number
}

/**
 * Calculates impact radius of changes over import/export graph.
 */
export class AstImpactRadiusCalculatorService implements IAstImpactRadiusCalculatorService {
    private readonly graphBuilder: IAstImportExportGraphBuilder
    private readonly defaultMaxDepth: number
    private readonly defaultMaxAffectedFiles: number
    private readonly defaultDirection: AstImpactRadiusDirection

    /**
     * Creates impact radius calculator service.
     *
     * @param options Optional calculator configuration.
     */
    public constructor(options: IAstImpactRadiusCalculatorServiceOptions = {}) {
        this.graphBuilder = options.graphBuilder ?? new AstImportExportGraphBuilder()
        this.defaultMaxDepth = validateMaxDepth(options.defaultMaxDepth ?? DEFAULT_MAX_DEPTH)
        this.defaultMaxAffectedFiles = validateMaxAffectedFiles(
            options.defaultMaxAffectedFiles ?? DEFAULT_MAX_AFFECTED_FILES,
        )
        this.defaultDirection = validateDirection(options.defaultDirection ?? DEFAULT_DIRECTION)
    }

    /**
     * Calculates impact radius from changed file set.
     *
     * @param input Parsed source files and impact settings.
     * @returns Deterministic impacted file payload.
     */
    public async calculate(
        input: IAstImpactRadiusCalculatorInput,
    ): Promise<IAstImpactRadiusCalculatorResult> {
        const config = this.resolveConfig(input)
        const graph = await this.graphBuilder.build(input.files)
        const graphNodeSet = new Set<string>(graph.nodes)
        const changedInGraph = config.changedFilePaths.filter((filePath) => graphNodeSet.has(filePath))
        const missingChangedFileCount = config.changedFilePaths.length - changedInGraph.length
        const impact = computeImpact(
            graph,
            changedInGraph,
            config.direction,
            config.maxDepth,
            config.maxAffectedFiles,
        )

        return {
            affectedFiles: impact.affectedFiles,
            summary: {
                scannedFileCount: graph.summary.scannedFileCount,
                changedFileCount: changedInGraph.length,
                missingChangedFileCount,
                affectedFileCount: impact.affectedFiles.length,
                impactRadius: impact.impactRadius,
                direction: config.direction,
                truncated: impact.truncatedAffectedFileCount > 0,
                truncatedAffectedFileCount: impact.truncatedAffectedFileCount,
            },
        }
    }

    /**
     * Resolves runtime config with validated defaults.
     *
     * @param input Runtime input.
     * @returns Validated runtime config.
     */
    private resolveConfig(
        input: IAstImpactRadiusCalculatorInput,
    ): IResolvedImpactRadiusConfig {
        return {
            changedFilePaths: normalizeChangedFilePaths(input.changedFilePaths),
            direction: validateDirection(input.direction ?? this.defaultDirection),
            maxDepth: validateMaxDepth(input.maxDepth ?? this.defaultMaxDepth),
            maxAffectedFiles: validateMaxAffectedFiles(
                input.maxAffectedFiles ?? this.defaultMaxAffectedFiles,
            ),
        }
    }
}

/**
 * Validates max traversal depth.
 *
 * @param maxDepth Raw max depth.
 * @returns Validated max depth.
 */
function validateMaxDepth(maxDepth: number): number {
    if (Number.isSafeInteger(maxDepth) === false || maxDepth < 1) {
        throw new AstImpactRadiusCalculatorError(
            AST_IMPACT_RADIUS_CALCULATOR_ERROR_CODE.INVALID_MAX_DEPTH,
            {maxDepth},
        )
    }

    return maxDepth
}

/**
 * Validates max affected file cap.
 *
 * @param maxAffectedFiles Raw cap value.
 * @returns Validated cap value.
 */
function validateMaxAffectedFiles(maxAffectedFiles: number): number {
    if (Number.isSafeInteger(maxAffectedFiles) === false || maxAffectedFiles < 1) {
        throw new AstImpactRadiusCalculatorError(
            AST_IMPACT_RADIUS_CALCULATOR_ERROR_CODE.INVALID_MAX_AFFECTED_FILES,
            {maxAffectedFiles},
        )
    }

    return maxAffectedFiles
}

/**
 * Normalizes changed file-path list.
 *
 * @param changedFilePaths Raw changed file paths.
 * @returns Sorted unique normalized changed file paths.
 */
function normalizeChangedFilePaths(changedFilePaths: readonly string[]): readonly string[] {
    if (changedFilePaths.length === 0) {
        throw new AstImpactRadiusCalculatorError(
            AST_IMPACT_RADIUS_CALCULATOR_ERROR_CODE.EMPTY_CHANGED_FILE_PATHS,
        )
    }

    const normalizedPathSet = new Set<string>()

    for (const filePath of changedFilePaths) {
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
        throw new AstImpactRadiusCalculatorError(
            AST_IMPACT_RADIUS_CALCULATOR_ERROR_CODE.INVALID_FILE_PATH,
            {filePath},
        )
    }
}

/**
 * Validates traversal direction.
 *
 * @param direction Raw traversal direction.
 * @returns Validated traversal direction.
 */
function validateDirection(direction: string): AstImpactRadiusDirection {
    if (
        direction === AST_IMPACT_RADIUS_DIRECTION.OUTGOING ||
        direction === AST_IMPACT_RADIUS_DIRECTION.INCOMING ||
        direction === AST_IMPACT_RADIUS_DIRECTION.BOTH
    ) {
        return direction
    }

    throw new AstImpactRadiusCalculatorError(
        AST_IMPACT_RADIUS_CALCULATOR_ERROR_CODE.INVALID_DIRECTION,
        {direction},
    )
}

/**
 * Computes impacted files with BFS traversal.
 *
 * @param graph Import/export graph.
 * @param changedFilePaths Changed file paths in graph.
 * @param direction Traversal direction.
 * @param maxDepth Max traversal depth.
 * @param maxAffectedFiles Max returned affected files.
 * @returns Computed impacted files and truncation metadata.
 */
function computeImpact(
    graph: IAstImportExportGraphResult,
    changedFilePaths: readonly string[],
    direction: AstImpactRadiusDirection,
    maxDepth: number,
    maxAffectedFiles: number,
): IImpactComputationResult {
    if (changedFilePaths.length === 0) {
        return {
            affectedFiles: [],
            impactRadius: 0,
            truncatedAffectedFileCount: 0,
        }
    }

    const visitedDistanceByFile = new Map<string, number>()
    const queue: Array<{filePath: string; distance: number}> = []
    let queueIndex = 0

    for (const changedFilePath of changedFilePaths) {
        visitedDistanceByFile.set(changedFilePath, 0)
        queue.push({
            filePath: changedFilePath,
            distance: 0,
        })
    }

    while (queueIndex < queue.length) {
        const item = queue[queueIndex]
        queueIndex += 1

        if (item === undefined || item.distance >= maxDepth) {
            continue
        }

        const nextDistance = item.distance + 1
        const neighbors = collectNeighbors(graph, item.filePath, direction)

        for (const neighbor of neighbors) {
            const knownDistance = visitedDistanceByFile.get(neighbor)
            if (knownDistance !== undefined && knownDistance <= nextDistance) {
                continue
            }

            visitedDistanceByFile.set(neighbor, nextDistance)
            queue.push({
                filePath: neighbor,
                distance: nextDistance,
            })
        }
    }

    const changedPathSet = new Set<string>(changedFilePaths)
    const impactedFiles = [...visitedDistanceByFile.entries()]
        .filter(([filePath, distance]) => {
            return changedPathSet.has(filePath) === false && distance > 0
        })
        .map(([filePath, distance]): IAstImpactedFile => {
            return {
                filePath,
                distance,
            }
        })
        .sort(compareImpactedFiles)
    const impactRadius = impactedFiles.reduce((maxDistance, item) => {
        return Math.max(maxDistance, item.distance)
    }, 0)
    const affectedFiles = impactedFiles.slice(0, maxAffectedFiles)
    const truncatedAffectedFileCount = Math.max(0, impactedFiles.length - affectedFiles.length)

    return {
        affectedFiles,
        impactRadius,
        truncatedAffectedFileCount,
    }
}

/**
 * Collects neighbors for one node by traversal direction.
 *
 * @param graph Import/export graph.
 * @param filePath Current file path.
 * @param direction Traversal direction.
 * @returns Sorted unique neighbor file paths.
 */
function collectNeighbors(
    graph: IAstImportExportGraphResult,
    filePath: string,
    direction: AstImpactRadiusDirection,
): readonly string[] {
    const neighbors = new Set<string>()

    if (
        direction === AST_IMPACT_RADIUS_DIRECTION.OUTGOING ||
        direction === AST_IMPACT_RADIUS_DIRECTION.BOTH
    ) {
        const outgoingEdges = graph.edgesBySource.get(filePath) ?? []

        for (const edge of outgoingEdges) {
            neighbors.add(edge.targetFilePath)
        }
    }

    if (
        direction === AST_IMPACT_RADIUS_DIRECTION.INCOMING ||
        direction === AST_IMPACT_RADIUS_DIRECTION.BOTH
    ) {
        const incomingEdges = graph.edgesByTarget.get(filePath) ?? []

        for (const edge of incomingEdges) {
            neighbors.add(edge.sourceFilePath)
        }
    }

    return [...neighbors].sort((left, right) => left.localeCompare(right))
}

/**
 * Compares impacted files by distance and file path.
 *
 * @param left Left impacted file.
 * @param right Right impacted file.
 * @returns Sort result.
 */
function compareImpactedFiles(left: IAstImpactedFile, right: IAstImpactedFile): number {
    if (left.distance !== right.distance) {
        return left.distance - right.distance
    }

    return left.filePath.localeCompare(right.filePath)
}
