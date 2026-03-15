import {
    AST_SERVICE_MULTI_REPO_GRAPH_FEDERATION_ERROR_CODE,
    AstServiceMultiRepoGraphFederationError,
    type AstServiceMultiRepoGraphFederationErrorCode,
} from "./ast-service-multi-repo-graph-federation.error"
import {
    AstServiceResultCachingService,
    type IAstServiceResultCachingService,
} from "./ast-service-result-caching.service"
import type {IAstGetCodeGraphResult} from "./ast-service-client-library.service"

const DEFAULT_MAX_REPOSITORIES = 24
const DEFAULT_CROSS_REPOSITORY_EDGE_THRESHOLD = 1
const DEFAULT_MIN_SHARED_NODE_NAME_LENGTH = 3
const DEFAULT_RETRY_MAX_ATTEMPTS = 3
const DEFAULT_RETRY_INITIAL_BACKOFF_MS = 40
const DEFAULT_RETRY_MAX_BACKOFF_MS = 400
const DEFAULT_IDEMPOTENCY_CACHE_SIZE = 400

/**
 * Sleep callback used by multi-repo federation retry/backoff handling.
 */
export type AstServiceMultiRepoGraphFederationSleep = (durationMs: number) => Promise<void>

/**
 * Clock callback used by multi-repo federation service.
 */
export type AstServiceMultiRepoGraphFederationNow = () => number

/**
 * Retry classifier callback for repository fetch failures.
 */
export type AstServiceMultiRepoGraphFederationShouldRetry = (
    error: unknown,
    attempt: number,
) => boolean

/**
 * Retry policy input for repository graph fetches.
 */
export interface IAstServiceMultiRepoGraphFederationRetryPolicyInput {
    /**
     * Maximum attempts including first execution.
     */
    readonly maxAttempts?: number

    /**
     * Initial exponential backoff in milliseconds.
     */
    readonly initialBackoffMs?: number

    /**
     * Maximum capped backoff in milliseconds.
     */
    readonly maxBackoffMs?: number
}

/**
 * One repository input for multi-repo federation.
 */
export interface IAstServiceMultiRepoGraphFederationRepositoryInput {
    /**
     * Repository identifier.
     */
    readonly repositoryId: string

    /**
     * Optional branch name for graph snapshot.
     */
    readonly branch?: string
}

/**
 * Input payload for multi-repo graph federation.
 */
export interface IAstServiceMultiRepoGraphFederationInput {
    /**
     * Repository scopes to federate.
     */
    readonly repositories: readonly IAstServiceMultiRepoGraphFederationRepositoryInput[]

    /**
     * Enables cross-repository edge inference.
     */
    readonly includeCrossRepositoryEdges?: boolean

    /**
     * Minimum shared symbol count to create cross-repository edge.
     */
    readonly crossRepositoryEdgeThreshold?: number

    /**
     * Minimum shared symbol length used for cross-repository matching.
     */
    readonly minSharedNodeNameLength?: number

    /**
     * Forces refresh when fetching source repository graphs.
     */
    readonly forceRefresh?: boolean

    /**
     * Optional TTL override for source graph cache reads.
     */
    readonly cacheTtlMs?: number

    /**
     * Optional idempotency key for federation-level deduplication.
     */
    readonly idempotencyKey?: string

    /**
     * Optional retry policy override for repository graph fetches.
     */
    readonly retryPolicy?: IAstServiceMultiRepoGraphFederationRetryPolicyInput
}

/**
 * One federated node payload.
 */
export interface IAstFederatedCodeGraphNode {
    /**
     * Stable federated node id.
     */
    readonly id: string

    /**
     * Repository id owning node.
     */
    readonly repositoryId: string

    /**
     * Original source node id.
     */
    readonly sourceNodeId: string

    /**
     * Source node type.
     */
    readonly type: string

    /**
     * Source node name.
     */
    readonly name: string

    /**
     * Source file path.
     */
    readonly filePath: string
}

/**
 * One federated edge payload.
 */
export interface IAstFederatedCodeGraphEdge {
    /**
     * Source federated node id.
     */
    readonly source: string

    /**
     * Target federated node id.
     */
    readonly target: string

    /**
     * Edge type.
     */
    readonly type: string

    /**
     * Repository id for intra-repository edge.
     */
    readonly repositoryId?: string

    /**
     * Indicates whether edge links different repositories.
     */
    readonly crossRepository: boolean

    /**
     * Edge strength score.
     */
    readonly strength: number

    /**
     * Shared symbol count for cross-repository edges.
     */
    readonly sharedSymbolCount: number
}

/**
 * Repository-level federation summary.
 */
