import {FilePath, type IParsedSourceFileDTO} from "@codenautic/core"

import {
    AST_DEPENDENCY_CHAIN_RESOLVER_ERROR_CODE,
    AstDependencyChainResolverError,
} from "./ast-dependency-chain-resolver.error"
import {
    AstImportExportGraphBuilder,
    type IAstImportExportGraphBuilder,
    type IAstImportExportGraphEdge,
    type IAstImportExportGraphResult,
} from "./ast-import-export-graph-builder"

const DEFAULT_MAX_DEPTH = 6
const DEFAULT_MAX_CHAINS = 250

/**
 * One resolved dependency chain.
 */
export interface IAstDependencyChain {
    /**
     * Stable deterministic dependency chain identifier.
     */
    readonly id: string

    /**
     * Ordered repository-relative file path chain.
     */
    readonly path: readonly string[]

    /**
     * Number of edges in the dependency chain.
     */
    readonly depth: number
}

/**
 * Dependency chain resolver summary.
 */
export interface IAstDependencyChainResolverSummary {
    /**
     * Number of nodes in analyzed graph.
     */
    readonly analyzedNodeCount: number

    /**
     * Number of start files used for traversal.
     */
    readonly startFileCount: number

    /**
     * Number of target files used for traversal.
     */
    readonly targetFileCount: number

    /**
     * Number of resolved chains.
     */
    readonly chainCount: number

    /**
     * Maximum depth observed among resolved chains.
     */
    readonly longestChainDepth: number

    /**
     * Indicates whether traversal was truncated by max chain limit.
     */
    readonly truncated: boolean
}

/**
 * Dependency chain resolver output payload.
 */
export interface IAstDependencyChainResolverResult {
    /**
     * Deterministic resolved dependency chains.
     */
    readonly chains: readonly IAstDependencyChain[]

    /**
     * Aggregated summary.
     */
    readonly summary: IAstDependencyChainResolverSummary
}

/**
 * Dependency chain resolver runtime input.
 */
export interface IAstDependencyChainResolverInput {
    /**
     * Parsed source files used to build import/export graph.
     */
    readonly files: readonly IParsedSourceFileDTO[]

    /**
     * Optional start file subset for traversal.
     */
    readonly startFilePaths?: readonly string[]

    /**
     * Optional target file subset for early chain termination.
     */
    readonly targetFilePaths?: readonly string[]

    /**
     * Optional maximum traversal depth in edges.
     */
    readonly maxDepth?: number

    /**
     * Optional maximum number of returned chains.
     */
    readonly maxChains?: number
}

/**
 * Dependency chain resolver options.
 */
export interface IAstDependencyChainResolverServiceOptions {
    /**
     * Optional import/export graph builder override.
     */
    readonly graphBuilder?: IAstImportExportGraphBuilder

    /**
     * Optional default traversal depth in edges.
     */
    readonly defaultMaxDepth?: number

    /**
     * Optional default chain count cap.
     */
    readonly defaultMaxChains?: number
}

/**
 * Dependency chain resolver contract.
 */
export interface IAstDependencyChainResolverService {
    /**
     * Resolves deterministic dependency chains from parsed source files.
     *
     * @param input Parsed files and optional traversal settings.
     * @returns Deterministic dependency chain payload.
     */
    resolve(input: IAstDependencyChainResolverInput): Promise<IAstDependencyChainResolverResult>
}

interface IResolvedChainConfig {
    readonly startFilePaths?: readonly string[]
    readonly targetFilePaths?: readonly string[]
    readonly maxDepth: number
    readonly maxChains: number
}

interface ITraversalState {
    readonly chains: Map<string, IAstDependencyChain>
    truncated: boolean
}

interface IDependencyWalkContext {
    readonly edgesBySource: ReadonlyMap<string, readonly IAstImportExportGraphEdge[]>
    readonly targetFilePathSet: ReadonlySet<string> | undefined
    readonly maxDepth: number
    readonly maxChains: number
    readonly state: ITraversalState
}

/**
 * Resolves full dependency chains over deterministic import/export graph.
 */
