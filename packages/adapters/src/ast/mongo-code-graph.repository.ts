import type {
    CodeGraph,
    CodeNode,
    CodeGraphNodeType,
    CodeGraphNodeMetadataValue,
    ICodeGraphEdge,
    ICodeGraphNode,
    IGraphQueryFilter,
    IGraphRepository,
} from "@codenautic/core"

import {
    AST_CODE_GRAPH_REPOSITORY_ERROR_CODE,
    AstCodeGraphRepositoryError,
} from "./mongo-code-graph-repository.error"

/**
 * MongoDB snapshot document for one repository + branch code graph.
 */
export interface IMongoCodeGraphDocument {
    /**
     * Stable repository + branch scope key.
     */
    readonly scopeKey: string

    /**
     * Repository identifier in `<platform>:<id>` format.
     */
    readonly repositoryId: string

    /**
     * Optional branch reference for this snapshot.
     */
    readonly branch?: string

    /**
     * Optional graph identifier propagated from the core payload.
     */
    readonly graphId?: string

    /**
     * Optional graph generation timestamp.
     */
    readonly generatedAt?: Date

    /**
     * Persisted graph nodes.
     */
    readonly nodes: readonly ICodeGraphNode[]

    /**
     * Persisted graph edges.
     */
    readonly edges: readonly ICodeGraphEdge[]
}

/**
 * Minimal Mongo-like collection contract used by the graph repository.
 */
export interface IMongoCodeGraphCollection<TDocument> {
    /**
     * Finds one document by filter.
     *
     * @param filter Mongo-like filter object.
     * @returns Matching document or null.
     */
    findOne(filter: Readonly<Record<string, unknown>>): Promise<TDocument | null>

    /**
     * Finds many documents by filter.
     *
     * @param filter Mongo-like filter object.
     * @returns Matching documents.
     */
    find(filter: Readonly<Record<string, unknown>>): Promise<readonly TDocument[]>

    /**
     * Replaces one document by filter, optionally upserting it.
     *
     * @param filter Mongo-like filter object.
     * @param replacement Replacement document.
     * @param options Replace options.
     * @returns Nothing.
     */
    replaceOne(
        filter: Readonly<Record<string, unknown>>,
        replacement: TDocument,
        options: Readonly<{upsert: boolean}>,
    ): Promise<void>
}

/**
 * Constructor options for Mongo code graph repository.
 */
export interface IMongoCodeGraphRepositoryOptions {
    /**
     * Mongo-like collection storing full graph snapshots.
     */
    readonly graphs: IMongoCodeGraphCollection<IMongoCodeGraphDocument>
}

/**
 * Mongo-backed snapshot repository for persisted code graphs.
 */
export class MongoCodeGraphRepository implements IGraphRepository {
    private readonly graphs: IMongoCodeGraphCollection<IMongoCodeGraphDocument>

    /**
     * Creates Mongo code graph repository.
     *
     * @param options Repository dependencies.
     */
    public constructor(options: IMongoCodeGraphRepositoryOptions) {
        this.graphs = options.graphs
    }

    /**
     * Loads graph snapshot for repository and optional branch.
     *
     * @param repositoryId Repository identifier.
     * @param branch Optional branch reference.
     * @returns Persisted graph snapshot or null.
     */
    public async loadGraph(
        repositoryId: string,
        branch?: string,
    ): Promise<CodeGraph | null> {
        const normalizedRepositoryId = normalizeRepositoryId(repositoryId)
        const normalizedBranch = normalizeOptionalBranch(branch)
        const document = await this.graphs.findOne({
            scopeKey: createGraphScopeKey(normalizedRepositoryId, normalizedBranch),
        })

        return document === null ? null : mapMongoDocumentToGraph(document)
    }

    /**
     * Persists full graph snapshot for repository and optional branch.
     *
     * @param repositoryId Repository identifier.
     * @param graph Graph snapshot to persist.
     * @param branch Optional branch reference.
     * @returns Nothing.
     */
    public async saveGraph(
        repositoryId: string,
        graph: CodeGraph,
        branch?: string,
    ): Promise<void> {
        const normalizedRepositoryId = normalizeRepositoryId(repositoryId)
        const normalizedBranch = normalizeOptionalBranch(branch)
        validateCodeGraphSnapshot(graph)
        const document = mapGraphToMongoDocument(
            normalizedRepositoryId,
            normalizedBranch,
            graph,
        )

        await this.graphs.replaceOne(
            {
                scopeKey: document.scopeKey,
            },
            document,
            {
                upsert: true,
            },
        )
    }

    /**
     * Queries persisted nodes across stored graph snapshots.
     *
     * @param filter Optional node filters.
     * @returns Matching nodes in deterministic order.
     */
    public async queryNodes(filter: IGraphQueryFilter): Promise<readonly CodeNode[]> {
        const normalizedFilter = normalizeGraphQueryFilter(filter)
        const documents = await this.graphs.find({})
        const nodes = documents.flatMap((document): readonly ICodeGraphNode[] => {
            return document.nodes
        })

        return nodes
            .filter((node): boolean => {
                return matchesGraphQueryFilter(node, normalizedFilter)
            })
            .map(cloneCodeGraphNode)
            .sort(compareCodeGraphNode)
    }
}

