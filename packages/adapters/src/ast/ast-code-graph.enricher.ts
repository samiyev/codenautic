import {
    CODE_GRAPH_EDGE_TYPE,
    CODE_GRAPH_NODE_TYPE,
    FilePath,
    type CodeGraphEdgeType,
    type IAstCallDTO,
    type IAstClassDTO,
    type IAstFunctionDTO,
    type IAstImportDTO,
    type IAstInterfaceDTO,
    type IAstSourceLocationDTO,
    type ICodeGraph,
    type ICodeGraphEdge,
    type ICodeGraphNode,
    type IParsedSourceFileDTO,
} from "@codenautic/core"

import type {IAstCodeGraphBuildResult} from "./ast-code-graph.builder"
import {
    AST_CODE_GRAPH_ENRICHER_ERROR_CODE,
    AstCodeGraphEnricherError,
} from "./ast-code-graph-enricher.error"

const IMPORT_EXTENSION_CANDIDATES = [".ts", ".tsx", ".js", ".jsx"] as const
const FILE_NODE_CATEGORY_INTERFACE = "interface"

type INormalizedParsedSourceFile = Omit<IParsedSourceFileDTO, "filePath"> & {
    readonly filePath: string
}

type IEdgeCollectionState = {
    readonly edges: ICodeGraphEdge[]
    readonly edgeKeys: Set<string>
    readonly outgoingEdges: Map<string, ICodeGraphEdge[]>
    readonly incomingEdges: Map<string, ICodeGraphEdge[]>
    readonly edgesByType: Map<CodeGraphEdgeType, ICodeGraphEdge[]>
}

type IRelationScope = {
    readonly currentFilePath: string
    readonly reachableFilePaths: ReadonlySet<string>
}

/**
 * Input payload for AST graph enrichment.
 */
export interface IAstCodeGraphEnrichmentInput {
    /**
     * Node-level graph build result used as enrichment baseline.
     */
    readonly graph: IAstCodeGraphBuildResult

    /**
     * Parsed source file snapshots used to derive semantic edges.
     */
    readonly files: readonly IParsedSourceFileDTO[]
}

/**
 * Enriched graph result with adjacency indexes for O(1) lookups.
 */
export interface IAstCodeGraphEnrichmentResult extends IAstCodeGraphBuildResult {
    /**
     * Graph payload enriched with semantic edges.
     */
    readonly graph: ICodeGraph

    /**
     * O(1) lookup of outgoing edges by source node id.
     */
    readonly outgoingEdges: ReadonlyMap<string, readonly ICodeGraphEdge[]>

    /**
     * O(1) lookup of incoming edges by target node id.
     */
    readonly incomingEdges: ReadonlyMap<string, readonly ICodeGraphEdge[]>

    /**
     * O(1) lookup of edges grouped by semantic relation type.
     */
    readonly edgesByType: ReadonlyMap<CodeGraphEdgeType, readonly ICodeGraphEdge[]>
}

/**
 * AST graph enrichment contract.
 */
export interface IAstCodeGraphEnricher {
    /**
     * Enriches node-only graph snapshot with semantic edges and adjacency indexes.
     *
     * @param input Node-level graph and parsed source files.
     * @returns Enriched graph snapshot with edge lookup indexes.
     * @throws {AstCodeGraphEnricherError} When graph nodes and parsed source files are inconsistent.
     */
    enrich(input: IAstCodeGraphEnrichmentInput): IAstCodeGraphEnrichmentResult
}

/**
 * Derives semantic graph edges from parsed AST snapshots.
 */