export class AstDependencyChainResolverService implements IAstDependencyChainResolverService {
    private readonly graphBuilder: IAstImportExportGraphBuilder
    private readonly defaultMaxDepth: number
    private readonly defaultMaxChains: number

    /**
     * Creates dependency chain resolver service.
     *
     * @param options Optional resolver options.
     */
    public constructor(options: IAstDependencyChainResolverServiceOptions = {}) {
        this.graphBuilder = options.graphBuilder ?? new AstImportExportGraphBuilder()
        this.defaultMaxDepth = validateMaxDepth(options.defaultMaxDepth ?? DEFAULT_MAX_DEPTH)
        this.defaultMaxChains = validateMaxChains(options.defaultMaxChains ?? DEFAULT_MAX_CHAINS)
    }

    /**
     * Resolves full dependency chains from parsed source files.
     *
     * @param input Parsed files and optional traversal settings.
     * @returns Deterministic dependency chain payload.
     */
    public async resolve(
        input: IAstDependencyChainResolverInput,
    ): Promise<IAstDependencyChainResolverResult> {
        const config = this.resolveConfig(input)
        const graph = await this.graphBuilder.build(input.files)
        const startFilePaths = resolveStartFilePaths(graph, config.startFilePaths)
        const targetFilePathSet = resolveTargetFilePathSet(graph, config.targetFilePaths)
        const traversalState = collectDependencyChains(
            graph,
            startFilePaths,
            targetFilePathSet,
            config.maxDepth,
            config.maxChains,
        )
        const chains = [...traversalState.chains.values()].sort(compareDependencyChains)

        return {
            chains,
            summary: createSummary(
                graph.nodes.length,
                startFilePaths.length,
                targetFilePathSet?.size ?? 0,
                chains,
                traversalState.truncated,
            ),
        }
    }

    /**
     * Resolves runtime input with validated defaults.
     *
     * @param input Runtime input.
     * @returns Validated chain resolver config.
     */
    private resolveConfig(input: IAstDependencyChainResolverInput): IResolvedChainConfig {
        return {
            startFilePaths: normalizeOptionalFilePathFilter(
                input.startFilePaths,
                AST_DEPENDENCY_CHAIN_RESOLVER_ERROR_CODE.EMPTY_START_FILE_PATHS,
            ),
            targetFilePaths: normalizeOptionalFilePathFilter(
                input.targetFilePaths,
                AST_DEPENDENCY_CHAIN_RESOLVER_ERROR_CODE.EMPTY_TARGET_FILE_PATHS,
            ),
            maxDepth: validateMaxDepth(input.maxDepth ?? this.defaultMaxDepth),
            maxChains: validateMaxChains(input.maxChains ?? this.defaultMaxChains),
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
        throw new AstDependencyChainResolverError(
            AST_DEPENDENCY_CHAIN_RESOLVER_ERROR_CODE.INVALID_MAX_DEPTH,
            {maxDepth},
        )
    }

    return maxDepth
}

/**
 * Validates max chain cap.
 *
 * @param maxChains Raw max chains.
 * @returns Validated max chains.
 */
function validateMaxChains(maxChains: number): number {
    if (Number.isSafeInteger(maxChains) === false || maxChains < 1) {
        throw new AstDependencyChainResolverError(
            AST_DEPENDENCY_CHAIN_RESOLVER_ERROR_CODE.INVALID_MAX_CHAINS,
            {maxChains},
        )
    }

    return maxChains
}

/**
 * Normalizes optional file-path filter.
 *
 * @param filePaths Raw file paths.
 * @param emptyErrorCode Error code when filter is empty.
 * @returns Sorted unique normalized file paths or undefined.
 */
function normalizeOptionalFilePathFilter(
    filePaths: readonly string[] | undefined,
    emptyErrorCode:
        (typeof AST_DEPENDENCY_CHAIN_RESOLVER_ERROR_CODE)[keyof typeof AST_DEPENDENCY_CHAIN_RESOLVER_ERROR_CODE],
): readonly string[] | undefined {
    if (filePaths === undefined) {
        return undefined
    }

    if (filePaths.length === 0) {
        throw new AstDependencyChainResolverError(emptyErrorCode)
    }

    const normalizedFilePaths = new Set<string>()

    for (const filePath of filePaths) {
        normalizedFilePaths.add(normalizeFilePath(filePath))
    }

    return [...normalizedFilePaths].sort((left, right) => left.localeCompare(right))
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
        throw new AstDependencyChainResolverError(
            AST_DEPENDENCY_CHAIN_RESOLVER_ERROR_CODE.INVALID_FILE_PATH,
            {filePath},
        )
    }
}

