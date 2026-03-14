import {
    FilePath,
    type CodeGraphNodeType,
    type ICodeGraph,
    type ICodeGraphEdge,
    type ICodeGraphNode,
} from "@codenautic/core"

import {
    AST_ADVANCED_CODE_ANALYSIS_ERROR_CODE,
    AstAdvancedCodeAnalysisError,
} from "./ast-advanced-code-analysis.error"

const DEFAULT_MINIMUM_HUB_FAN_IN = 3
const DEFAULT_MINIMUM_HUB_FAN_OUT = 3
const DEFAULT_MINIMUM_CYCLE_SIZE = 3
const DEFAULT_MINIMUM_NODE_TYPE_SPREAD = 3
const DEFAULT_MAX_PATTERNS_PER_TYPE = 10

/**
 * Supported advanced code-pattern categories.
 */
export const AST_ADVANCED_CODE_PATTERN_TYPE = {
    CIRCULAR_DEPENDENCY: "CIRCULAR_DEPENDENCY",
    HIGH_FAN_IN: "HIGH_FAN_IN",
    HIGH_FAN_OUT: "HIGH_FAN_OUT",
    MIXED_ABSTRACTION: "MIXED_ABSTRACTION",
} as const

/**
 * Advanced code-pattern category literal.
 */
export type AstAdvancedCodePatternType =
    (typeof AST_ADVANCED_CODE_PATTERN_TYPE)[keyof typeof AST_ADVANCED_CODE_PATTERN_TYPE]

/**
 * Pattern severity buckets for advanced code analysis.
 */
export const AST_ADVANCED_CODE_PATTERN_SEVERITY = {
    LOW: "LOW",
    MEDIUM: "MEDIUM",
    HIGH: "HIGH",
} as const

/**
 * Pattern severity literal.
 */
export type AstAdvancedCodePatternSeverity =
    (typeof AST_ADVANCED_CODE_PATTERN_SEVERITY)[keyof typeof AST_ADVANCED_CODE_PATTERN_SEVERITY]

/**
 * One advanced pattern detected from graph structure.
 */
export interface IAstAdvancedCodePattern {
    /**
     * Stable deterministic pattern identifier.
     */
    readonly id: string

    /**
     * Pattern category.
     */
    readonly type: AstAdvancedCodePatternType

    /**
     * Pattern severity bucket.
     */
    readonly severity: AstAdvancedCodePatternSeverity

    /**
     * Repository-relative files participating in the pattern.
     */
    readonly filePaths: readonly string[]

    /**
     * Deterministic numeric intensity score.
     */
    readonly score: number

    /**
     * Optional machine-readable details.
     */
    readonly details?: Readonly<Record<string, string | number | boolean>>
}

/**
 * Input options for advanced AST analysis.
 */
export interface IAstAdvancedCodeAnalysisInput {
    /**
     * Optional subset of repository-relative files included in analysis.
     */
    readonly filePaths?: readonly string[]

    /**
     * Optional minimum incoming dependency threshold per file.
     */
    readonly minimumHubFanIn?: number

    /**
     * Optional minimum outgoing dependency threshold per file.
     */
    readonly minimumHubFanOut?: number

    /**
     * Optional minimum number of files in a dependency cycle.
     */
    readonly minimumCycleSize?: number

    /**
     * Optional minimum distinct node types inside one file.
     */
    readonly minimumNodeTypeSpread?: number

    /**
     * Optional per-type cap for emitted patterns.
     */
    readonly maxPatternsPerType?: number
}

/**
 * Construction options for advanced AST analysis service.
 */
export interface IAstAdvancedCodeAnalysisServiceOptions {
    /**
     * Optional default minimum incoming dependency threshold per file.
     */
    readonly defaultMinimumHubFanIn?: number

    /**
     * Optional default minimum outgoing dependency threshold per file.
     */
    readonly defaultMinimumHubFanOut?: number

    /**
     * Optional default minimum cycle size.
     */
    readonly defaultMinimumCycleSize?: number