export interface IAstFederatedRepositorySummary {
    /**
     * Repository identifier.
     */
    readonly repositoryId: string

    /**
     * Branch name used for source graph fetch.
     */
    readonly branch?: string

    /**
     * Source graph node count.
     */
    readonly sourceNodeCount: number

    /**
     * Source graph edge count.
     */
    readonly sourceEdgeCount: number

    /**
     * Attempts used to fetch source graph.
     */
    readonly attempts: number

    /**
     * Whether source graph came from result cache.
     */
    readonly fromResultCache: boolean
}

/**
 * Aggregated federation summary.
 */
export interface IAstMultiRepoGraphFederationSummary {
    /**
     * Federation idempotency key.
     */
    readonly federationKey: string

    /**
     * Number of repositories in federation.
     */
    readonly repositoryCount: number

    /**
     * Total federated nodes count.
     */
    readonly totalNodes: number

    /**
     * Total federated edges count.
     */
    readonly totalEdges: number

    /**
     * Cross-repository edge count.
     */
    readonly crossRepositoryEdges: number

    /**
     * Attempts used to fetch source graphs.
     */
    readonly attempts: number

    /**
     * Whether federation result came from idempotency cache.
     */
    readonly fromIdempotencyCache: boolean

    /**
     * Federation timestamp.
     */
    readonly federatedAtUnixMs: number
}

/**
 * Multi-repo graph federation output payload.
 */
export interface IAstMultiRepoGraphFederationResult {
    /**
     * Federated nodes.
     */
    readonly nodes: readonly IAstFederatedCodeGraphNode[]

    /**
     * Federated edges.
     */
    readonly edges: readonly IAstFederatedCodeGraphEdge[]

    /**
     * Repository-level summaries.
     */
    readonly repositories: readonly IAstFederatedRepositorySummary[]

    /**
     * Aggregated federation summary.
     */
    readonly summary: IAstMultiRepoGraphFederationSummary
}

/**
 * Runtime options for multi-repo graph federation service.
 */
export interface IAstServiceMultiRepoGraphFederationServiceOptions {
    /**
     * Optional source graph caching dependency.
     */
    readonly resultCachingService?: IAstServiceResultCachingService

    /**
     * Optional max repositories bound.
     */
    readonly maxRepositories?: number

    /**
     * Optional default retry policy.
     */
    readonly defaultRetryPolicy?: IAstServiceMultiRepoGraphFederationRetryPolicyInput

    /**
     * Optional federation idempotency cache size.
     */
    readonly idempotencyCacheSize?: number

    /**
     * Optional retry/backoff sleep callback.
     */
    readonly sleep?: AstServiceMultiRepoGraphFederationSleep

    /**
     * Optional clock callback.
     */
    readonly now?: AstServiceMultiRepoGraphFederationNow

    /**
     * Optional retry classifier callback.
     */
    readonly shouldRetry?: AstServiceMultiRepoGraphFederationShouldRetry
}

/**
 * Multi-repo graph federation contract.
 */
export interface IAstServiceMultiRepoGraphFederationService {
    /**
     * Federates repository code graphs into one deterministic graph.
     *
     * @param input Federation input payload.
     * @returns Federated graph result.
     */
    federate(input: IAstServiceMultiRepoGraphFederationInput): Promise<IAstMultiRepoGraphFederationResult>
}

interface IResolvedRetryPolicy {
    readonly maxAttempts: number
    readonly initialBackoffMs: number
    readonly maxBackoffMs: number
}

interface IResolvedRepositoryInput {
    readonly repositoryId: string
    readonly branch?: string
}

interface IResolvedFederationInput {
    readonly repositories: readonly IResolvedRepositoryInput[]
    readonly includeCrossRepositoryEdges: boolean
    readonly crossRepositoryEdgeThreshold: number
    readonly minSharedNodeNameLength: number
    readonly forceRefresh: boolean
    readonly cacheTtlMs?: number
    readonly idempotencyKey: string
    readonly retryPolicy: IResolvedRetryPolicy
}

interface IRepositoryGraphFetch {
    readonly repository: IResolvedRepositoryInput
    readonly graph: IAstGetCodeGraphResult
    readonly attempts: number
    readonly fromResultCache: boolean
}

/**
 * AST multi-repo graph federation service.
 */