/**
 * Validates graph snapshot before persistence.
 *
 * @param graph Graph snapshot to validate.
 * @returns Nothing.
 */
function validateCodeGraphSnapshot(graph: CodeGraph): void {
    const nodeIds = collectValidatedNodeIds(graph.nodes)

    for (const edge of graph.edges) {
        validateCodeGraphEdge(edge, nodeIds)
    }
}

/**
 * Validates graph nodes and collects unique ids.
 *
 * @param nodes Graph nodes.
 * @returns Unique node id set.
 */
function collectValidatedNodeIds(nodes: readonly ICodeGraphNode[]): ReadonlySet<string> {
    const nodeIds = new Set<string>()

    for (const node of nodes) {
        validateCodeGraphNode(node)

        if (nodeIds.has(node.id)) {
            throw new AstCodeGraphRepositoryError(
                AST_CODE_GRAPH_REPOSITORY_ERROR_CODE.DUPLICATE_NODE_ID,
                {
                    nodeId: node.id,
                },
            )
        }

        nodeIds.add(node.id)
    }

    return nodeIds
}

/**
 * Validates one graph node.
 *
 * @param node Graph node candidate.
 * @returns Nothing.
 */
function validateCodeGraphNode(node: ICodeGraphNode): void {
    try {
        normalizeRequiredText(node.id, "nodeId")
        normalizeRequiredText(node.type, "nodeType")
        normalizeRequiredText(node.name, "nodeName")
        normalizeRequiredText(node.filePath, "filePath")
    } catch (error) {
        throw new AstCodeGraphRepositoryError(
            AST_CODE_GRAPH_REPOSITORY_ERROR_CODE.INVALID_GRAPH_NODE,
            {
                nodeId: node.id,
                filePath: node.filePath,
                causeMessage: error instanceof Error ? error.message : String(error),
            },
        )
    }
}

/**
 * Validates one graph edge and its referential integrity.
 *
 * @param edge Graph edge candidate.
 * @param nodeIds Known graph node ids.
 * @returns Nothing.
 */
function validateCodeGraphEdge(
    edge: ICodeGraphEdge,
    nodeIds: ReadonlySet<string>,
): void {
    const sourceNodeId = normalizeRequiredText(edge.source, "sourceNodeId")
    const targetNodeId = normalizeRequiredText(edge.target, "targetNodeId")

    try {
        normalizeRequiredText(edge.type, "edgeType")
    } catch (error) {
        throw new AstCodeGraphRepositoryError(
            AST_CODE_GRAPH_REPOSITORY_ERROR_CODE.INVALID_GRAPH_EDGE,
            {
                sourceNodeId,
                targetNodeId,
                causeMessage: error instanceof Error ? error.message : String(error),
            },
        )
    }

    if (nodeIds.has(sourceNodeId) && nodeIds.has(targetNodeId)) {
        return
    }

    throw new AstCodeGraphRepositoryError(
        AST_CODE_GRAPH_REPOSITORY_ERROR_CODE.EDGE_REFERENTIAL_INTEGRITY_VIOLATION,
        {
            sourceNodeId,
            targetNodeId,
        },
    )
}

/**
 * Maps persisted Mongo snapshot document back to core graph payload.
 *
 * @param document Mongo snapshot document.
 * @returns Core graph payload.
 */
function mapMongoDocumentToGraph(document: IMongoCodeGraphDocument): CodeGraph {
    return {
        id: document.graphId,
        generatedAt: document.generatedAt === undefined
            ? undefined
            : new Date(document.generatedAt.getTime()),
        nodes: document.nodes.map(cloneCodeGraphNode),
        edges: document.edges.map(cloneCodeGraphEdge),
    }
}

/**
 * Maps core graph payload to persisted Mongo snapshot document.
 *
 * @param repositoryId Normalized repository identifier.
 * @param branch Normalized optional branch reference.
 * @param graph Core graph payload.
 * @returns Mongo snapshot document.
 */
function mapGraphToMongoDocument(
    repositoryId: string,
    branch: string | undefined,
    graph: CodeGraph,
): IMongoCodeGraphDocument {
    return {
        scopeKey: createGraphScopeKey(repositoryId, branch),
        repositoryId,
        branch,
        graphId: graph.id,
        generatedAt: graph.generatedAt === undefined
            ? undefined
            : new Date(graph.generatedAt.getTime()),
        nodes: graph.nodes.map(cloneCodeGraphNode),
        edges: graph.edges.map(cloneCodeGraphEdge),
    }
}

/**
 * Clones one code graph node to keep repository boundaries immutable.
 *
 * @param node Graph node.
 * @returns Cloned graph node.
 */