    /**
     * Optional default minimum node-type spread per file.
     */
    readonly defaultMinimumNodeTypeSpread?: number

    /**
     * Optional default per-type pattern cap.
     */
    readonly defaultMaxPatternsPerType?: number
}

/**
 * Aggregated output of advanced AST analysis.
 */
export interface IAstAdvancedCodeAnalysisResult {
    /**
     * Deterministic list of detected patterns.
     */
    readonly patterns: readonly IAstAdvancedCodePattern[]

    /**
     * Pattern count summary by category.
     */
    readonly summary: IAstAdvancedCodeAnalysisSummary
}

/**
 * Pattern count summary by category.
 */
export interface IAstAdvancedCodeAnalysisSummary {
    /**
     * Total emitted patterns.
     */
    readonly totalPatterns: number

    /**
     * Pattern counts grouped by category.
     */
    readonly byType: Readonly<Record<AstAdvancedCodePatternType, number>>
}

/**
 * Advanced AST code analysis service contract.
 */
export interface IAstAdvancedCodeAnalysisService {
    /**
     * Detects complex structural patterns on top of code graph snapshots.
     *
     * @param graph Graph snapshot used as analysis source.
     * @param input Optional runtime configuration overrides.
     * @returns Deterministic pattern report and summary.
     */
    analyze(
        graph: ICodeGraph,
        input?: IAstAdvancedCodeAnalysisInput,
    ): Promise<IAstAdvancedCodeAnalysisResult>
}

interface IResolvedAnalysisConfig {
    readonly filePaths?: readonly string[]
    readonly minimumHubFanIn: number
    readonly minimumHubFanOut: number
    readonly minimumCycleSize: number
    readonly minimumNodeTypeSpread: number
    readonly maxPatternsPerType: number
}

interface IAnalysisGraphContext {
    readonly nodesByFilePath: ReadonlyMap<string, readonly ICodeGraphNode[]>
    readonly outgoingFileAdjacency: ReadonlyMap<string, ReadonlySet<string>>
    readonly incomingFileAdjacency: ReadonlyMap<string, ReadonlySet<string>>
}

const PATTERN_TYPE_ORDER: readonly AstAdvancedCodePatternType[] = [
    AST_ADVANCED_CODE_PATTERN_TYPE.CIRCULAR_DEPENDENCY,
    AST_ADVANCED_CODE_PATTERN_TYPE.HIGH_FAN_IN,
    AST_ADVANCED_CODE_PATTERN_TYPE.HIGH_FAN_OUT,
    AST_ADVANCED_CODE_PATTERN_TYPE.MIXED_ABSTRACTION,
]

/**
 * Advanced code analysis over AST-derived graph with deterministic pattern detection.
 */
export class AstAdvancedCodeAnalysisService implements IAstAdvancedCodeAnalysisService {
    private readonly defaultMinimumHubFanIn: number
    private readonly defaultMinimumHubFanOut: number
    private readonly defaultMinimumCycleSize: number
    private readonly defaultMinimumNodeTypeSpread: number
    private readonly defaultMaxPatternsPerType: number

    /**
     * Creates advanced AST analysis service.
     *
     * @param options Optional default thresholds.
     */
    public constructor(options: IAstAdvancedCodeAnalysisServiceOptions = {}) {
        this.defaultMinimumHubFanIn = validateMinimumHubFanIn(
            options.defaultMinimumHubFanIn ?? DEFAULT_MINIMUM_HUB_FAN_IN,
        )
        this.defaultMinimumHubFanOut = validateMinimumHubFanOut(
            options.defaultMinimumHubFanOut ?? DEFAULT_MINIMUM_HUB_FAN_OUT,
        )
        this.defaultMinimumCycleSize = validateMinimumCycleSize(
            options.defaultMinimumCycleSize ?? DEFAULT_MINIMUM_CYCLE_SIZE,
        )
        this.defaultMinimumNodeTypeSpread = validateMinimumNodeTypeSpread(
            options.defaultMinimumNodeTypeSpread ?? DEFAULT_MINIMUM_NODE_TYPE_SPREAD,
        )
        this.defaultMaxPatternsPerType = validateMaxPatternsPerType(
            options.defaultMaxPatternsPerType ?? DEFAULT_MAX_PATTERNS_PER_TYPE,
        )
    }