export class AstServiceMultiRepoGraphFederationService
    implements IAstServiceMultiRepoGraphFederationService
{
    private readonly resultCachingService: IAstServiceResultCachingService
    private readonly maxRepositories: number
    private readonly defaultRetryPolicy?: IAstServiceMultiRepoGraphFederationRetryPolicyInput
    private readonly idempotencyCacheSize: number
    private readonly sleep: AstServiceMultiRepoGraphFederationSleep
    private readonly now: AstServiceMultiRepoGraphFederationNow
    private readonly shouldRetry: AstServiceMultiRepoGraphFederationShouldRetry
    private readonly idempotencyCache = new Map<string, IAstMultiRepoGraphFederationResult>()
    private readonly inFlightByIdempotencyKey = new Map<string, Promise<IAstMultiRepoGraphFederationResult>>()

    /**
     * Creates AST multi-repo graph federation service.
     *
     * @param options Optional runtime overrides.
     */
    public constructor(options: IAstServiceMultiRepoGraphFederationServiceOptions = {}) {
        this.resultCachingService = options.resultCachingService ?? new AstServiceResultCachingService()
        this.maxRepositories = validatePositiveInteger(
            options.maxRepositories ?? DEFAULT_MAX_REPOSITORIES,
            AST_SERVICE_MULTI_REPO_GRAPH_FEDERATION_ERROR_CODE.INVALID_MAX_REPOSITORIES,
        )
        this.defaultRetryPolicy = options.defaultRetryPolicy
        this.idempotencyCacheSize = validatePositiveInteger(
            options.idempotencyCacheSize ?? DEFAULT_IDEMPOTENCY_CACHE_SIZE,
            AST_SERVICE_MULTI_REPO_GRAPH_FEDERATION_ERROR_CODE.INVALID_IDEMPOTENCY_CACHE_SIZE,
        )
        this.sleep = options.sleep ?? sleepFor
        this.now = options.now ?? Date.now
        this.shouldRetry = options.shouldRetry ?? defaultShouldRetry
    }

    /**
     * Federates repository code graphs into one deterministic graph.
     *
     * @param input Federation input payload.
     * @returns Federated graph result.
     */
    public async federate(
        input: IAstServiceMultiRepoGraphFederationInput,
    ): Promise<IAstMultiRepoGraphFederationResult> {
        const resolvedInput = resolveFederationInput(input, this.maxRepositories, this.defaultRetryPolicy)
        const cached = this.resolveCachedFederationResult(resolvedInput.idempotencyKey)
        if (cached !== undefined) {
            return cached
        }

        const inFlight = this.inFlightByIdempotencyKey.get(resolvedInput.idempotencyKey)
        if (inFlight !== undefined) {
            return inFlight
        }

        const promise = this.executeFederation(resolvedInput)
        this.inFlightByIdempotencyKey.set(resolvedInput.idempotencyKey, promise)

        try {
            const result = await promise
            this.persistFederationResult(resolvedInput.idempotencyKey, result)
            return result
        } finally {
            this.inFlightByIdempotencyKey.delete(resolvedInput.idempotencyKey)
        }
    }

    /**
     * Executes federation flow for resolved input.
     *
     * @param input Resolved federation input.
     * @returns Federated graph result.
     */
    private async executeFederation(
        input: IResolvedFederationInput,
    ): Promise<IAstMultiRepoGraphFederationResult> {
        const repositoryFetches = await this.fetchRepositoryGraphs(input)
        const nodes = createFederatedNodes(repositoryFetches)
        const intraRepositoryEdges = createIntraRepositoryEdges(repositoryFetches)
        const crossRepositoryEdges = input.includeCrossRepositoryEdges
            ? createCrossRepositoryEdges(
                  nodes,
                  input.crossRepositoryEdgeThreshold,
                  input.minSharedNodeNameLength,
              )
            : []
        const edges = [...intraRepositoryEdges, ...crossRepositoryEdges].sort(compareFederatedEdges)
        const attempts = repositoryFetches.reduce((sum, item) => sum + item.attempts, 0)

        return {
            nodes,
            edges,
            repositories: createRepositorySummaries(repositoryFetches),
            summary: {
                federationKey: input.idempotencyKey,
                repositoryCount: input.repositories.length,
                totalNodes: nodes.length,
                totalEdges: edges.length,
                crossRepositoryEdges: crossRepositoryEdges.length,
                attempts,
                fromIdempotencyCache: false,
                federatedAtUnixMs: this.now(),
            },
        }
    }

    /**
     * Fetches repository graphs with retry/backoff handling.
     *
     * @param input Resolved federation input.
     * @returns Repository graph fetch payloads.
     */
    private async fetchRepositoryGraphs(
        input: IResolvedFederationInput,
    ): Promise<readonly IRepositoryGraphFetch[]> {
        const results: IRepositoryGraphFetch[] = []

        for (const repository of input.repositories) {
            results.push(await this.fetchRepositoryGraphWithRetry(repository, input))
        }

        return results
    }

    /**
     * Fetches one repository graph with retry/backoff handling.
     *
     * @param repository Repository input.
     * @param input Resolved federation input.
     * @returns Repository graph fetch payload.
     */
    private async fetchRepositoryGraphWithRetry(
        repository: IResolvedRepositoryInput,
        input: IResolvedFederationInput,
    ): Promise<IRepositoryGraphFetch> {
        let attempt = 0
        let lastError: unknown

        while (attempt < input.retryPolicy.maxAttempts) {
            attempt += 1

            try {
                const graphResult = await this.resultCachingService.getCodeGraph({
                    repositoryId: repository.repositoryId,
                    ...(repository.branch !== undefined ? {branch: repository.branch} : {}),
                    forceRefresh: input.forceRefresh,
                    ...(input.cacheTtlMs !== undefined ? {cacheTtlMs: input.cacheTtlMs} : {}),
                    idempotencyKey: `${input.idempotencyKey}:${repository.repositoryId}`,
                })

                return {
                    repository,
                    graph: graphResult.value,
                    attempts: attempt,
                    fromResultCache: graphResult.fromCache,
                }
            } catch (error) {
                lastError = error
                const canRetry = attempt < input.retryPolicy.maxAttempts && this.shouldRetry(error, attempt)
                if (canRetry) {
                    await this.sleep(resolveBackoffMs(attempt, input.retryPolicy))
                    continue
                }

                if (attempt >= input.retryPolicy.maxAttempts) {
                    throw new AstServiceMultiRepoGraphFederationError(
                        AST_SERVICE_MULTI_REPO_GRAPH_FEDERATION_ERROR_CODE.RETRY_EXHAUSTED,
                        {
                            repositoryId: repository.repositoryId,
                            attempts: attempt,
                            causeMessage: resolveUnknownErrorMessage(error),
                        },
                    )
                }

                throw new AstServiceMultiRepoGraphFederationError(
                    AST_SERVICE_MULTI_REPO_GRAPH_FEDERATION_ERROR_CODE.REPOSITORY_FETCH_FAILED,
                    {
                        repositoryId: repository.repositoryId,
                        causeMessage: resolveUnknownErrorMessage(error),
                    },
                )
            }
        }

        throw new AstServiceMultiRepoGraphFederationError(
            AST_SERVICE_MULTI_REPO_GRAPH_FEDERATION_ERROR_CODE.RETRY_EXHAUSTED,
            {
                repositoryId: repository.repositoryId,
                attempts: input.retryPolicy.maxAttempts,
                causeMessage: resolveUnknownErrorMessage(lastError),
            },
        )
    }

    /**
     * Resolves cached federation result by idempotency key.
     *
     * @param idempotencyKey Federation idempotency key.
     * @returns Cached federation result when available.
     */
    private resolveCachedFederationResult(
        idempotencyKey: string,
    ): IAstMultiRepoGraphFederationResult | undefined {
        const cached = this.idempotencyCache.get(idempotencyKey)
        if (cached === undefined) {
            return undefined
        }

        return {
            ...cached,
            summary: {
                ...cached.summary,
                attempts: 0,
                fromIdempotencyCache: true,
                federatedAtUnixMs: this.now(),
            },
        }
    }

    /**
     * Persists federation result in bounded idempotency cache.
     *
     * @param idempotencyKey Federation idempotency key.
     * @param result Federation result.
     */
    private persistFederationResult(
        idempotencyKey: string,
        result: IAstMultiRepoGraphFederationResult,
    ): void {
        if (this.idempotencyCache.size >= this.idempotencyCacheSize && this.idempotencyCache.has(idempotencyKey) === false) {
            const firstKey = this.idempotencyCache.keys().next().value
            if (firstKey !== undefined) {
                this.idempotencyCache.delete(firstKey)
            }
        }

        this.idempotencyCache.set(idempotencyKey, result)
    }
}

