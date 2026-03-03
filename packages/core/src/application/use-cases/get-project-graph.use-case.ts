import type {IUseCase} from "../ports/inbound/use-case.port"
import type {IProjectRepository} from "../ports/outbound/project-repository.port"
import {ValidationError, type IValidationErrorField} from "../../domain/errors/validation.error"
import {UniqueId} from "../../domain/value-objects/unique-id.value-object"
import {
    PROJECT_GRAPH_EDGE_RELATION,
    PROJECT_GRAPH_NODE_TYPE,
    type IProjectDTO,
    type IProjectGraphDTO,
    type IProjectGraphEdgeDTO,
    type IProjectGraphNodeDTO,
    type IProjectGraphOutput,
    type IProjectIdInput,
    mapProjectToDTO,
} from "../dto/project/project.dto"
import {Result} from "../../shared/result"

/**
 * Builds and returns lightweight project graph information.
 */
export class GetProjectGraphUseCase
    implements IUseCase<IProjectIdInput, IProjectGraphOutput, ValidationError>
{
    private readonly projectRepository: IProjectRepository

    /**
     * Creates use case instance.
     *
     * @param projectRepository Project persistence port.
     */
    public constructor(projectRepository: IProjectRepository) {
        this.projectRepository = projectRepository
    }

    /**
     * Returns graph for a single project.
     *
     * @param input Request payload.
     * @returns Project DTO and derived graph.
     */
    public async execute(input: IProjectIdInput): Promise<Result<IProjectGraphOutput, ValidationError>> {
        const validationError = this.validateProjectId(input.projectId)
        if (validationError !== undefined) {
            return Result.fail<IProjectGraphOutput, ValidationError>(
                new ValidationError("Project graph validation failed", [validationError]),
            )
        }

        const projectId = UniqueId.create(input.projectId)
        const project = await this.projectRepository.findById(projectId)
        if (project === null) {
            return Result.fail<IProjectGraphOutput, ValidationError>(
                new ValidationError("Project graph validation failed", [
                    {
                        field: "projectId",
                        message: `Project '${input.projectId}' not found`,
                    },
                ]),
            )
        }

        const projectDTO: IProjectDTO = mapProjectToDTO(project)
        return Result.ok<IProjectGraphOutput, ValidationError>({
            project: projectDTO,
            graph: this.buildGraph(projectDTO),
        })
    }

    /**
     * Validates project identifier.
     *
     * @param projectId Raw identifier.
     * @returns Field error when invalid.
     */
    private validateProjectId(projectId: string): IValidationErrorField | undefined {
        if (typeof projectId !== "string" || projectId.trim().length === 0) {
            return {
                field: "projectId",
                message: "must be a non-empty string",
            }
        }

        return undefined
    }

    /**
     * Creates deterministic project graph representation.
     *
     * @param project Project DTO.
     * @returns Deterministic graph payload.
     */
    private buildGraph(project: IProjectDTO): IProjectGraphDTO {
        const nodePrefix = `${project.id}:`
        const nodes: IProjectGraphNodeDTO[] = [
            {
                id: project.id,
                type: PROJECT_GRAPH_NODE_TYPE.PROJECT,
                label: "project",
            },
        ]
        const edges: IProjectGraphEdgeDTO[] = []

        for (const ruleId of project.settings.customRuleIds) {
            const ruleNodeId = `${nodePrefix}rule:${ruleId}`
            nodes.push({
                id: ruleNodeId,
                type: PROJECT_GRAPH_NODE_TYPE.RULE,
                label: ruleId,
            })
            edges.push({
                from: project.id,
                to: ruleNodeId,
                relation: PROJECT_GRAPH_EDGE_RELATION.USES_CUSTOM_RULE,
            })
        }

        for (const integration of project.integrations) {
            const integrationNodeId = `${nodePrefix}integration:${integration}`
            nodes.push({
                id: integrationNodeId,
                type: PROJECT_GRAPH_NODE_TYPE.INTEGRATION,
                label: integration,
            })
            edges.push({
                from: project.id,
                to: integrationNodeId,
                relation: PROJECT_GRAPH_EDGE_RELATION.USES_INTEGRATION,
            })
        }

        return {
            nodes,
            edges,
            generatedAt: new Date(),
        }
    }
}
