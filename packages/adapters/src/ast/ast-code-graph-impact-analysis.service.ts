import {
    CODE_GRAPH_NODE_TYPE,
    FilePath,
    type ImpactAnalysisResult,
    type ICodeGraph,
    type ICodeGraphNode,
} from "@codenautic/core"

import {
    AST_CODE_GRAPH_IMPACT_ANALYSIS_ERROR_CODE,
    AstCodeGraphImpactAnalysisError,
} from "./ast-code-graph-impact-analysis.error"

const DEFAULT_IMPACT_DEPTH = 3
const MISSING_FILE_BREAKING_CHANGE_REASON = "CHANGED_FILE_NOT_IN_GRAPH"

/**
 * Supported traversal directions for AST code graph impact analysis.
 */
export const AST_CODE_GRAPH_IMPACT_ANALYSIS_DIRECTION = {
    FORWARD: "forward",
    BACKWARD: "backward",
    BOTH: "both",
} as const

/**
 * AST code graph impact analysis direction literal.
 */
export type AstCodeGraphImpactAnalysisDirection =
    (typeof AST_CODE_GRAPH_IMPACT_ANALYSIS_DIRECTION)[keyof typeof AST_CODE_GRAPH_IMPACT_ANALYSIS_DIRECTION]

type ITraversalEdge = {
    readonly nodeId: string
    readonly depth: number
}

/**
 * Input payload for AST code graph impact analysis.
 */
export interface IAstCodeGraphImpactAnalysisInput {
    /**
     * Graph snapshot used as traversal source.
     */
    readonly graph: ICodeGraph

    /**
     * Repository-relative file paths considered as explicit change roots.
     */
    readonly changedFilePaths: readonly string[]

    /**
     * Optional maximum traversal depth.
     */
    readonly depth?: number

    /**
     * Optional traversal direction.
     */
    readonly direction?: AstCodeGraphImpactAnalysisDirection
}

/**
 * Construction options for AST code graph impact analysis service.
 */
export interface IAstCodeGraphImpactAnalysisServiceOptions {
    /**
     * Optional default maximum traversal depth.
     */
    readonly defaultDepth?: number

    /**
     * Optional default traversal direction.
     */
    readonly defaultDirection?: AstCodeGraphImpactAnalysisDirection
}

/**
 * AST code graph impact analysis service contract.
 */
export interface IAstCodeGraphImpactAnalysisService {
    /**
     * Calculates changed and affected nodes for changed repository files.
     *
     * @param input Graph payload, changed files, and traversal configuration.
     * @returns Impact analysis result compatible with core contracts.
     * @throws {AstCodeGraphImpactAnalysisError} When traversal config or changed file paths are invalid.
     */
    analyzeImpact(input: IAstCodeGraphImpactAnalysisInput): Promise<ImpactAnalysisResult>
}

interface IResolvedImpactAnalysisConfig {
    /**
     * Validated maximum traversal depth.
     */
    readonly depth: number

    /**
     * Validated traversal direction.
     */
    readonly direction: AstCodeGraphImpactAnalysisDirection
}

interface IResolvedChangedNodes {
    /**
     * Explicitly changed graph node ids.
     */
    readonly changedNodeIds: ReadonlySet<string>

    /**
     * Lookup of changed or synthetic nodes by id.
     */
    readonly nodeLookup: ReadonlyMap<string, ICodeGraphNode>

    /**
     * Breaking changes caused by missing graph coverage.
     */
    readonly breakingChanges: readonly ImpactAnalysisResult["breakingChanges"][number][]
}

/**
 * Tree-sitter graph-backed impact analysis with configurable traversal direction and depth.
 */
export class AstCodeGraphImpactAnalysisService implements IAstCodeGraphImpactAnalysisService {
    private readonly defaultDepth: number
    private readonly defaultDirection: AstCodeGraphImpactAnalysisDirection

    /**
     * Creates AST code graph impact analysis service.
     *
     * @param options Optional default traversal configuration.
     * @throws {AstCodeGraphImpactAnalysisError} When defaults are invalid.
     */
    public constructor(options: IAstCodeGraphImpactAnalysisServiceOptions = {}) {
        this.defaultDepth = validateDepth(options.defaultDepth ?? DEFAULT_IMPACT_DEPTH)
        this.defaultDirection = validateDirection(
            options.defaultDirection ?? AST_CODE_GRAPH_IMPACT_ANALYSIS_DIRECTION.BACKWARD,
        )
    }