export class AstCodeGraphEnricher implements IAstCodeGraphEnricher {
    /**
     * Enriches builder output with semantic graph edges and adjacency indexes.
     *
     * @param input Node-level graph and parsed source files.
     * @returns Enriched graph snapshot with edge lookups.
     */
    public enrich(input: IAstCodeGraphEnrichmentInput): IAstCodeGraphEnrichmentResult {
        const files = normalizeParsedSourceFiles(input.files)
        const edgeState = createEdgeCollectionState()

        for (const file of files) {
            const fileNode = input.graph.fileNodes.get(file.filePath)
            if (fileNode === undefined) {
                throw new AstCodeGraphEnricherError(
                    AST_CODE_GRAPH_ENRICHER_ERROR_CODE.FILE_NODE_NOT_FOUND,
                    {
                        filePath: file.filePath,
                    },
                )
            }

            const reachableFilePaths = resolveReachableFilePaths(file, input.graph.fileNodes)
            const relationScope: IRelationScope = {
                currentFilePath: file.filePath,
                reachableFilePaths,
            }

            collectImportEdges(file, fileNode, input.graph.fileNodes, edgeState)
            collectHasMethodEdges(file, input.graph, edgeState)
            collectExtendsAndImplementsEdges(file, input.graph, relationScope, edgeState)
            collectCallEdges(file, input.graph, relationScope, edgeState)
        }

        const edges = [...edgeState.edges].sort(sortGraphEdges)

        return {
            ...input.graph,
            graph: {
                ...input.graph.graph,
                edges,
            },
            outgoingEdges: finalizeEdgeIndex(edgeState.outgoingEdges),
            incomingEdges: finalizeEdgeIndex(edgeState.incomingEdges),
            edgesByType: finalizeEdgeIndexByType(edgeState.edgesByType),
        }
    }
}

/**
 * Creates empty mutable edge collection state.
 *
 * @returns Mutable edge collection state.
 */
function createEdgeCollectionState(): IEdgeCollectionState {
    return {
        edges: [],
        edgeKeys: new Set<string>(),
        outgoingEdges: new Map<string, ICodeGraphEdge[]>(),
        incomingEdges: new Map<string, ICodeGraphEdge[]>(),
        edgesByType: new Map<CodeGraphEdgeType, ICodeGraphEdge[]>(),
    }
}

/**
 * Normalizes parsed source files and validates unique file paths.
 *
 * @param files Parsed source file snapshots.
 * @returns Normalized parsed source file snapshots.
 * @throws {AstCodeGraphEnricherError} When file paths are duplicated after normalization.
 */
function normalizeParsedSourceFiles(
    files: readonly IParsedSourceFileDTO[],
): readonly INormalizedParsedSourceFile[] {
    const normalizedFiles: INormalizedParsedSourceFile[] = []
    const seenPaths = new Set<string>()

    for (const file of files) {
        const normalizedFilePath = FilePath.create(file.filePath).toString()

        if (seenPaths.has(normalizedFilePath)) {
            throw new AstCodeGraphEnricherError(
                AST_CODE_GRAPH_ENRICHER_ERROR_CODE.DUPLICATE_FILE_PATH,
                {
                    filePath: normalizedFilePath,
                },
            )
        }

        seenPaths.add(normalizedFilePath)
        normalizedFiles.push({
            ...file,
            filePath: normalizedFilePath,
        })
    }

    return normalizedFiles.sort((left, right) => left.filePath.localeCompare(right.filePath))
}

/**
 * Collects file import edges for one source file.
 *
 * @param file Normalized parsed source file.
 * @param fileNode Source file node.
 * @param fileNodes File node lookup by normalized path.
 * @param edgeState Mutable edge collection state.
 */
function collectImportEdges(
    file: INormalizedParsedSourceFile,
    fileNode: ICodeGraphNode,
    fileNodes: ReadonlyMap<string, ICodeGraphNode>,
    edgeState: IEdgeCollectionState,
): void {
    for (const entry of sortImportDeclarations(file.imports)) {
        const targetFilePath = resolveRelativeImportTarget(file.filePath, entry, fileNodes)
        if (targetFilePath === undefined) {
            continue
        }

        const targetNode = fileNodes.get(targetFilePath)
        if (targetNode === undefined) {
            continue
        }

        registerEdge(fileNode.id, targetNode.id, CODE_GRAPH_EDGE_TYPE.IMPORTS, edgeState)
    }
}

/**
 * Collects class-to-method ownership edges.
 *
 * @param file Normalized parsed source file.
 * @param graph Node-level graph build result.
 * @param edgeState Mutable edge collection state.
 */
function collectHasMethodEdges(
    file: INormalizedParsedSourceFile,
    graph: IAstCodeGraphBuildResult,
    edgeState: IEdgeCollectionState,
): void {
    for (const method of sortFunctionDeclarations(file.functions)) {
        if (method.parentClassName === undefined) {
            continue
        }

        const classNode = findClassNode(
            graph.typeNodes,
            file.filePath,
            method.parentClassName,
        )
        const methodNode = findFunctionNode(
            graph.functionNodes,
            file.filePath,
            method,
        )

        registerEdge(classNode.id, methodNode.id, CODE_GRAPH_EDGE_TYPE.HAS_METHOD, edgeState)
    }
}