/**
 * Resolves and validates federation input.
 *
 * @param input Raw federation input.
 * @param maxRepositories Max repositories bound.
 * @param defaultRetryPolicy Optional default retry policy.
 * @returns Resolved federation input.
 */
function resolveFederationInput(
    input: IAstServiceMultiRepoGraphFederationInput,
    maxRepositories: number,
    defaultRetryPolicy: IAstServiceMultiRepoGraphFederationRetryPolicyInput | undefined,
): IResolvedFederationInput {
    const repositories = resolveRepositories(input.repositories, maxRepositories)

    return {
        repositories,
        includeCrossRepositoryEdges: input.includeCrossRepositoryEdges ?? true,
        crossRepositoryEdgeThreshold: validatePositiveInteger(
            input.crossRepositoryEdgeThreshold ?? DEFAULT_CROSS_REPOSITORY_EDGE_THRESHOLD,
            AST_SERVICE_MULTI_REPO_GRAPH_FEDERATION_ERROR_CODE.INVALID_CROSS_REPOSITORY_EDGE_THRESHOLD,
        ),
        minSharedNodeNameLength: validatePositiveInteger(
            input.minSharedNodeNameLength ?? DEFAULT_MIN_SHARED_NODE_NAME_LENGTH,
            AST_SERVICE_MULTI_REPO_GRAPH_FEDERATION_ERROR_CODE.INVALID_MIN_SHARED_NODE_NAME_LENGTH,
        ),
        forceRefresh: input.forceRefresh === true,
        cacheTtlMs: input.cacheTtlMs,
        idempotencyKey: resolveIdempotencyKey(input, repositories),
        retryPolicy: resolveRetryPolicy(input.retryPolicy, defaultRetryPolicy),
    }
}