    /**
     * Calculates changed and affected nodes using deterministic DFS traversal.
     *
     * @param input Graph payload, changed files, and traversal configuration.
     * @returns Deterministic impact analysis result.
     */
    public analyzeImpact(input: IAstCodeGraphImpactAnalysisInput): Promise<ImpactAnalysisResult> {
        const config = this.resolveConfig(input)
        const nodeLookup = createNodeLookup(input.graph.nodes)
        const changedFilePaths = normalizeChangedFilePaths(input.changedFilePaths)
        const resolvedChangedNodes = resolveChangedNodes(changedFilePaths, input.graph.nodes, nodeLookup)
        const outgoingAdjacency = buildAdjacency(input.graph.edges, nodeLookup, "outgoing")
        const incomingAdjacency = buildAdjacency(input.graph.edges, nodeLookup, "incoming")
        const visitedDepths = traverseGraph({
            changedNodeIds: resolvedChangedNodes.changedNodeIds,
            depth: config.depth,
            direction: config.direction,
            outgoingAdjacency,
            incomingAdjacency,
        })

        return Promise.resolve({
            changedNodes: sortNodes(resolvedChangedNodes.changedNodeIds, resolvedChangedNodes.nodeLookup),
            affectedNodes: sortNodes(visitedDepths.keys(), resolvedChangedNodes.nodeLookup),
            impactRadius: resolveImpactRadius(visitedDepths),
            breakingChanges: resolvedChangedNodes.breakingChanges,
        })
    }

    /**
     * Resolves runtime traversal config with validated defaults.
     *
     * @param input Runtime impact analysis input.
     * @returns Validated traversal config.
     */
    private resolveConfig(input: IAstCodeGraphImpactAnalysisInput): IResolvedImpactAnalysisConfig {
        return {
            depth: validateDepth(input.depth ?? this.defaultDepth),
            direction: validateDirection(input.direction ?? this.defaultDirection),
        }
    }
}

/**
 * Validates traversal depth as a non-negative safe integer.
 *
 * @param depth Raw traversal depth.
 * @returns Validated traversal depth.
 * @throws {AstCodeGraphImpactAnalysisError} When depth is invalid.
 */
function validateDepth(depth: number): number {
    if (Number.isSafeInteger(depth) === false || depth < 0) {
        throw new AstCodeGraphImpactAnalysisError(
            AST_CODE_GRAPH_IMPACT_ANALYSIS_ERROR_CODE.INVALID_DEPTH,
            {depth},
        )
    }

    return depth
}

/**
 * Validates traversal direction against supported literals.
 *
 * @param direction Raw traversal direction.
 * @returns Validated traversal direction.
 * @throws {AstCodeGraphImpactAnalysisError} When direction is invalid.
 */
function validateDirection(direction: string): AstCodeGraphImpactAnalysisDirection {
    if (
        direction === AST_CODE_GRAPH_IMPACT_ANALYSIS_DIRECTION.FORWARD ||
        direction === AST_CODE_GRAPH_IMPACT_ANALYSIS_DIRECTION.BACKWARD ||
        direction === AST_CODE_GRAPH_IMPACT_ANALYSIS_DIRECTION.BOTH
    ) {
        return direction
    }

    throw new AstCodeGraphImpactAnalysisError(
        AST_CODE_GRAPH_IMPACT_ANALYSIS_ERROR_CODE.INVALID_DIRECTION,
        {direction},
    )
}

/**
 * Normalizes and validates changed file paths.
 *
 * @param changedFilePaths Raw changed repository-relative file paths.
 * @returns Sorted unique normalized file paths.
 * @throws {AstCodeGraphImpactAnalysisError} When input is empty or contains invalid paths.
 */
function normalizeChangedFilePaths(changedFilePaths: readonly string[]): readonly string[] {
    if (changedFilePaths.length === 0) {
        throw new AstCodeGraphImpactAnalysisError(
            AST_CODE_GRAPH_IMPACT_ANALYSIS_ERROR_CODE.EMPTY_CHANGED_FILE_PATHS,
        )
    }

    const normalizedPaths = new Set<string>()

    for (const filePath of changedFilePaths) {
        try {
            normalizedPaths.add(FilePath.create(filePath).toString())
        } catch {
            throw new AstCodeGraphImpactAnalysisError(
                AST_CODE_GRAPH_IMPACT_ANALYSIS_ERROR_CODE.INVALID_FILE_PATH,
                {filePath},
            )
        }
    }

    return [...normalizedPaths].sort()
}

/**
 * Builds node lookup from graph snapshot.
 *
 * @param nodes Graph nodes.
 * @returns Node lookup by stable identifier.
 */
function createNodeLookup(nodes: readonly ICodeGraphNode[]): ReadonlyMap<string, ICodeGraphNode> {
    const lookup = new Map<string, ICodeGraphNode>()

    for (const node of nodes) {
        lookup.set(node.id, node)
    }

    return lookup
}

/**
 * Resolves changed graph nodes and synthesizes missing file nodes when needed.
 *
 * @param changedFilePaths Normalized changed file paths.
 * @param graphNodes Graph nodes.
 * @param nodeLookup Graph node lookup.
 * @returns Changed node identifiers, merged lookup, and breaking changes.
 */