/**
 * Collects EXTENDS and IMPLEMENTS edges from classes and interfaces.
 *
 * @param file Normalized parsed source file.
 * @param graph Node-level graph build result.
 * @param scope Reachable file scope for reference resolution.
 * @param edgeState Mutable edge collection state.
 */
function collectExtendsAndImplementsEdges(
    file: INormalizedParsedSourceFile,
    graph: IAstCodeGraphBuildResult,
    scope: IRelationScope,
    edgeState: IEdgeCollectionState,
): void {
    for (const declaration of sortClassDeclarations(file.classes)) {
        const classNode = findClassNode(graph.typeNodes, file.filePath, declaration.name)

        const extendTargets = resolveTypeReferenceNodes(
            graph.typeNodes,
            declaration.extendsTypes,
            scope,
            "class",
        )
        for (const targetNode of extendTargets) {
            registerEdge(classNode.id, targetNode.id, CODE_GRAPH_EDGE_TYPE.EXTENDS, edgeState)
        }

        const implementTargets = resolveTypeReferenceNodes(
            graph.typeNodes,
            declaration.implementsTypes,
            scope,
            "implements",
        )
        for (const targetNode of implementTargets) {
            registerEdge(classNode.id, targetNode.id, CODE_GRAPH_EDGE_TYPE.IMPLEMENTS, edgeState)
        }
    }

    for (const declaration of sortInterfaceDeclarations(file.interfaces)) {
        const interfaceNode = findInterfaceNode(graph.typeNodes, file.filePath, declaration.name)
        const extendTargets = resolveTypeReferenceNodes(
            graph.typeNodes,
            declaration.extendsTypes,
            scope,
            "interface",
        )

        for (const targetNode of extendTargets) {
            registerEdge(interfaceNode.id, targetNode.id, CODE_GRAPH_EDGE_TYPE.EXTENDS, edgeState)
        }
    }
}

/**
 * Collects function-to-function CALLS edges.
 *
 * @param file Normalized parsed source file.
 * @param graph Node-level graph build result.
 * @param scope Reachable file scope for reference resolution.
 * @param edgeState Mutable edge collection state.
 */
function collectCallEdges(
    file: INormalizedParsedSourceFile,
    graph: IAstCodeGraphBuildResult,
    scope: IRelationScope,
    edgeState: IEdgeCollectionState,
): void {
    for (const call of sortCallExpressions(file.calls)) {
        const sourceNode = resolveSourceFunctionNode(graph.functionNodes, file.filePath, call)
        if (sourceNode === undefined) {
            continue
        }

        const targetNodes = resolveCallTargetNodes(
            graph.functionNodes,
            sourceNode,
            call,
            scope,
        )

        for (const targetNode of targetNodes) {
            registerEdge(sourceNode.id, targetNode.id, CODE_GRAPH_EDGE_TYPE.CALLS, edgeState)
        }
    }
}

/**
 * Resolves all file paths reachable through relative imports from current file.
 *
 * @param file Normalized parsed source file.
 * @param fileNodes File node lookup by normalized path.
 * @returns Reachable file paths including current file.
 */
function resolveReachableFilePaths(
    file: INormalizedParsedSourceFile,
    fileNodes: ReadonlyMap<string, ICodeGraphNode>,
): ReadonlySet<string> {
    const reachable = new Set<string>([file.filePath])

    for (const entry of file.imports) {
        const targetFilePath = resolveRelativeImportTarget(file.filePath, entry, fileNodes)
        if (targetFilePath !== undefined) {
            reachable.add(targetFilePath)
        }
    }

    return reachable
}

/**
 * Resolves one relative import to a graph file path when it belongs to scanned files.
 *
 * @param sourceFilePath Source repository-relative file path.
 * @param entry Parsed import entry.
 * @param fileNodes File node lookup by normalized path.
 * @returns Resolved target file path or undefined for external/unresolved imports.
 */
