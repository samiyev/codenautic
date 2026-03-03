import type {IUseCase} from "../../ports/inbound/use-case.port"
import type {IGraphRepository} from "../../ports/outbound/graph/code-graph-repository.port"
import {CODE_GRAPH_NODE_TYPE, type ICodeGraphNode} from "../../ports/outbound/graph/code-graph.type"
import {NotFoundError} from "../../../domain/errors/not-found.error"
import {ValidationError, type IValidationErrorField} from "../../../domain/errors/validation.error"
import {RepositoryId} from "../../../domain/value-objects/repository-id.value-object"
import type {DomainError} from "../../../domain/errors/domain.error"
import {Result} from "../../../shared/result"
import type {
    IFileMetricField,
    IGetTemporalDiffInput,
    ITemporalDiffChangedFile,
    ITemporalDiffFileNode,
    ITemporalDiffMetricDelta,
    ITemporalDiffResult,
} from "../../dto/analytics/temporal-diff.dto"
import {TREEMAP_NODE_TYPE} from "../../dto/analytics/treemap-node.dto"

const FILE_METRIC_FIELDS: ReadonlyArray<IFileMetricField> = [
    "loc",
    "complexity",
    "churn",
    "issueCount",
    "coverage",
]

interface INormalizedGetTemporalDiffInput {
    /**
     * Normalized repository identifier.
     */
    readonly repoId: string

    /**
     * Normalized source commit or branch.
     */
    readonly fromCommit: string

    /**
     * Normalized target commit or branch.
     */
    readonly toCommit: string
}

/**
 * Dependencies for temporal diff use case.
 */
export interface IGetTemporalDiffUseCaseDependencies {
    /**
     * Graph repository for snapshot loading.
     */
    readonly graphRepository: IGraphRepository
}

/**
 * Calculates file-level changes between two graph snapshots.
 */