function resolveChangedNodes(
    changedFilePaths: readonly string[],
    graphNodes: readonly ICodeGraphNode[],
    nodeLookup: ReadonlyMap<string, ICodeGraphNode>,
): IResolvedChangedNodes {
    const nodesByFilePath = indexNodesByFilePath(graphNodes)
    const mergedLookup = new Map(nodeLookup)
    const changedNodeIds = new Set<string>()
    const breakingChanges: Array<ImpactAnalysisResult["breakingChanges"][number]> = []

    for (const filePath of changedFilePaths) {
        const matchedNodes = nodesByFilePath.get(filePath)

        if (matchedNodes === undefined) {
            const syntheticNode = createSyntheticFileNode(filePath)
            mergedLookup.set(syntheticNode.id, syntheticNode)
            changedNodeIds.add(syntheticNode.id)
            breakingChanges.push({
                node: syntheticNode,
                reason: MISSING_FILE_BREAKING_CHANGE_REASON,
            })
            continue
        }

        for (const node of matchedNodes) {
            changedNodeIds.add(node.id)
        }
    }

    return {
        changedNodeIds,
        nodeLookup: mergedLookup,
        breakingChanges,
    }
}

/**
 * Indexes graph nodes by repository-relative file path.
 *
 * @param nodes Graph nodes.
 * @returns File-path index with deterministic node order.
 */
function indexNodesByFilePath(
    nodes: readonly ICodeGraphNode[],
): ReadonlyMap<string, readonly ICodeGraphNode[]> {
    const groupedNodes = new Map<string, ICodeGraphNode[]>()

    for (const node of nodes) {
        const bucket = groupedNodes.get(node.filePath)

        if (bucket === undefined) {
            groupedNodes.set(node.filePath, [node])
            continue
        }

        bucket.push(node)
    }

    return finalizeNodeGroups(groupedNodes)
}

/**
 * Sorts grouped nodes by stable identifier and freezes index values.
 *
 * @param groupedNodes Mutable file-path index.
 * @returns Immutable file-path index.
 */
function finalizeNodeGroups(
    groupedNodes: Map<string, ICodeGraphNode[]>,
): ReadonlyMap<string, readonly ICodeGraphNode[]> {
    const result = new Map<string, readonly ICodeGraphNode[]>()

    for (const [filePath, nodes] of groupedNodes.entries()) {
        result.set(
            filePath,
            [...nodes].sort((left, right) => left.id.localeCompare(right.id)),
        )
    }

    return result
}

/**
 * Creates synthetic file node for changed file missing from graph snapshot.
 *
 * @param filePath Missing repository-relative file path.
 * @returns Synthetic file node.
 */
function createSyntheticFileNode(filePath: string): ICodeGraphNode {
    return {
        id: `file:${filePath}`,
        type: CODE_GRAPH_NODE_TYPE.FILE,
        name: filePath,
        filePath,
    }
}

/**
 * Builds deterministic adjacency from graph edges and known nodes.
 *
 * @param edges Graph edges.
 * @param nodeLookup Known graph nodes.
 * @param mode Direction used to interpret edge endpoints.
 * @returns Sorted adjacency by node id.
 */
function buildAdjacency(
    edges: ICodeGraph["edges"],
    nodeLookup: ReadonlyMap<string, ICodeGraphNode>,
    mode: "outgoing" | "incoming",
): ReadonlyMap<string, readonly string[]> {
    const adjacency = new Map<string, Set<string>>()

    for (const edge of edges) {
        const sourceExists = nodeLookup.has(edge.source)
        const targetExists = nodeLookup.has(edge.target)

        if (sourceExists === false || targetExists === false) {
            continue
        }

        const nodeId = mode === "outgoing" ? edge.source : edge.target
        const neighborId = mode === "outgoing" ? edge.target : edge.source
        const bucket = adjacency.get(nodeId)

        if (bucket === undefined) {
            adjacency.set(nodeId, new Set([neighborId]))
            continue
        }

        bucket.add(neighborId)
    }

    return finalizeAdjacency(adjacency)
}

/**
 * Sorts adjacency neighbors for deterministic DFS traversal.
 *
 * @param adjacency Mutable adjacency.
 * @returns Immutable sorted adjacency.
 */
function finalizeAdjacency(
    adjacency: Map<string, Set<string>>,
): ReadonlyMap<string, readonly string[]> {
    const result = new Map<string, readonly string[]>()

    for (const [nodeId, neighborIds] of adjacency.entries()) {
        result.set(nodeId, [...neighborIds].sort())
    }

    return result
}

/**
 * Traverses graph with DFS while preserving minimum discovered depth per node.
 *
 * @param params Traversal root set, config, and adjacencies.
 * @returns Node depth map for all impacted nodes.
 */