function resolveRelativeImportTarget(
    sourceFilePath: string,
    entry: IAstImportDTO,
    fileNodes: ReadonlyMap<string, ICodeGraphNode>,
): string | undefined {
    if (isRelativeImport(entry.source) === false) {
        return undefined
    }

    const normalizedPath = normalizeRelativeImportPath(sourceFilePath, entry.source)
    if (fileNodes.has(normalizedPath)) {
        return normalizedPath
    }

    if (hasExplicitExtension(entry.source)) {
        return undefined
    }

    for (const extension of IMPORT_EXTENSION_CANDIDATES) {
        const candidate = `${normalizedPath}${extension}`
        if (fileNodes.has(candidate)) {
            return candidate
        }
    }

    for (const extension of IMPORT_EXTENSION_CANDIDATES) {
        const candidate = `${normalizedPath}/index${extension}`
        if (fileNodes.has(candidate)) {
            return candidate
        }
    }

    return undefined
}

/**
 * Resolves source function node for one call expression.
 *
 * @param functionNodes Function node lookup index.
 * @param filePath Current file path.
 * @param call Parsed call expression.
 * @returns Matching function node or undefined when call is outside known functions.
 */
function resolveSourceFunctionNode(
    functionNodes: ReadonlyMap<string, readonly ICodeGraphNode[]>,
    filePath: string,
    call: IAstCallDTO,
): ICodeGraphNode | undefined {
    if (call.caller === undefined) {
        return undefined
    }

    const candidates = functionNodes.get(call.caller) ?? []
    const sameFileCandidates = candidates.filter((node) => node.filePath === filePath)
    const containingCandidates = sameFileCandidates.filter((node) =>
        doesNodeContainLocation(node, call.location),
    )

    if (containingCandidates.length > 0) {
        return [...containingCandidates].sort(sortFunctionNodesForContainment)[0]
    }

    if (sameFileCandidates.length === 1) {
        return sameFileCandidates[0]
    }

    return undefined
}

/**
 * Resolves target function nodes for one call expression.
 *
 * @param functionNodes Function node lookup index.
 * @param sourceNode Source function node.
 * @param call Parsed call expression.
 * @param scope Reachable file scope for reference resolution.
 * @returns Matching target function nodes.
 */
function resolveCallTargetNodes(
    functionNodes: ReadonlyMap<string, readonly ICodeGraphNode[]>,
    sourceNode: ICodeGraphNode,
    call: IAstCallDTO,
    scope: IRelationScope,
): readonly ICodeGraphNode[] {
    if (call.callee.startsWith("this.")) {
        const parentClassName = readMetadataString(sourceNode, "parentClassName")
        if (parentClassName === undefined) {
            return []
        }

        const methodName = call.callee.slice("this.".length).trim()
        return resolveFunctionNodesByKey(
            functionNodes,
            `${parentClassName}.${methodName}`,
            scope.reachableFilePaths,
        )
    }

    if (call.callee.includes(".")) {
        return resolveFunctionNodesByKey(
            functionNodes,
            call.callee,
            scope.reachableFilePaths,
        )
    }

    const importedCandidates = resolveFunctionNodesByKey(
        functionNodes,
        call.callee,
        new Set<string>(
            [...scope.reachableFilePaths].filter((filePath) => filePath !== scope.currentFilePath),
        ),
    )
    if (importedCandidates.length > 0) {
        return importedCandidates
    }

    const localCandidates = resolveFunctionNodesByKey(
        functionNodes,
        call.callee,
        new Set<string>([scope.currentFilePath]),
    )
    if (localCandidates.length > 0) {
        return localCandidates
    }

    const allCandidates = functionNodes.get(call.callee)
    if (allCandidates?.length === 1) {
        return allCandidates
    }

    return []
}

/**
 * Resolves function nodes by lookup key and reachable file scope.
 *
 * @param functionNodes Function node lookup index.
 * @param key Simple or qualified function lookup key.
 * @param reachableFilePaths Reachable file scope.
 * @returns Matching function nodes.
 */
function resolveFunctionNodesByKey(
    functionNodes: ReadonlyMap<string, readonly ICodeGraphNode[]>,
    key: string,
    reachableFilePaths: ReadonlySet<string>,
): readonly ICodeGraphNode[] {
    const candidates = functionNodes.get(key) ?? []
    const scoped = candidates.filter((node) => reachableFilePaths.has(node.filePath))

    return [...scoped].sort(sortGraphNodesById)
}