export class GetTemporalDiffUseCase
    implements IUseCase<IGetTemporalDiffInput, ITemporalDiffResult, DomainError>
{
    private readonly graphRepository: IGraphRepository

    /**
     * Creates use case instance.
     *
     * @param dependencies Dependency set.
     */
    public constructor(dependencies: IGetTemporalDiffUseCaseDependencies) {
        this.graphRepository = dependencies.graphRepository
    }

    /**
     * Builds temporal diff for file-level graph nodes.
     *
     * @param input Request payload.
     * @returns Added/removed/changed payload.
     */
    public async execute(
        input: IGetTemporalDiffInput,
    ): Promise<Result<ITemporalDiffResult, DomainError>> {
        const normalizedInputResult = this.validateAndNormalizeInput(input)
        if (normalizedInputResult.isFail) {
            return Result.fail<ITemporalDiffResult, DomainError>(
                normalizedInputResult.error,
            )
        }

        const {repoId, fromCommit, toCommit} = normalizedInputResult.value
        const fromGraph = await this.graphRepository.loadGraph(repoId, fromCommit)
        if (fromGraph === null) {
            return Result.fail<ITemporalDiffResult, DomainError>(
                new NotFoundError("CodeGraph", `${repoId}@${fromCommit}`),
            )
        }

        const toGraph = await this.graphRepository.loadGraph(repoId, toCommit)
        if (toGraph === null) {
            return Result.fail<ITemporalDiffResult, DomainError>(
                new NotFoundError("CodeGraph", `${repoId}@${toCommit}`),
            )
        }

        const fromFileNodes = this.collectFileNodes(fromGraph.nodes)
        const toFileNodes = this.collectFileNodes(toGraph.nodes)

        const added: ITemporalDiffFileNode[] = []
        const removed: ITemporalDiffFileNode[] = []
        const changed: ITemporalDiffChangedFile[] = []

        for (const [filePath, toNode] of toFileNodes) {
            const fromNode = fromFileNodes.get(filePath)
            if (fromNode === undefined) {
                added.push(this.toTreemapNode(filePath, toNode))
                continue
            }

            const metricsDelta = this.createMetricsDelta(fromNode, toNode)
            if (Object.keys(metricsDelta).length > 0) {
                changed.push({
                    node: this.toTreemapNode(filePath, toNode),
                    metricsDelta,
                })
            }
        }

        for (const [filePath, fromNode] of fromFileNodes) {
            if (!toFileNodes.has(filePath)) {
                removed.push(this.toTreemapNode(filePath, fromNode))
            }
        }

        const sortedAdded = added.sort((left, right) =>
            left.id.localeCompare(right.id),
        )
        const sortedRemoved = removed.sort((left, right) =>
            left.id.localeCompare(right.id),
        )
        const sortedChanged = changed.sort((left, right) =>
            left.node.id.localeCompare(right.node.id),
        )

        return Result.ok<ITemporalDiffResult, DomainError>({
            added: sortedAdded,
            removed: sortedRemoved,
            changed: sortedChanged,
        })
    }

    /**
     * Normalizes and validates incoming input.
     *
     * @param input Raw payload.
     * @returns Normalized payload or validation error.
     */
    private validateAndNormalizeInput(
        input: IGetTemporalDiffInput,
    ): Result<INormalizedGetTemporalDiffInput, ValidationError> {
        const fields = this.collectValidationErrors(input)
        if (fields.length > 0) {
            return Result.fail<INormalizedGetTemporalDiffInput, ValidationError>(
                new ValidationError("Get temporal diff validation failed", fields),
            )
        }

        const normalizedRepoId = this.normalizeRepositoryId(input.repoId)
        if (normalizedRepoId.isFail) {
            return Result.fail<INormalizedGetTemporalDiffInput, ValidationError>(
                normalizedRepoId.error,
            )
        }

        return Result.ok<INormalizedGetTemporalDiffInput, ValidationError>({
            repoId: normalizedRepoId.value,
            fromCommit: input.fromCommit.trim(),
            toCommit: input.toCommit.trim(),
        })
    }

    /**
     * Collects validation issues from input shape.
     *
     * @param input Input payload.
     * @returns Validation fields.
     */
    private collectValidationErrors(
        input: IGetTemporalDiffInput,
    ): IValidationErrorField[] {
        const fields: IValidationErrorField[] = []

        if (typeof input.repoId !== "string" || input.repoId.trim().length === 0) {
            fields.push({
                field: "repoId",
                message: "must be a non-empty string",
            })
        }

        if (typeof input.fromCommit !== "string" || input.fromCommit.trim().length === 0) {
            fields.push({
                field: "fromCommit",
                message: "must be a non-empty string",
            })
        }

        if (typeof input.toCommit !== "string" || input.toCommit.trim().length === 0) {
            fields.push({
                field: "toCommit",
                message: "must be a non-empty string",
            })
        }

        return fields
    }

    /**
     * Normalizes repository identifier with value object.
     *
     * @param repositoryId Raw repository id.
     * @returns Normalized repo id.
     */
    private normalizeRepositoryId(
        repositoryId: string,
    ): Result<string, ValidationError> {
        try {
            return Result.ok<string, ValidationError>(
                RepositoryId.parse(repositoryId).toString(),
            )
        } catch (error: unknown) {
            if (error instanceof Error) {
                return Result.fail<string, ValidationError>(
                    new ValidationError("Get temporal diff validation failed", [{
                        field: "repoId",
                        message: error.message,
                    }]),
                )
            }

            return Result.fail<string, ValidationError>(
                new ValidationError("Get temporal diff validation failed", [{
                    field: "repoId",
                    message: "RepositoryId must match format <platform>:<id>",
                }]),
            )
        }
    }

    /**
     * Collects all file nodes from graph payload.
     *
     * @param graphNodes Graph nodes.
     * @returns Map filePath -> file node.
     */
    private collectFileNodes(
        graphNodes: readonly ICodeGraphNode[],
    ): Map<string, ICodeGraphNode> {
        const fileNodes = new Map<string, ICodeGraphNode>()

        for (const node of graphNodes) {
            if (node.type !== CODE_GRAPH_NODE_TYPE.FILE) {
                continue
            }

            fileNodes.set(node.filePath, node)
        }

        return fileNodes
    }

    /**
     * Builds deterministic treemap node for changed file.
     *
     * @param filePath Source file path.
     * @param source Source graph node.
     * @returns Treemap node DTO.
     */
    private toTreemapNode(
        filePath: string,
        source: ICodeGraphNode,
    ): ITemporalDiffFileNode {
        const displayName = filePath.split("/").at(-1) ?? filePath
        const loc = this.readNumericMetric(source, "loc")
        const extras = this.collectFileMetricExtras(source)

        return {
            id: filePath,
            name: displayName,
            type: TREEMAP_NODE_TYPE.FILE,
            metrics: {
                value: loc ?? 1,
                extras,
            },
            children: [],
        }
    }

    /**
     * Computes numeric deltas for file-level metrics.
     *
     * @param from Source snapshot node.
     * @param to Target snapshot node.
     * @returns Partial numeric delta.
     */
    private createMetricsDelta(
        from: ICodeGraphNode,
        to: ICodeGraphNode,
    ): ITemporalDiffMetricDelta {
        const delta: ITemporalDiffMetricDelta = {}

        for (const field of FILE_METRIC_FIELDS) {
            const fromValue = this.readNumericMetric(from, field)
            const toValue = this.readNumericMetric(to, field)

            if (fromValue === null && toValue === null) {
                continue
            }

            if (fromValue === toValue) {
                continue
            }

            delta[field] = (toValue ?? 0) - (fromValue ?? 0)
        }

        return delta
    }

    /**
     * Collects display extras for treemap node.
     *
     * @param source Source node.
     * @returns Additional numeric metrics.
     */
    private collectFileMetricExtras(source: ICodeGraphNode): Record<string, number> | undefined {
        const extras: Record<string, number> = {}

        for (const field of FILE_METRIC_FIELDS) {
            if (field === "loc") {
                continue
            }

            const value = this.readNumericMetric(source, field)
            if (value !== null) {
                extras[field] = value
            }
        }

        if (Object.keys(extras).length === 0) {
            return undefined
        }

        return extras
    }

    /**
     * Reads numeric value from graph node metadata.
     *
     * @param node Source node.
     * @param field Metric field.
     * @returns Numeric value or null.
     */
    private readNumericMetric(
        node: ICodeGraphNode,
        field: IFileMetricField,
    ): number | null {
        const raw = node.metadata?.[field]
        if (typeof raw === "number") {
            return raw
        }

        return null
    }
}