    /**
     * Detects advanced graph patterns from one snapshot.
     *
     * @param graph Graph snapshot used as source.
     * @param input Optional runtime configuration.
     * @returns Deterministic pattern report.
     */
    public analyze(
        graph: ICodeGraph,
        input: IAstAdvancedCodeAnalysisInput = {},
    ): Promise<IAstAdvancedCodeAnalysisResult> {
        const config = this.resolveConfig(input)
        const context = createAnalysisContext(graph, config.filePaths)
        const patterns = detectPatterns(context, config)
        const summary = createSummary(patterns)

        return Promise.resolve({
            patterns,
            summary,
        })
    }

    /**
     * Resolves runtime config with validated defaults.
     *
     * @param input Runtime options.
     * @returns Validated configuration.
     */
    private resolveConfig(input: IAstAdvancedCodeAnalysisInput): IResolvedAnalysisConfig {
        return {
            filePaths: normalizeFilePaths(input.filePaths),
            minimumHubFanIn: validateMinimumHubFanIn(
                input.minimumHubFanIn ?? this.defaultMinimumHubFanIn,
            ),
            minimumHubFanOut: validateMinimumHubFanOut(
                input.minimumHubFanOut ?? this.defaultMinimumHubFanOut,
            ),
            minimumCycleSize: validateMinimumCycleSize(
                input.minimumCycleSize ?? this.defaultMinimumCycleSize,
            ),
            minimumNodeTypeSpread: validateMinimumNodeTypeSpread(
                input.minimumNodeTypeSpread ?? this.defaultMinimumNodeTypeSpread,
            ),
            maxPatternsPerType: validateMaxPatternsPerType(
                input.maxPatternsPerType ?? this.defaultMaxPatternsPerType,
            ),
        }
    }
}

/**
 * Validates minimum incoming dependency threshold.
 *
 * @param value Raw threshold.
 * @returns Validated threshold.
 */
function validateMinimumHubFanIn(value: number): number {
    return validatePositiveSafeInteger(
        value,
        AST_ADVANCED_CODE_ANALYSIS_ERROR_CODE.INVALID_MINIMUM_HUB_FAN_IN,
        "minimumHubFanIn",
    )
}

/**
 * Validates minimum outgoing dependency threshold.
 *
 * @param value Raw threshold.
 * @returns Validated threshold.
 */
function validateMinimumHubFanOut(value: number): number {
    return validatePositiveSafeInteger(
        value,
        AST_ADVANCED_CODE_ANALYSIS_ERROR_CODE.INVALID_MINIMUM_HUB_FAN_OUT,
        "minimumHubFanOut",
    )
}

/**
 * Validates minimum cycle size threshold.
 *
 * @param value Raw threshold.
 * @returns Validated threshold.
 */
function validateMinimumCycleSize(value: number): number {
    return validatePositiveSafeInteger(
        value,
        AST_ADVANCED_CODE_ANALYSIS_ERROR_CODE.INVALID_MINIMUM_CYCLE_SIZE,
        "minimumCycleSize",
        2,
    )
}

/**
 * Validates minimum per-file node-type spread threshold.
 *
 * @param value Raw threshold.
 * @returns Validated threshold.
 */
function validateMinimumNodeTypeSpread(value: number): number {
    return validatePositiveSafeInteger(
        value,
        AST_ADVANCED_CODE_ANALYSIS_ERROR_CODE.INVALID_MINIMUM_NODE_TYPE_SPREAD,
        "minimumNodeTypeSpread",
        2,
    )
}