/**
 * Resolves traversal start file paths.
 *
 * @param graph Graph payload.
 * @param requestedStartFilePaths Optional explicit start file paths.
 * @returns Sorted unique start file paths.
 */
function resolveStartFilePaths(
    graph: IAstImportExportGraphResult,
    requestedStartFilePaths: readonly string[] | undefined,
): readonly string[] {
    const graphNodes = new Set<string>(graph.nodes)

    if (requestedStartFilePaths !== undefined) {
        return requestedStartFilePaths.filter((filePath) => graphNodes.has(filePath))
    }

    return [...graph.edgesBySource.keys()].sort((left, right) => left.localeCompare(right))
}

/**
 * Resolves optional target file path set.
 *
 * @param graph Graph payload.
 * @param requestedTargetFilePaths Optional explicit target file paths.
 * @returns Normalized target set or undefined.
 */
function resolveTargetFilePathSet(
    graph: IAstImportExportGraphResult,
    requestedTargetFilePaths: readonly string[] | undefined,
): ReadonlySet<string> | undefined {
    if (requestedTargetFilePaths === undefined) {
        return undefined
    }

    const graphNodes = new Set<string>(graph.nodes)
    const normalizedTargets = requestedTargetFilePaths.filter((filePath) => graphNodes.has(filePath))

    return new Set<string>(normalizedTargets)
}

/**
 * Collects dependency chains using DFS traversal with depth and count limits.
 *
 * @param graph Graph payload.
 * @param startFilePaths Traversal start file paths.
 * @param targetFilePathSet Optional target filter.
 * @param maxDepth Maximum traversal depth.
 * @param maxChains Maximum number of returned chains.
 * @returns Traversal state.
 */
function collectDependencyChains(
    graph: IAstImportExportGraphResult,
    startFilePaths: readonly string[],
    targetFilePathSet: ReadonlySet<string> | undefined,
    maxDepth: number,
    maxChains: number,
): ITraversalState {
    const traversalState: ITraversalState = {
        chains: new Map<string, IAstDependencyChain>(),
        truncated: false,
    }
    const walkContext: IDependencyWalkContext = {
        edgesBySource: graph.edgesBySource,
        targetFilePathSet,
        maxDepth,
        maxChains,
        state: traversalState,
    }

    for (const startFilePath of startFilePaths) {
        if (traversalState.truncated) {
            break
        }

        const visited = new Set<string>([startFilePath])
        const path = [startFilePath]

        walkDependencyTree(walkContext, startFilePath, path, visited)
    }

    return traversalState
}

/**
 * Walks dependency tree depth-first for one start path.
 *
 * @param context Traversal context.
 * @param currentFilePath Current file path.
 * @param path Current traversal path.
 * @param visited Visited file path set for cycle-safe traversal.
 */
function walkDependencyTree(
    context: IDependencyWalkContext,
    currentFilePath: string,
    path: string[],
    visited: Set<string>,
): void {
    if (context.state.truncated) {
        return
    }

    const nextFilePaths = resolveNextFilePaths(
        context.edgesBySource,
        currentFilePath,
        visited,
    )
    if (
        shouldFinalizeDependencyPath(
            currentFilePath,
            path,
            nextFilePaths,
            context.targetFilePathSet,
            context.maxDepth,
        )
    ) {
        appendDependencyChainIfRequired(path, context.state, context.maxChains)
        return
    }

    for (const nextFilePath of nextFilePaths) {
        if (context.state.truncated) {
            return
        }

        path.push(nextFilePath)
        visited.add(nextFilePath)

        walkDependencyTree(context, nextFilePath, path, visited)

        visited.delete(nextFilePath)
        path.pop()
    }
}