/**
 * Resolves type-reference target nodes within reachable file scope.
 *
 * @param typeNodes Type node lookup index.
 * @param references Raw type-reference texts from AST.
 * @param scope Reachable file scope.
 * @param mode Relation mode used for target filtering.
 * @returns Matching target nodes.
 */
function resolveTypeReferenceNodes(
    typeNodes: ReadonlyMap<string, readonly ICodeGraphNode[]>,
    references: readonly string[],
    scope: IRelationScope,
    mode: "class" | "implements" | "interface",
): readonly ICodeGraphNode[] {
    const result = new Map<string, ICodeGraphNode>()

    for (const reference of references) {
        const normalizedName = normalizeTypeReferenceName(reference)
        if (normalizedName.length === 0) {
            continue
        }

        const candidates = typeNodes.get(normalizedName) ?? []
        const scopedCandidates = candidates.filter((node) => scope.reachableFilePaths.has(node.filePath))
        const resolvedCandidates =
            scopedCandidates.length > 0
                ? scopedCandidates
                : candidates.length === 1
                  ? candidates
                  : []

        for (const candidate of filterTypeReferenceCandidates(resolvedCandidates, mode)) {
            result.set(candidate.id, candidate)
        }
    }

    return [...result.values()].sort(sortGraphNodesById)
}

/**
 * Filters type-reference targets according to relation semantics.
 *
 * @param candidates Candidate graph nodes.
 * @param mode Relation mode used for target filtering.
 * @returns Filtered graph nodes.
 */
function filterTypeReferenceCandidates(
    candidates: readonly ICodeGraphNode[],
    mode: "class" | "implements" | "interface",
): readonly ICodeGraphNode[] {
    if (mode === "implements") {
        return candidates.filter((node) => isInterfaceNode(node))
    }

    if (mode === "interface") {
        return candidates.filter((node) => isTypeNode(node))
    }

    const classCandidates = candidates.filter((node) => node.type === CODE_GRAPH_NODE_TYPE.CLASS)
    if (classCandidates.length > 0) {
        return classCandidates
    }

    return candidates.filter((node) => isTypeNode(node))
}

/**
 * Finds exact class node for one file-local class declaration.
 *
 * @param typeNodes Type node lookup index.
 * @param filePath Source file path.
 * @param className Class identifier.
 * @returns Matching class node.
 * @throws {AstCodeGraphEnricherError} When class node is missing.
 */
function findClassNode(
    typeNodes: ReadonlyMap<string, readonly ICodeGraphNode[]>,
    filePath: string,
    className: string,
): ICodeGraphNode {
    const candidates = typeNodes.get(className) ?? []
    const match = candidates.find((node) => {
        return node.filePath === filePath && node.type === CODE_GRAPH_NODE_TYPE.CLASS
    })

    if (match === undefined) {
        throw new AstCodeGraphEnricherError(
            AST_CODE_GRAPH_ENRICHER_ERROR_CODE.CLASS_NODE_NOT_FOUND,
            {
                filePath,
                className,
            },
        )
    }

    return match
}

/**
 * Finds exact interface node for one file-local interface declaration.
 *
 * @param typeNodes Type node lookup index.
 * @param filePath Source file path.
 * @param interfaceName Interface identifier.
 * @returns Matching interface node.
 */
function findInterfaceNode(
    typeNodes: ReadonlyMap<string, readonly ICodeGraphNode[]>,
    filePath: string,
    interfaceName: string,
): ICodeGraphNode {
    const candidates = typeNodes.get(interfaceName) ?? []
    const match = candidates.find((node) => {
        return node.filePath === filePath && isInterfaceNode(node)
    })

    if (match === undefined) {
        throw new AstCodeGraphEnricherError(
            AST_CODE_GRAPH_ENRICHER_ERROR_CODE.CLASS_NODE_NOT_FOUND,
            {
                filePath,
                className: interfaceName,
            },
        )
    }

    return match
}

/**
 * Finds exact function or method node for one file-local declaration.
 *
 * @param functionNodes Function node lookup index.
 * @param filePath Source file path.
 * @param declaration Parsed function declaration.
 * @returns Matching function node.
 * @throws {AstCodeGraphEnricherError} When function node is missing.
 */