/**
 * Resolves and validates repository list.
 *
 * @param repositories Raw repository list.
 * @param maxRepositories Max repositories bound.
 * @returns Resolved repository list.
 */
function resolveRepositories(
    repositories: readonly IAstServiceMultiRepoGraphFederationRepositoryInput[],
    maxRepositories: number,
): readonly IResolvedRepositoryInput[] {
    if (repositories.length === 0) {
        throw new AstServiceMultiRepoGraphFederationError(
            AST_SERVICE_MULTI_REPO_GRAPH_FEDERATION_ERROR_CODE.EMPTY_REPOSITORIES,
        )
    }

    if (repositories.length > maxRepositories) {
        throw new AstServiceMultiRepoGraphFederationError(
            AST_SERVICE_MULTI_REPO_GRAPH_FEDERATION_ERROR_CODE.INVALID_MAX_REPOSITORIES,
            {
                value: repositories.length,
            },
        )
    }

    const seen = new Set<string>()
    const resolved = repositories.map((repository) => {
        const repositoryId = normalizeRepositoryId(repository.repositoryId)
        if (seen.has(repositoryId)) {
            throw new AstServiceMultiRepoGraphFederationError(
                AST_SERVICE_MULTI_REPO_GRAPH_FEDERATION_ERROR_CODE.DUPLICATE_REPOSITORY_ID,
                {
                    repositoryId,
                },
            )
        }

        seen.add(repositoryId)
        return {
            repositoryId,
            branch: normalizeBranch(repository.branch),
        }
    })

    return [...resolved].sort((left, right) => left.repositoryId.localeCompare(right.repositoryId))
}

/**
 * Resolves federation idempotency key.
 *
 * @param input Raw federation input.
 * @param repositories Resolved repositories.
 * @returns Federation idempotency key.
 */
function resolveIdempotencyKey(
    input: IAstServiceMultiRepoGraphFederationInput,
    repositories: readonly IResolvedRepositoryInput[],
): string {
    const normalizedKey = normalizeIdempotencyKey(input.idempotencyKey)
    if (normalizedKey !== undefined) {
        return normalizedKey
    }

    const repositoryKey = repositories
        .map((repository) => `${repository.repositoryId}@${repository.branch ?? "default"}`)
        .join("|")
    const edgeThreshold = input.crossRepositoryEdgeThreshold ?? DEFAULT_CROSS_REPOSITORY_EDGE_THRESHOLD
    const minNameLength = input.minSharedNodeNameLength ?? DEFAULT_MIN_SHARED_NODE_NAME_LENGTH
    const forceRefresh = input.forceRefresh === true ? "force" : "cached"

    return `federation:${repositoryKey}:threshold:${edgeThreshold}:nameLen:${minNameLength}:${forceRefresh}`
}

/**
 * Resolves and validates retry policy.
 *
 * @param retryPolicy Optional request-level retry policy.
 * @param defaultRetryPolicy Optional default retry policy.
 * @returns Resolved retry policy.
 */