/**
 * Validates per-type pattern cap.
 *
 * @param value Raw threshold.
 * @returns Validated threshold.
 */
function validateMaxPatternsPerType(value: number): number {
    return validatePositiveSafeInteger(
        value,
        AST_ADVANCED_CODE_ANALYSIS_ERROR_CODE.INVALID_MAX_PATTERNS_PER_TYPE,
        "maxPatternsPerType",
    )
}

/**
 * Validates one positive safe integer.
 *
 * @param value Raw threshold.
 * @param code Typed error code used on failure.
 * @param field Field name for details mapping.
 * @param minimumInclusive Minimum allowed threshold.
 * @returns Validated threshold.
 */
function validatePositiveSafeInteger(
    value: number,
    code:
        (typeof AST_ADVANCED_CODE_ANALYSIS_ERROR_CODE)[keyof typeof AST_ADVANCED_CODE_ANALYSIS_ERROR_CODE],
    field: "minimumHubFanIn" | "minimumHubFanOut" | "minimumCycleSize" | "minimumNodeTypeSpread" | "maxPatternsPerType",
    minimumInclusive = 1,
): number {
    if (Number.isSafeInteger(value) === false || value < minimumInclusive) {
        throw new AstAdvancedCodeAnalysisError(code, {[field]: value})
    }

    return value
}

/**
 * Normalizes optional file-path filter.
 *
 * @param filePaths Raw repository-relative paths.
 * @returns Sorted unique normalized paths or undefined.
 */
function normalizeFilePaths(filePaths?: readonly string[]): readonly string[] | undefined {
    if (filePaths === undefined) {
        return undefined
    }

    if (filePaths.length === 0) {
        throw new AstAdvancedCodeAnalysisError(
            AST_ADVANCED_CODE_ANALYSIS_ERROR_CODE.EMPTY_FILE_PATHS,
        )
    }

    const normalizedPaths = new Set<string>()

    for (const filePath of filePaths) {
        try {
            normalizedPaths.add(FilePath.create(filePath).toString())
        } catch {
            throw new AstAdvancedCodeAnalysisError(
                AST_ADVANCED_CODE_ANALYSIS_ERROR_CODE.INVALID_FILE_PATH,
                {filePath},
            )
        }
    }

    return [...normalizedPaths].sort()
}

/**
 * Builds normalized analysis context from graph snapshot.
 *
 * @param graph Source graph snapshot.
 * @param filePaths Optional file-path filter.
 * @returns Context with node and file-level adjacency indexes.
 */
function createAnalysisContext(
    graph: ICodeGraph,
    filePaths?: readonly string[],
): IAnalysisGraphContext {
    const filePathFilter =
        filePaths === undefined ? undefined : new Set<string>(filePaths)
    const nodeById = createNodeLookup(graph.nodes, filePathFilter)
    const nodesByFilePath = indexNodesByFilePath(nodeById)

    return {
        nodesByFilePath,
        outgoingFileAdjacency: buildFileAdjacency(
            nodeById,
            graph.edges,
            nodesByFilePath,
            "outgoing",
        ),
        incomingFileAdjacency: buildFileAdjacency(
            nodeById,
            graph.edges,
            nodesByFilePath,
            "incoming",
        ),
    }
}

/**
 * Builds node lookup with optional file filtering.
 *
 * @param nodes Graph nodes.
 * @param filePathFilter Optional file-path filter.
 * @returns Node lookup by id.
 */
function createNodeLookup(
    nodes: readonly ICodeGraphNode[],
    filePathFilter?: ReadonlySet<string>,
): ReadonlyMap<string, ICodeGraphNode> {
    const nodeById = new Map<string, ICodeGraphNode>()

    for (const node of nodes) {
        if (filePathFilter !== undefined && filePathFilter.has(node.filePath) === false) {
            continue
        }

        nodeById.set(node.id, node)
    }

    return nodeById
}

/**
 * Indexes nodes by file path with deterministic per-file ordering.
 *
 * @param nodeById Node lookup.
 * @returns File-path index.
 */