function findFunctionNode(
    functionNodes: ReadonlyMap<string, readonly ICodeGraphNode[]>,
    filePath: string,
    declaration: IAstFunctionDTO,
): ICodeGraphNode {
    const qualifiedKey =
        declaration.parentClassName !== undefined
            ? `${declaration.parentClassName}.${declaration.name}`
            : declaration.name
    const candidates = functionNodes.get(qualifiedKey) ?? functionNodes.get(declaration.name) ?? []
    const match = candidates.find((node) => {
        return (
            node.filePath === filePath &&
            readMetadataNumber(node, "lineStart") === declaration.location.lineStart &&
            readMetadataString(node, "parentClassName") ===
                (declaration.parentClassName ?? undefined)
        )
    })

    if (match === undefined) {
        throw new AstCodeGraphEnricherError(
            AST_CODE_GRAPH_ENRICHER_ERROR_CODE.FUNCTION_NODE_NOT_FOUND,
            {
                filePath,
                functionName: declaration.name,
            },
        )
    }

    return match
}

/**
 * Registers one semantic edge and updates adjacency indexes.
 *
 * @param source Source node identifier.
 * @param target Target node identifier.
 * @param type Semantic edge type.
 * @param edgeState Mutable edge collection state.
 */
function registerEdge(
    source: string,
    target: string,
    type: CodeGraphEdgeType,
    edgeState: IEdgeCollectionState,
): void {
    const edgeKey = `${source}|${type}|${target}`
    if (edgeState.edgeKeys.has(edgeKey)) {
        return
    }

    const edge: ICodeGraphEdge = {
        source,
        target,
        type,
    }

    edgeState.edgeKeys.add(edgeKey)
    edgeState.edges.push(edge)
    indexEdge(edgeState.outgoingEdges, source, edge)
    indexEdge(edgeState.incomingEdges, target, edge)
    indexEdgeByType(edgeState.edgesByType, type, edge)
}

/**
 * Adds edge to string-keyed adjacency index.
 *
 * @param index Mutable adjacency index.
 * @param key Index key.
 * @param edge Graph edge to append.
 */
function indexEdge(
    index: Map<string, ICodeGraphEdge[]>,
    key: string,
    edge: ICodeGraphEdge,
): void {
    const existing = index.get(key)
    if (existing === undefined) {
        index.set(key, [edge])
        return
    }

    existing.push(edge)
}

/**
 * Adds edge to relation-type grouped index.
 *
 * @param index Mutable relation-type grouped index.
 * @param key Semantic edge type.
 * @param edge Graph edge to append.
 */
function indexEdgeByType(
    index: Map<CodeGraphEdgeType, ICodeGraphEdge[]>,
    key: CodeGraphEdgeType,
    edge: ICodeGraphEdge,
): void {
    const existing = index.get(key)
    if (existing === undefined) {
        index.set(key, [edge])
        return
    }

    existing.push(edge)
}

/**
 * Finalizes adjacency index into deterministic readonly snapshot.
 *
 * @param index Mutable adjacency index.
 * @returns Deterministic readonly adjacency index.
 */
function finalizeEdgeIndex(
    index: Map<string, ICodeGraphEdge[]>,
): ReadonlyMap<string, readonly ICodeGraphEdge[]> {
    const entries = [...index.entries()]
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([key, edges]): [string, readonly ICodeGraphEdge[]] => {
            return [key, [...edges].sort(sortGraphEdges)]
        })

    return new Map<string, readonly ICodeGraphEdge[]>(entries)
}

/**
 * Finalizes relation-type grouped edge index into deterministic readonly snapshot.
 *
 * @param index Mutable relation-type grouped index.
 * @returns Deterministic readonly grouped edge index.
 */
function finalizeEdgeIndexByType(
    index: Map<CodeGraphEdgeType, ICodeGraphEdge[]>,
): ReadonlyMap<CodeGraphEdgeType, readonly ICodeGraphEdge[]> {
    const entries = [...index.entries()]
        .sort(([leftKey], [rightKey]) => String(leftKey).localeCompare(String(rightKey)))
        .map(([key, edges]): [CodeGraphEdgeType, readonly ICodeGraphEdge[]] => {
            return [key, [...edges].sort(sortGraphEdges)]
        })

    return new Map<CodeGraphEdgeType, readonly ICodeGraphEdge[]>(entries)
}