function traverseGraph(params: {
    readonly changedNodeIds: ReadonlySet<string>
    readonly depth: number
    readonly direction: AstCodeGraphImpactAnalysisDirection
    readonly outgoingAdjacency: ReadonlyMap<string, readonly string[]>
    readonly incomingAdjacency: ReadonlyMap<string, readonly string[]>
}): ReadonlyMap<string, number> {
    const visitedDepths = new Map<string, number>()
    const stack = initializeTraversalStack(params.changedNodeIds)

    while (stack.length > 0) {
        const candidate = stack.pop()
        if (candidate === undefined) {
            continue
        }

        const previousDepth = visitedDepths.get(candidate.nodeId)
        if (previousDepth !== undefined && previousDepth <= candidate.depth) {
            continue
        }

        visitedDepths.set(candidate.nodeId, candidate.depth)

        if (candidate.depth >= params.depth) {
            continue
        }

        const neighborIds = resolveNeighborIds(candidate.nodeId, params)
        pushTraversalNeighbors(stack, neighborIds, candidate.depth + 1)
    }

    return visitedDepths
}

/**
 * Builds deterministic initial DFS stack from changed node ids.
 *
 * @param changedNodeIds Explicitly changed node ids.
 * @returns Initial traversal stack.
 */
function initializeTraversalStack(changedNodeIds: ReadonlySet<string>): ITraversalEdge[] {
    return [...changedNodeIds]
        .sort((left, right) => right.localeCompare(left))
        .map((nodeId): ITraversalEdge => ({
            nodeId,
            depth: 0,
        }))
}

/**
 * Resolves adjacency neighbors for one node under selected direction.
 *
 * @param nodeId Current node id.
 * @param params Traversal params.
 * @returns Sorted neighbor ids.
 */
function resolveNeighborIds(
    nodeId: string,
    params: {
        readonly direction: AstCodeGraphImpactAnalysisDirection
        readonly outgoingAdjacency: ReadonlyMap<string, readonly string[]>
        readonly incomingAdjacency: ReadonlyMap<string, readonly string[]>
    },
): readonly string[] {
    if (params.direction === AST_CODE_GRAPH_IMPACT_ANALYSIS_DIRECTION.FORWARD) {
        return params.outgoingAdjacency.get(nodeId) ?? []
    }

    if (params.direction === AST_CODE_GRAPH_IMPACT_ANALYSIS_DIRECTION.BACKWARD) {
        return params.incomingAdjacency.get(nodeId) ?? []
    }

    return mergeNeighbors(
        params.outgoingAdjacency.get(nodeId) ?? [],
        params.incomingAdjacency.get(nodeId) ?? [],
    )
}

/**
 * Merges outgoing and incoming neighbors into one deterministic set.
 *
 * @param outgoingIds Outgoing adjacency neighbors.
 * @param incomingIds Incoming adjacency neighbors.
 * @returns Sorted unique neighbor ids.
 */
function mergeNeighbors(
    outgoingIds: readonly string[],
    incomingIds: readonly string[],
): readonly string[] {
    return [...new Set([...outgoingIds, ...incomingIds])].sort()
}

/**
 * Pushes neighbors onto DFS stack while preserving ascending visit order.
 *
 * @param stack Mutable DFS stack.
 * @param neighborIds Sorted neighbor ids.
 * @param depth Traversal depth for pushed neighbors.
 */
function pushTraversalNeighbors(
    stack: ITraversalEdge[],
    neighborIds: readonly string[],
    depth: number,
): void {
    for (const neighborId of [...neighborIds].reverse()) {
        stack.push({
            nodeId: neighborId,
            depth,
        })
    }
}

/**
 * Sorts nodes by stable identifier and filters unknown ids.
 *
 * @param nodeIds Node identifiers to resolve.
 * @param nodeLookup Node lookup.
 * @returns Sorted graph nodes.
 */
function sortNodes(
    nodeIds: Iterable<string>,
    nodeLookup: ReadonlyMap<string, ICodeGraphNode>,
): readonly ICodeGraphNode[] {
    return [...nodeIds]
        .map((nodeId): ICodeGraphNode | undefined => nodeLookup.get(nodeId))
        .filter((node): node is ICodeGraphNode => node !== undefined)
        .sort((left, right) => left.id.localeCompare(right.id))
}

/**
 * Resolves maximum traversal depth reached by impacted nodes.
 *
 * @param visitedDepths Depth map for impacted nodes.
 * @returns Maximum visited depth.
 */
function resolveImpactRadius(visitedDepths: ReadonlyMap<string, number>): number {
    let impactRadius = 0

    for (const depth of visitedDepths.values()) {
        if (depth > impactRadius) {
            impactRadius = depth
        }
    }

    return impactRadius
}