function indexNodesByFilePath(
    nodeById: ReadonlyMap<string, ICodeGraphNode>,
): ReadonlyMap<string, readonly ICodeGraphNode[]> {
    const grouped = new Map<string, ICodeGraphNode[]>()

    for (const node of nodeById.values()) {
        const bucket = grouped.get(node.filePath)

        if (bucket === undefined) {
            grouped.set(node.filePath, [node])
            continue
        }

        bucket.push(node)
    }

    const orderedEntries = [...grouped.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([filePath, nodes]): [string, readonly ICodeGraphNode[]] => {
            return [
                filePath,
                [...nodes].sort((left, right) => left.id.localeCompare(right.id)),
            ]
        })

    return new Map<string, readonly ICodeGraphNode[]>(orderedEntries)
}

/**
 * Builds file-level adjacency map.
 *
 * @param nodeById Node lookup by id.
 * @param edges Graph edges.
 * @param nodesByFilePath File-path index.
 * @param direction Requested adjacency direction.
 * @returns File-level adjacency.
 */
function buildFileAdjacency(
    nodeById: ReadonlyMap<string, ICodeGraphNode>,
    edges: readonly ICodeGraphEdge[],
    nodesByFilePath: ReadonlyMap<string, readonly ICodeGraphNode[]>,
    direction: "outgoing" | "incoming",
): ReadonlyMap<string, ReadonlySet<string>> {
    const adjacency = new Map<string, Set<string>>()

    for (const filePath of nodesByFilePath.keys()) {
        adjacency.set(filePath, new Set<string>())
    }

    for (const edge of edges) {
        const sourceNode = nodeById.get(edge.source)
        const targetNode = nodeById.get(edge.target)

        if (sourceNode === undefined || targetNode === undefined) {
            continue
        }

        const sourceFilePath = sourceNode.filePath
        const targetFilePath = targetNode.filePath

        if (sourceFilePath === targetFilePath) {
            continue
        }

        if (direction === "outgoing") {
            adjacency.get(sourceFilePath)?.add(targetFilePath)
            continue
        }

        adjacency.get(targetFilePath)?.add(sourceFilePath)
    }

    return freezeAdjacency(adjacency)
}

/**
 * Freezes adjacency map values for safe read-only consumption.
 *
 * @param adjacency Mutable adjacency map.
 * @returns Immutable adjacency map.
 */
function freezeAdjacency(
    adjacency: Map<string, Set<string>>,
): ReadonlyMap<string, ReadonlySet<string>> {
    const orderedEntries = [...adjacency.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([filePath, targets]): [string, ReadonlySet<string>] => {
            const orderedTargets = [...targets].sort()
            return [filePath, new Set<string>(orderedTargets)]
        })

    return new Map<string, ReadonlySet<string>>(orderedEntries)
}

/**
 * Detects configured pattern categories and applies per-type limits.
 *
 * @param context Normalized graph context.
 * @param config Resolved analysis config.
 * @returns Deterministic pattern list.
 */
function detectPatterns(
    context: IAnalysisGraphContext,
    config: IResolvedAnalysisConfig,
): readonly IAstAdvancedCodePattern[] {
    const cyclePatterns = detectCyclePatterns(context.outgoingFileAdjacency, config)
    const highFanInPatterns = detectHighFanInPatterns(context.incomingFileAdjacency, config)
    const highFanOutPatterns = detectHighFanOutPatterns(context.outgoingFileAdjacency, config)
    const mixedAbstractionPatterns = detectMixedAbstractionPatterns(context.nodesByFilePath, config)
    const groupedPatterns = new Map<AstAdvancedCodePatternType, readonly IAstAdvancedCodePattern[]>([
        [AST_ADVANCED_CODE_PATTERN_TYPE.CIRCULAR_DEPENDENCY, cyclePatterns],
        [AST_ADVANCED_CODE_PATTERN_TYPE.HIGH_FAN_IN, highFanInPatterns],
        [AST_ADVANCED_CODE_PATTERN_TYPE.HIGH_FAN_OUT, highFanOutPatterns],
        [AST_ADVANCED_CODE_PATTERN_TYPE.MIXED_ABSTRACTION, mixedAbstractionPatterns],
    ])

    const limited: IAstAdvancedCodePattern[] = []

    for (const type of PATTERN_TYPE_ORDER) {
        const patterns = groupedPatterns.get(type) ?? []
        const sorted = [...patterns].sort(comparePatternByRank)
        limited.push(...sorted.slice(0, config.maxPatternsPerType))
    }

    return [...limited].sort(comparePatternByTypeAndRank)
}