function resolveRetryPolicy(
    retryPolicy: IAstServiceMultiRepoGraphFederationRetryPolicyInput | undefined,
    defaultRetryPolicy: IAstServiceMultiRepoGraphFederationRetryPolicyInput | undefined,
): IResolvedRetryPolicy {
    const source = retryPolicy ?? defaultRetryPolicy
    const maxAttempts = validatePositiveInteger(
        source?.maxAttempts ?? DEFAULT_RETRY_MAX_ATTEMPTS,
        AST_SERVICE_MULTI_REPO_GRAPH_FEDERATION_ERROR_CODE.INVALID_RETRY_MAX_ATTEMPTS,
    )
    const initialBackoffMs = validatePositiveInteger(
        source?.initialBackoffMs ?? DEFAULT_RETRY_INITIAL_BACKOFF_MS,
        AST_SERVICE_MULTI_REPO_GRAPH_FEDERATION_ERROR_CODE.INVALID_RETRY_INITIAL_BACKOFF_MS,
    )
    const maxBackoffMs = validatePositiveInteger(
        source?.maxBackoffMs ?? DEFAULT_RETRY_MAX_BACKOFF_MS,
        AST_SERVICE_MULTI_REPO_GRAPH_FEDERATION_ERROR_CODE.INVALID_MAX_BACKOFF_MS,
    )

    if (maxBackoffMs < initialBackoffMs) {
        throw new AstServiceMultiRepoGraphFederationError(
            AST_SERVICE_MULTI_REPO_GRAPH_FEDERATION_ERROR_CODE.INVALID_MAX_BACKOFF_MS,
            {
                value: maxBackoffMs,
            },
        )
    }

    return {
        maxAttempts,
        initialBackoffMs,
        maxBackoffMs,
    }
}

/**
 * Creates federated nodes from repository fetch payloads.
 *
 * @param fetches Repository graph fetch payloads.
 * @returns Sorted federated nodes.
 */
function createFederatedNodes(
    fetches: readonly IRepositoryGraphFetch[],
): readonly IAstFederatedCodeGraphNode[] {
    const nodes: IAstFederatedCodeGraphNode[] = []

    for (const fetch of fetches) {
        for (const node of fetch.graph.nodes) {
            nodes.push({
                id: createFederatedNodeId(fetch.repository.repositoryId, node.id),
                repositoryId: fetch.repository.repositoryId,
                sourceNodeId: node.id,
                type: node.type,
                name: node.name,
                filePath: node.filePath,
            })
        }
    }

    return nodes.sort(compareFederatedNodes)
}

/**
 * Creates mapped intra-repository federated edges.
 *
 * @param fetches Repository graph fetch payloads.
 * @returns Sorted intra-repository edges.
 */
function createIntraRepositoryEdges(
    fetches: readonly IRepositoryGraphFetch[],
): readonly IAstFederatedCodeGraphEdge[] {
    const edges: IAstFederatedCodeGraphEdge[] = []

    for (const fetch of fetches) {
        for (const edge of fetch.graph.edges) {
            edges.push({
                source: createFederatedNodeId(fetch.repository.repositoryId, edge.source),
                target: createFederatedNodeId(fetch.repository.repositoryId, edge.target),
                type: edge.type,
                repositoryId: fetch.repository.repositoryId,
                crossRepository: false,
                strength: 1,
                sharedSymbolCount: 0,
            })
        }
    }

    return edges.sort(compareFederatedEdges)
}

/**
 * Creates cross-repository edges based on shared node names.
 *
 * @param nodes Federated nodes.
 * @param edgeThreshold Minimum shared symbols threshold.
 * @param minSharedNodeNameLength Minimum symbol length for matching.
 * @returns Deterministic cross-repository edges.
 */
function createCrossRepositoryEdges(
    nodes: readonly IAstFederatedCodeGraphNode[],
    edgeThreshold: number,
    minSharedNodeNameLength: number,
): readonly IAstFederatedCodeGraphEdge[] {
    const symbolsByRepository = buildRepositorySymbolMap(nodes, minSharedNodeNameLength)
    const repositories = [...symbolsByRepository.keys()].sort((left, right) => left.localeCompare(right))
    const edges: IAstFederatedCodeGraphEdge[] = []

    for (let leftIndex = 0; leftIndex < repositories.length; leftIndex += 1) {
        const leftRepositoryId = repositories[leftIndex]
        if (leftRepositoryId === undefined) {
            continue
        }

        for (let rightIndex = leftIndex + 1; rightIndex < repositories.length; rightIndex += 1) {
            const rightRepositoryId = repositories[rightIndex]
            if (rightRepositoryId === undefined) {
                continue
            }

            const edge = createCrossRepositoryEdge(
                leftRepositoryId,
                rightRepositoryId,
                symbolsByRepository,
                edgeThreshold,
            )
            if (edge !== undefined) {
                edges.push(edge)
            }
        }
    }

    return edges.sort(compareFederatedEdges)
}

/**
 * Builds repository-to-symbol mapping.
 *
 * @param nodes Federated nodes.
 * @param minSharedNodeNameLength Minimum symbol length.
 * @returns Repository symbol map.
 */