/**
 * Resolves next candidate file paths for DFS traversal.
 *
 * @param edgesBySource Source-indexed edges.
 * @param currentFilePath Current file path.
 * @param visited Visited file paths.
 * @returns Sorted next candidate file paths.
 */
function resolveNextFilePaths(
    edgesBySource: ReadonlyMap<string, readonly IAstImportExportGraphEdge[]>,
    currentFilePath: string,
    visited: ReadonlySet<string>,
): readonly string[] {
    const nextEdges = edgesBySource.get(currentFilePath) ?? []

    return nextEdges
        .map((edge) => edge.targetFilePath)
        .filter((targetFilePath) => visited.has(targetFilePath) === false)
        .sort((left, right) => left.localeCompare(right))
}

/**
 * Determines whether current traversal path must be finalized.
 *
 * @param currentFilePath Current file path.
 * @param path Current traversal path.
 * @param nextFilePaths Next candidate file paths.
 * @param targetFilePathSet Optional target file set.
 * @param maxDepth Maximum traversal depth.
 * @returns True when current path must be finalized.
 */
function shouldFinalizeDependencyPath(
    currentFilePath: string,
    path: readonly string[],
    nextFilePaths: readonly string[],
    targetFilePathSet: ReadonlySet<string> | undefined,
    maxDepth: number,
): boolean {
    const reachedTarget =
        targetFilePathSet !== undefined &&
        path.length > 1 &&
        targetFilePathSet.has(currentFilePath)
    const reachedDepthLimit = path.length - 1 >= maxDepth

    return reachedTarget || reachedDepthLimit || nextFilePaths.length === 0
}

/**
 * Appends dependency chain from current path when chain has at least one edge.
 *
 * @param path Current traversal path.
 * @param state Mutable traversal state.
 * @param maxChains Maximum number of returned chains.
 */
function appendDependencyChainIfRequired(
    path: readonly string[],
    state: ITraversalState,
    maxChains: number,
): void {
    if (path.length <= 1) {
        return
    }

    const chain = createDependencyChain(path)
    state.chains.set(chain.id, chain)

    if (state.chains.size >= maxChains) {
        state.truncated = true
    }
}

/**
 * Creates one dependency chain payload from traversal path.
 *
 * @param path Ordered traversal path.
 * @returns Dependency chain.
 */
function createDependencyChain(path: readonly string[]): IAstDependencyChain {
    return {
        id: path.join("->"),
        path: [...path],
        depth: path.length - 1,
    }
}

/**
 * Compares dependency chains deterministically.
 *
 * @param left Left chain.
 * @param right Right chain.
 * @returns Sort result.
 */
function compareDependencyChains(left: IAstDependencyChain, right: IAstDependencyChain): number {
    const depthCompare = right.depth - left.depth
    if (depthCompare !== 0) {
        return depthCompare
    }

    return left.id.localeCompare(right.id)
}

/**
 * Builds dependency chain resolver summary.
 *
 * @param analyzedNodeCount Number of analyzed nodes.
 * @param startFileCount Number of start files.
 * @param targetFileCount Number of target files.
 * @param chains Resolved chains.
 * @param truncated Indicates whether traversal was truncated.
 * @returns Aggregated summary.
 */
function createSummary(
    analyzedNodeCount: number,
    startFileCount: number,
    targetFileCount: number,
    chains: readonly IAstDependencyChain[],
    truncated: boolean,
): IAstDependencyChainResolverSummary {
    const longestChainDepth = chains.reduce((maxDepth, chain) => {
        if (chain.depth > maxDepth) {
            return chain.depth
        }

        return maxDepth
    }, 0)

    return {
        analyzedNodeCount,
        startFileCount,
        targetFileCount,
        chainCount: chains.length,
        longestChainDepth,
        truncated,
    }
}