/**
 * Detects circular dependency patterns from file-level graph.
 *
 * @param adjacency File-level outgoing adjacency.
 * @param config Resolved analysis config.
 * @returns Cycle patterns.
 */
function detectCyclePatterns(
    adjacency: ReadonlyMap<string, ReadonlySet<string>>,
    config: IResolvedAnalysisConfig,
): readonly IAstAdvancedCodePattern[] {
    const components = findStronglyConnectedComponents(adjacency)
    const cycleComponents = components.filter(
        (component) => component.length >= config.minimumCycleSize,
    )

    return cycleComponents.map((component): IAstAdvancedCodePattern => {
        return {
            id: `${AST_ADVANCED_CODE_PATTERN_TYPE.CIRCULAR_DEPENDENCY}:${component.join("|")}`,
            type: AST_ADVANCED_CODE_PATTERN_TYPE.CIRCULAR_DEPENDENCY,
            severity: resolveCycleSeverity(component.length),
            filePaths: component,
            score: component.length,
            details: {
                cycleSize: component.length,
            },
        }
    })
}

/**
 * Detects high fan-in patterns.
 *
 * @param incomingAdjacency File-level incoming adjacency.
 * @param config Resolved analysis config.
 * @returns High fan-in patterns.
 */
function detectHighFanInPatterns(
    incomingAdjacency: ReadonlyMap<string, ReadonlySet<string>>,
    config: IResolvedAnalysisConfig,
): readonly IAstAdvancedCodePattern[] {
    return buildHubPatterns(
        incomingAdjacency,
        config.minimumHubFanIn,
        AST_ADVANCED_CODE_PATTERN_TYPE.HIGH_FAN_IN,
        "fanIn",
    )
}

/**
 * Detects high fan-out patterns.
 *
 * @param outgoingAdjacency File-level outgoing adjacency.
 * @param config Resolved analysis config.
 * @returns High fan-out patterns.
 */
function detectHighFanOutPatterns(
    outgoingAdjacency: ReadonlyMap<string, ReadonlySet<string>>,
    config: IResolvedAnalysisConfig,
): readonly IAstAdvancedCodePattern[] {
    return buildHubPatterns(
        outgoingAdjacency,
        config.minimumHubFanOut,
        AST_ADVANCED_CODE_PATTERN_TYPE.HIGH_FAN_OUT,
        "fanOut",
    )
}

/**
 * Detects mixed-abstraction patterns by node-type spread.
 *
 * @param nodesByFilePath File-path index.
 * @param config Resolved analysis config.
 * @returns Mixed abstraction patterns.
 */
function detectMixedAbstractionPatterns(
    nodesByFilePath: ReadonlyMap<string, readonly ICodeGraphNode[]>,
    config: IResolvedAnalysisConfig,
): readonly IAstAdvancedCodePattern[] {
    const patterns: IAstAdvancedCodePattern[] = []

    for (const [filePath, nodes] of nodesByFilePath.entries()) {
        const nodeTypes = collectNodeTypes(nodes)

        if (nodeTypes.size < config.minimumNodeTypeSpread) {
            continue
        }

        patterns.push({
            id: `${AST_ADVANCED_CODE_PATTERN_TYPE.MIXED_ABSTRACTION}:${filePath}`,
            type: AST_ADVANCED_CODE_PATTERN_TYPE.MIXED_ABSTRACTION,
            severity: resolveMixedAbstractionSeverity(nodeTypes.size),
            filePaths: [filePath],
            score: nodeTypes.size,
            details: {
                nodeCount: nodes.length,
                nodeTypeSpread: nodeTypes.size,
            },
        })
    }

    return patterns
}