function buildRepositorySymbolMap(
    nodes: readonly IAstFederatedCodeGraphNode[],
    minSharedNodeNameLength: number,
): Map<string, Map<string, readonly string[]>> {
    const map = new Map<string, Map<string, string[]>>()

    for (const node of nodes) {
        const normalizedName = normalizeSymbolName(node.name)
        if (normalizedName.length < minSharedNodeNameLength) {
            continue
        }

        let repositorySymbols = map.get(node.repositoryId)
        if (repositorySymbols === undefined) {
            repositorySymbols = new Map<string, string[]>()
            map.set(node.repositoryId, repositorySymbols)
        }

        const nodeIds = repositorySymbols.get(normalizedName) ?? []
        nodeIds.push(node.id)
        repositorySymbols.set(normalizedName, nodeIds)
    }

    const readonlyMap = new Map<string, Map<string, readonly string[]>>()
    for (const [repositoryId, repositorySymbols] of map.entries()) {
        const readonlySymbols = new Map<string, readonly string[]>()
        for (const [symbol, nodeIds] of repositorySymbols.entries()) {
            readonlySymbols.set(symbol, [...nodeIds].sort((left, right) => left.localeCompare(right)))
        }

        readonlyMap.set(repositoryId, readonlySymbols)
    }

    return readonlyMap
}

/**
 * Creates one cross-repository edge when repositories share enough symbols.
 *
 * @param leftRepositoryId Left repository identifier.
 * @param rightRepositoryId Right repository identifier.
 * @param symbolsByRepository Repository symbol map.
 * @param edgeThreshold Minimum shared symbols threshold.
 * @returns Cross-repository edge when threshold is satisfied.
 */
function createCrossRepositoryEdge(
    leftRepositoryId: string,
    rightRepositoryId: string,
    symbolsByRepository: Map<string, Map<string, readonly string[]>>,
    edgeThreshold: number,
): IAstFederatedCodeGraphEdge | undefined {
    const leftSymbols = symbolsByRepository.get(leftRepositoryId)
    const rightSymbols = symbolsByRepository.get(rightRepositoryId)
    if (leftSymbols === undefined || rightSymbols === undefined) {
        return undefined
    }

    const sharedSymbols = [...leftSymbols.keys()]
        .filter((symbol) => rightSymbols.has(symbol))
        .sort((left, right) => left.localeCompare(right))
    if (sharedSymbols.length < edgeThreshold) {
        return undefined
    }

    const representativeSymbol = sharedSymbols[0]
    if (representativeSymbol === undefined) {
        return undefined
    }

    const leftNodeId = leftSymbols.get(representativeSymbol)?.[0]
    const rightNodeId = rightSymbols.get(representativeSymbol)?.[0]
    if (leftNodeId === undefined || rightNodeId === undefined) {
        return undefined
    }

    return {
        source: leftNodeId,
        target: rightNodeId,
        type: "federated-shared-symbol",
        crossRepository: true,
        strength: sharedSymbols.length,
        sharedSymbolCount: sharedSymbols.length,
    }
}

/**
 * Creates repository-level federation summaries.
 *
 * @param fetches Repository graph fetch payloads.
 * @returns Sorted repository summaries.
 */
function createRepositorySummaries(
    fetches: readonly IRepositoryGraphFetch[],
): readonly IAstFederatedRepositorySummary[] {
    return fetches
        .map((fetch) => ({
            repositoryId: fetch.repository.repositoryId,
            ...(fetch.repository.branch !== undefined ? {branch: fetch.repository.branch} : {}),
            sourceNodeCount: fetch.graph.nodes.length,
            sourceEdgeCount: fetch.graph.edges.length,
            attempts: fetch.attempts,
            fromResultCache: fetch.fromResultCache,
        }))
        .sort((left, right) => left.repositoryId.localeCompare(right.repositoryId))
}

/**
 * Creates stable federated node id.
 *
 * @param repositoryId Repository identifier.
 * @param sourceNodeId Source node id.
 * @returns Stable federated node id.
 */
function createFederatedNodeId(repositoryId: string, sourceNodeId: string): string {
    return `${repositoryId}::${sourceNodeId}`
}

/**
 * Compares federated nodes for deterministic ordering.
 *
 * @param left Left node.
 * @param right Right node.
 * @returns Comparator value.
 */
function compareFederatedNodes(left: IAstFederatedCodeGraphNode, right: IAstFederatedCodeGraphNode): number {
    if (left.repositoryId !== right.repositoryId) {
        return left.repositoryId.localeCompare(right.repositoryId)
    }

    if (left.sourceNodeId !== right.sourceNodeId) {
        return left.sourceNodeId.localeCompare(right.sourceNodeId)
    }

    return left.id.localeCompare(right.id)
}

/**
 * Compares federated edges for deterministic ordering.
 *
 * @param left Left edge.
 * @param right Right edge.
 * @returns Comparator value.
 */