function cloneCodeGraphNode(node: ICodeGraphNode): ICodeGraphNode {
    return {
        id: node.id,
        type: node.type,
        name: node.name,
        filePath: node.filePath,
        metadata: cloneCodeGraphNodeMetadata(node.metadata),
    }
}

/**
 * Clones optional node metadata object.
 *
 * @param metadata Optional node metadata.
 * @returns Cloned metadata object or undefined.
 */
function cloneCodeGraphNodeMetadata(
    metadata: Record<string, CodeGraphNodeMetadataValue> | undefined,
): Record<string, CodeGraphNodeMetadataValue> | undefined {
    if (metadata === undefined) {
        return undefined
    }

    return Object.fromEntries(Object.entries(metadata))
}

/**
 * Clones one code graph edge.
 *
 * @param edge Graph edge.
 * @returns Cloned graph edge.
 */
function cloneCodeGraphEdge(edge: ICodeGraphEdge): ICodeGraphEdge {
    return {
        source: edge.source,
        target: edge.target,
        type: edge.type,
    }
}

/**
 * Checks whether node matches query filter.
 *
 * @param node Graph node candidate.
 * @param filter Normalized query filter.
 * @returns True when node matches filter.
 */
function matchesGraphQueryFilter(
    node: ICodeGraphNode,
    filter: Readonly<{type?: CodeGraphNodeType; filePath?: string}>,
): boolean {
    if (filter.type !== undefined && node.type !== filter.type) {
        return false
    }

    if (filter.filePath !== undefined && node.filePath !== filter.filePath) {
        return false
    }

    return true
}

/**
 * Orders graph nodes deterministically for stable queries.
 *
 * @param left Left graph node.
 * @param right Right graph node.
 * @returns Sort comparison result.
 */
function compareCodeGraphNode(left: ICodeGraphNode, right: ICodeGraphNode): number {
    if (left.filePath !== right.filePath) {
        return left.filePath.localeCompare(right.filePath)
    }

    if (left.type !== right.type) {
        return left.type.localeCompare(right.type)
    }

    return left.id.localeCompare(right.id)
}

/**
 * Normalizes graph query filter.
 *
 * @param filter Raw query filter.
 * @returns Normalized query filter.
 */
function normalizeGraphQueryFilter(
    filter: IGraphQueryFilter,
): Readonly<{type?: CodeGraphNodeType; filePath?: string}> {
    if (filter.filePath === undefined) {
        return {
            type: filter.type,
        }
    }

    return {
        type: filter.type,
        filePath: normalizeFilePath(filter.filePath),
    }
}

/**
 * Normalizes repository identifier.
 *
 * @param repositoryId Raw repository identifier.
 * @returns Trimmed repository identifier.
 */
function normalizeRepositoryId(repositoryId: string): string {
    try {
        return normalizeRequiredText(repositoryId, "repositoryId")
    } catch (error) {
        throw new AstCodeGraphRepositoryError(
            AST_CODE_GRAPH_REPOSITORY_ERROR_CODE.INVALID_REPOSITORY_ID,
            {
                repositoryId,
                causeMessage: error instanceof Error ? error.message : String(error),
            },
        )
    }
}

/**
 * Normalizes optional branch reference.
 *
 * @param branch Optional branch reference.
 * @returns Normalized branch or undefined.
 */
function normalizeOptionalBranch(branch: string | undefined): string | undefined {
    if (branch === undefined) {
        return undefined
    }

    try {
        return normalizeRequiredText(branch, "branch")
    } catch (error) {
        throw new AstCodeGraphRepositoryError(
            AST_CODE_GRAPH_REPOSITORY_ERROR_CODE.INVALID_BRANCH,
            {
                branch,
                causeMessage: error instanceof Error ? error.message : String(error),
            },
        )
    }
}

/**
 * Normalizes repository-relative file path.
 *
 * @param filePath Raw file path.
 * @returns Normalized file path.
 */
function normalizeFilePath(filePath: string): string {
    try {
        return normalizeRequiredText(filePath, "filePath")
    } catch (error) {
        throw new AstCodeGraphRepositoryError(
            AST_CODE_GRAPH_REPOSITORY_ERROR_CODE.INVALID_FILE_PATH,
            {
                filePath,
                causeMessage: error instanceof Error ? error.message : String(error),
            },
        )
    }
}

/**
 * Creates stable repository + branch scope key.
 *
 * @param repositoryId Normalized repository identifier.
 * @param branch Normalized optional branch reference.
 * @returns Stable scope key.
 */
function createGraphScopeKey(
    repositoryId: string,
    branch: string | undefined,
): string {
    return `${repositoryId}@${branch ?? "<default>"}`
}

/**
 * Normalizes required text fields.
 *
 * @param value Raw string value.
 * @param fieldName Field label.
 * @returns Trimmed non-empty string.
 */
function normalizeRequiredText(value: string, fieldName: string): string {
    const normalizedValue = value.trim()

    if (normalizedValue.length === 0) {
        throw new Error(`${fieldName} cannot be empty`)
    }

    return normalizedValue
}