/**
 * Sorts import declarations by location and source specifier.
 *
 * @param imports Parsed import entries.
 * @returns Sorted import entries.
 */
function sortImportDeclarations(imports: readonly IAstImportDTO[]): readonly IAstImportDTO[] {
    return [...imports].sort((left, right) => {
        const locationOrder = compareSourceLocations(left.location, right.location)
        if (locationOrder !== 0) {
            return locationOrder
        }

        return left.source.localeCompare(right.source)
    })
}

/**
 * Sorts call expressions by location and callee name.
 *
 * @param calls Parsed call expressions.
 * @returns Sorted call expressions.
 */
function sortCallExpressions(calls: readonly IAstCallDTO[]): readonly IAstCallDTO[] {
    return [...calls].sort((left, right) => {
        const locationOrder = compareSourceLocations(left.location, right.location)
        if (locationOrder !== 0) {
            return locationOrder
        }

        return left.callee.localeCompare(right.callee)
    })
}

/**
 * Sorts class declarations by location and name.
 *
 * @param declarations Parsed class declarations.
 * @returns Sorted class declarations.
 */
function sortClassDeclarations(
    declarations: readonly IAstClassDTO[],
): readonly IAstClassDTO[] {
    return sortNamedDeclarations(declarations)
}

/**
 * Sorts interface declarations by location and name.
 *
 * @param declarations Parsed interface declarations.
 * @returns Sorted interface declarations.
 */
function sortInterfaceDeclarations(
    declarations: readonly IAstInterfaceDTO[],
): readonly IAstInterfaceDTO[] {
    return sortNamedDeclarations(declarations)
}

/**
 * Sorts function declarations by location and name.
 *
 * @param declarations Parsed function declarations.
 * @returns Sorted function declarations.
 */
function sortFunctionDeclarations(
    declarations: readonly IAstFunctionDTO[],
): readonly IAstFunctionDTO[] {
    return sortNamedDeclarations(declarations)
}

/**
 * Sorts named declarations by source location and name.
 *
 * @param declarations Parsed declarations.
 * @returns Deterministically sorted declarations.
 */
function sortNamedDeclarations<T extends {readonly name: string; readonly location: IAstSourceLocationDTO}>(
    declarations: readonly T[],
): readonly T[] {
    return [...declarations].sort((left, right) => {
        const locationOrder = compareSourceLocations(left.location, right.location)
        if (locationOrder !== 0) {
            return locationOrder
        }

        return left.name.localeCompare(right.name)
    })
}

/**
 * Compares source locations for deterministic ordering.
 *
 * @param left Left source location.
 * @param right Right source location.
 * @returns Stable comparison result.
 */
function compareSourceLocations(
    left: IAstSourceLocationDTO,
    right: IAstSourceLocationDTO,
): number {
    if (left.lineStart !== right.lineStart) {
        return left.lineStart - right.lineStart
    }

    if (left.columnStart !== right.columnStart) {
        return left.columnStart - right.columnStart
    }

    if (left.lineEnd !== right.lineEnd) {
        return left.lineEnd - right.lineEnd
    }

    return left.columnEnd - right.columnEnd
}

/**
 * Sorts graph edges by source id, relation type, and target id.
 *
 * @param left Left graph edge.
 * @param right Right graph edge.
 * @returns Stable comparison result.
 */
function sortGraphEdges(left: ICodeGraphEdge, right: ICodeGraphEdge): number {
    if (left.source !== right.source) {
        return left.source.localeCompare(right.source)
    }

    if (left.type !== right.type) {
        return left.type.localeCompare(right.type)
    }

    return left.target.localeCompare(right.target)
}

/**
 * Sorts graph nodes by stable identifier.
 *
 * @param left Left graph node.
 * @param right Right graph node.
 * @returns Stable comparison result.
 */
function sortGraphNodesById(left: ICodeGraphNode, right: ICodeGraphNode): number {
    return left.id.localeCompare(right.id)
}

/**
 * Sorts containing function nodes by the narrowest enclosing range first.
 *
 * @param left Left function node.
 * @param right Right function node.
 * @returns Stable comparison result.
 */