/**
 * Collects distinct node types from one file.
 *
 * @param nodes File-level nodes.
 * @returns Distinct node types.
 */
function collectNodeTypes(nodes: readonly ICodeGraphNode[]): ReadonlySet<CodeGraphNodeType> {
    const types = new Set<CodeGraphNodeType>()

    for (const node of nodes) {
        types.add(node.type)
    }

    return types
}

/**
 * Builds high fan-in or high fan-out pattern collection.
 *
 * @param adjacency File-level adjacency.
 * @param threshold Minimum degree threshold.
 * @param type Pattern category.
 * @param metricName Metric key used in details payload.
 * @returns Hub patterns.
 */
function buildHubPatterns(
    adjacency: ReadonlyMap<string, ReadonlySet<string>>,
    threshold: number,
    type: AstAdvancedCodePatternType,
    metricName: "fanIn" | "fanOut",
): readonly IAstAdvancedCodePattern[] {
    const patterns: IAstAdvancedCodePattern[] = []

    for (const [filePath, neighbors] of adjacency.entries()) {
        const degree = neighbors.size

        if (degree < threshold) {
            continue
        }

        patterns.push({
            id: `${type}:${filePath}`,
            type,
            severity: resolveHubSeverity(degree, threshold),
            filePaths: [filePath],
            score: degree,
            details: {
                [metricName]: degree,
            },
        })
    }

    return patterns
}

/**
 * Finds strongly connected components with Tarjan algorithm.
 *
 * @param adjacency Directed file-level adjacency.
 * @returns Deterministic strongly connected components.
 */
function findStronglyConnectedComponents(
    adjacency: ReadonlyMap<string, ReadonlySet<string>>,
): readonly (readonly string[])[] {
    const indexByNode = new Map<string, number>()
    const lowLinkByNode = new Map<string, number>()
    const stack: string[] = []
    const inStack = new Set<string>()
    const components: string[][] = []
    let index = 0

    const updateLowLink = (node: string, candidate: number): void => {
        const currentLowLink = lowLinkByNode.get(node) ?? Number.MAX_SAFE_INTEGER
        lowLinkByNode.set(node, Math.min(currentLowLink, candidate))
    }

    const traverseNeighbor = (node: string, neighbor: string): void => {
        if (indexByNode.has(neighbor) === false) {
            visit(neighbor)
            updateLowLink(node, lowLinkByNode.get(neighbor) ?? Number.MAX_SAFE_INTEGER)
            return
        }

        if (inStack.has(neighbor)) {
            updateLowLink(node, indexByNode.get(neighbor) ?? Number.MAX_SAFE_INTEGER)
        }
    }

    const processNeighbors = (node: string): void => {
        const neighbors = adjacency.get(node)
        if (neighbors === undefined) {
            return
        }

        for (const neighbor of neighbors) {
            traverseNeighbor(node, neighbor)
        }
    }

    const visit = (node: string): void => {
        indexByNode.set(node, index)
        lowLinkByNode.set(node, index)
        index += 1
        stack.push(node)
        inStack.add(node)

        processNeighbors(node)

        const nodeIndex = indexByNode.get(node)
        const nodeLowLink = lowLinkByNode.get(node)

        if (nodeIndex !== undefined && nodeLowLink === nodeIndex) {
            const component: string[] = []
            let stackNode: string | undefined = stack.pop()

            while (stackNode !== undefined) {
                inStack.delete(stackNode)
                component.push(stackNode)
                if (stackNode === node) {
                    break
                }
                stackNode = stack.pop()
            }

            components.push(component.sort())
        }
    }

    const orderedNodes = [...adjacency.keys()].sort()
    for (const node of orderedNodes) {
        if (indexByNode.has(node)) {
            continue
        }
        visit(node)
    }

    return components.sort(compareStringArrayByKey)
}