function compareFederatedEdges(left: IAstFederatedCodeGraphEdge, right: IAstFederatedCodeGraphEdge): number {
    if (left.crossRepository !== right.crossRepository) {
        return left.crossRepository ? 1 : -1
    }

    if (left.source !== right.source) {
        return left.source.localeCompare(right.source)
    }

    if (left.target !== right.target) {
        return left.target.localeCompare(right.target)
    }

    if (left.type !== right.type) {
        return left.type.localeCompare(right.type)
    }

    return (left.repositoryId ?? "").localeCompare(right.repositoryId ?? "")
}

/**
 * Normalizes repository id.
 *
 * @param repositoryId Raw repository id.
 * @returns Normalized repository id.
 */
function normalizeRepositoryId(repositoryId: string): string {
    const normalizedRepositoryId = repositoryId.trim()
    if (normalizedRepositoryId.length > 0) {
        return normalizedRepositoryId
    }

    throw new AstServiceMultiRepoGraphFederationError(
        AST_SERVICE_MULTI_REPO_GRAPH_FEDERATION_ERROR_CODE.INVALID_REPOSITORY_ID,
        {
            repositoryId,
        },
    )
}

/**
 * Normalizes optional branch value.
 *
 * @param branch Raw branch value.
 * @returns Normalized branch or undefined.
 */
function normalizeBranch(branch: string | undefined): string | undefined {
    if (branch === undefined) {
        return undefined
    }

    const normalizedBranch = branch.trim()
    if (normalizedBranch.length > 0) {
        return normalizedBranch
    }

    throw new AstServiceMultiRepoGraphFederationError(
        AST_SERVICE_MULTI_REPO_GRAPH_FEDERATION_ERROR_CODE.INVALID_BRANCH,
        {
            branch,
        },
    )
}

/**
 * Normalizes optional idempotency key.
 *
 * @param idempotencyKey Raw idempotency key.
 * @returns Normalized idempotency key.
 */
function normalizeIdempotencyKey(idempotencyKey: string | undefined): string | undefined {
    if (idempotencyKey === undefined) {
        return undefined
    }

    const normalizedIdempotencyKey = idempotencyKey.trim()
    if (normalizedIdempotencyKey.length > 0) {
        return normalizedIdempotencyKey
    }

    throw new AstServiceMultiRepoGraphFederationError(
        AST_SERVICE_MULTI_REPO_GRAPH_FEDERATION_ERROR_CODE.INVALID_IDEMPOTENCY_KEY,
        {
            idempotencyKey,
        },
    )
}

/**
 * Normalizes node symbol name for cross-repository matching.
 *
 * @param name Raw node name.
 * @returns Normalized symbol name.
 */
function normalizeSymbolName(name: string): string {
    return name.trim().toLowerCase()
}

/**
 * Validates positive integer value.
 *
 * @param value Raw numeric value.
 * @param errorCode Typed error code.
 * @returns Validated numeric value.
 */
function validatePositiveInteger(
    value: number,
    errorCode: AstServiceMultiRepoGraphFederationErrorCode,
): number {
    if (Number.isSafeInteger(value) && value > 0) {
        return value
    }

    throw new AstServiceMultiRepoGraphFederationError(errorCode, {value})
}

/**
 * Resolves bounded exponential backoff.
 *
 * @param attempt Attempt number.
 * @param retryPolicy Resolved retry policy.
 * @returns Backoff duration in milliseconds.
 */
function resolveBackoffMs(attempt: number, retryPolicy: IResolvedRetryPolicy): number {
    const exponent = Math.max(0, attempt - 1)
    const backoffMs = retryPolicy.initialBackoffMs * 2 ** exponent
    return Math.min(retryPolicy.maxBackoffMs, backoffMs)
}

/**
 * Default retry classifier.
 *
 * @param error Unknown error payload.
 * @returns `true` when retry should continue.
 */
function defaultShouldRetry(error: unknown): boolean {
    if (typeof error !== "object" || error === null) {
        return true
    }

    const retryable = (error as {readonly retryable?: unknown}).retryable
    if (typeof retryable === "boolean") {
        return retryable
    }

    return true
}

/**
 * Default sleep callback for retry/backoff flow.
 *
 * @param durationMs Sleep duration in milliseconds.
 * @returns Promise resolved after timeout.
 */
function sleepFor(durationMs: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, durationMs)
    })
}

/**
 * Resolves unknown error payload into stable message.
 *
 * @param error Unknown error payload.
 * @returns Stable error message.
 */
function resolveUnknownErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message
    }

    return "Unknown error"
}