function sortFunctionNodesForContainment(
    left: ICodeGraphNode,
    right: ICodeGraphNode,
): number {
    const leftSpan = (readMetadataNumber(left, "lineEnd") ?? 0) - (readMetadataNumber(left, "lineStart") ?? 0)
    const rightSpan =
        (readMetadataNumber(right, "lineEnd") ?? 0) - (readMetadataNumber(right, "lineStart") ?? 0)

    if (leftSpan !== rightSpan) {
        return leftSpan - rightSpan
    }

    return left.id.localeCompare(right.id)
}

/**
 * Checks whether one graph node contains a source location.
 *
 * @param node Candidate graph node.
 * @param location Source location.
 * @returns True when location falls inside node line range.
 */
function doesNodeContainLocation(
    node: ICodeGraphNode,
    location: IAstSourceLocationDTO,
): boolean {
    const lineStart = readMetadataNumber(node, "lineStart")
    const lineEnd = readMetadataNumber(node, "lineEnd")

    if (lineStart === undefined || lineEnd === undefined) {
        return false
    }

    return location.lineStart >= lineStart && location.lineEnd <= lineEnd
}

/**
 * Normalizes relative import path against source file directory.
 *
 * @param sourceFilePath Source repository-relative file path.
 * @param importPath Relative import path text.
 * @returns Normalized repository-relative candidate path.
 */
function normalizeRelativeImportPath(sourceFilePath: string, importPath: string): string {
    const sourceDirectory = FilePath.create(sourceFilePath).directory()
    const combinedPath =
        sourceDirectory.length > 0 ? `${sourceDirectory}/${importPath}` : importPath

    const segments = combinedPath.split("/")
    const normalizedSegments: string[] = []

    for (const segment of segments) {
        if (segment.length === 0 || segment === ".") {
            continue
        }

        if (segment === "..") {
            normalizedSegments.pop()
            continue
        }

        normalizedSegments.push(segment)
    }

    return normalizedSegments.join("/")
}

/**
 * Checks whether import source is repository-relative.
 *
 * @param source Raw import source.
 * @returns True when source starts with `.`.
 */
function isRelativeImport(source: string): boolean {
    return source.startsWith(".")
}

/**
 * Checks whether import source already includes explicit file extension.
 *
 * @param source Raw import source.
 * @returns True when source includes terminal extension.
 */
function hasExplicitExtension(source: string): boolean {
    return /\.[a-z0-9]+$/iu.test(source)
}

/**
 * Normalizes type references by dropping generics and array suffixes.
 *
 * @param reference Raw type reference text.
 * @returns Normalized lookup key.
 */
function normalizeTypeReferenceName(reference: string): string {
    return reference
        .trim()
        .replace(/<.*$/u, "")
        .replace(/\[\]$/u, "")
        .trim()
}

/**
 * Checks whether graph node is type-level declaration node.
 *
 * @param node Candidate graph node.
 * @returns True when node is a non-class type node.
 */
function isTypeNode(node: ICodeGraphNode): boolean {
    return node.type === CODE_GRAPH_NODE_TYPE.TYPE
}

/**
 * Checks whether graph node represents an interface declaration.
 *
 * @param node Candidate graph node.
 * @returns True when node represents an interface.
 */
function isInterfaceNode(node: ICodeGraphNode): boolean {
    return isTypeNode(node) && readMetadataString(node, "category") === FILE_NODE_CATEGORY_INTERFACE
}

/**
 * Reads string metadata field when available.
 *
 * @param node Graph node.
 * @param field Metadata field name.
 * @returns String metadata value or undefined.
 */
function readMetadataString(node: ICodeGraphNode, field: string): string | undefined {
    const raw = node.metadata?.[field]
    if (typeof raw !== "string" || raw.length === 0) {
        return undefined
    }

    return raw
}

/**
 * Reads numeric metadata field when available.
 *
 * @param node Graph node.
 * @param field Metadata field name.
 * @returns Numeric metadata value or undefined.
 */
function readMetadataNumber(node: ICodeGraphNode, field: string): number | undefined {
    const raw = node.metadata?.[field]
    if (typeof raw !== "number" || Number.isFinite(raw) === false) {
        return undefined
    }

    return raw
}