/**
 * Resolves cycle severity from cycle size.
 *
 * @param cycleSize Number of files in cycle.
 * @returns Severity bucket.
 */
function resolveCycleSeverity(cycleSize: number): AstAdvancedCodePatternSeverity {
    if (cycleSize >= 5) {
        return AST_ADVANCED_CODE_PATTERN_SEVERITY.HIGH
    }

    if (cycleSize >= 3) {
        return AST_ADVANCED_CODE_PATTERN_SEVERITY.MEDIUM
    }

    return AST_ADVANCED_CODE_PATTERN_SEVERITY.LOW
}

/**
 * Resolves hub severity from degree and threshold.
 *
 * @param degree File degree.
 * @param threshold Minimum threshold.
 * @returns Severity bucket.
 */
function resolveHubSeverity(
    degree: number,
    threshold: number,
): AstAdvancedCodePatternSeverity {
    if (degree >= threshold * 2) {
        return AST_ADVANCED_CODE_PATTERN_SEVERITY.HIGH
    }

    return AST_ADVANCED_CODE_PATTERN_SEVERITY.MEDIUM
}

/**
 * Resolves mixed-abstraction severity from type spread.
 *
 * @param nodeTypeSpread Distinct node-type count.
 * @returns Severity bucket.
 */
function resolveMixedAbstractionSeverity(
    nodeTypeSpread: number,
): AstAdvancedCodePatternSeverity {
    if (nodeTypeSpread >= 4) {
        return AST_ADVANCED_CODE_PATTERN_SEVERITY.HIGH
    }

    return AST_ADVANCED_CODE_PATTERN_SEVERITY.MEDIUM
}

/**
 * Compares patterns by score and stable id.
 *
 * @param left Left pattern.
 * @param right Right pattern.
 * @returns Sort result.
 */
function comparePatternByRank(
    left: IAstAdvancedCodePattern,
    right: IAstAdvancedCodePattern,
): number {
    if (left.score !== right.score) {
        return right.score - left.score
    }

    return left.id.localeCompare(right.id)
}

/**
 * Compares patterns by category and rank.
 *
 * @param left Left pattern.
 * @param right Right pattern.
 * @returns Sort result.
 */
function comparePatternByTypeAndRank(
    left: IAstAdvancedCodePattern,
    right: IAstAdvancedCodePattern,
): number {
    const leftTypeIndex = PATTERN_TYPE_ORDER.indexOf(left.type)
    const rightTypeIndex = PATTERN_TYPE_ORDER.indexOf(right.type)

    if (leftTypeIndex !== rightTypeIndex) {
        return leftTypeIndex - rightTypeIndex
    }

    return comparePatternByRank(left, right)
}

/**
 * Compares string arrays by joined stable key.
 *
 * @param left Left string array.
 * @param right Right string array.
 * @returns Sort result.
 */
function compareStringArrayByKey(left: readonly string[], right: readonly string[]): number {
    return left.join("|").localeCompare(right.join("|"))
}

/**
 * Builds deterministic summary from detected patterns.
 *
 * @param patterns Detected patterns.
 * @returns Pattern summary.
 */
function createSummary(
    patterns: readonly IAstAdvancedCodePattern[],
): IAstAdvancedCodeAnalysisSummary {
    const byType: Record<AstAdvancedCodePatternType, number> = {
        CIRCULAR_DEPENDENCY: 0,
        HIGH_FAN_IN: 0,
        HIGH_FAN_OUT: 0,
        MIXED_ABSTRACTION: 0,
    }

    for (const pattern of patterns) {
        byType[pattern.type] += 1
    }

    return {
        totalPatterns: patterns.length,
        byType,
    }
}
