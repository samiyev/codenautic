import type {SeverityLevel} from "../../../domain/value-objects/severity.value-object"
import type {IProjectSettingsInput} from "../../../domain/value-objects/project-settings.value-object"
import type {ProjectCadence} from "../../../domain/value-objects/project-settings.value-object"
import type {Project} from "../../../domain/entities/project.entity"

/**
 * Normalized view of repository configuration for API/use-case boundaries.
 */
export interface IProjectSettingsDTO {
    readonly severity: SeverityLevel
    readonly ignorePaths: readonly string[]
    readonly cadence: ProjectCadence
    readonly limits: Record<string, number>
    readonly customRuleIds: readonly string[]
    readonly promptOverrides: Record<string, unknown>
}

/**
 * Use-case representation of a project entity.
 */
export interface IProjectDTO {
    readonly id: string
    readonly repositoryId: string
    readonly organizationId: string | null
    readonly settings: IProjectSettingsDTO
    readonly integrations: readonly string[]
}

/**
 * Input payload for project creation.
 */
export interface ICreateProjectInput {
    readonly repositoryId: string
    readonly organizationId?: string | null
    readonly settings?: IProjectSettingsInput
    readonly integrations?: readonly string[]
}

/**
 * Output payload for project creation.
 */
export interface ICreateProjectOutput {
    readonly project: IProjectDTO
}

/**
 * Input payload for project read/update operations.
 */
export interface IProjectIdInput {
    readonly projectId: string
}

/**
 * Input payload for project list queries.
 */
export interface IListProjectsInput {
    readonly organizationId?: string | null
    readonly repositoryId?: string
}

/**
 * Project list output.
 */
export interface IListProjectsOutput {
    readonly projects: readonly IProjectDTO[]
    readonly totalCount: number
}

/**
 * Input payload for project updates.
 */
export interface IUpdateProjectInput {
    readonly projectId: string
    readonly settings?: IProjectSettingsInput
    readonly integrationsToAdd?: readonly string[]
}

/**
 * Output payload for project updates.
 */
export interface IUpdateProjectOutput {
    readonly project: IProjectDTO
}

/**
 * Output payload for project deletion.
 */
export interface IDeleteProjectOutput {
    readonly projectId: string
}

/**
 * Project node types in generated project graph.
 */
export const PROJECT_GRAPH_NODE_TYPE = {
    PROJECT: "project",
    RULE: "rule",
    INTEGRATION: "integration",
} as const

export type ProjectGraphNodeType = (typeof PROJECT_GRAPH_NODE_TYPE)[keyof typeof PROJECT_GRAPH_NODE_TYPE]

/**
 * Project graph edge relation labels.
 */
export const PROJECT_GRAPH_EDGE_RELATION = {
    USES_CUSTOM_RULE: "uses-custom-rule",
    USES_INTEGRATION: "uses-integration",
} as const

export type ProjectGraphEdgeRelation =
    (typeof PROJECT_GRAPH_EDGE_RELATION)[keyof typeof PROJECT_GRAPH_EDGE_RELATION]

/**
 * Project graph node.
 */
export interface IProjectGraphNodeDTO {
    readonly id: string
    readonly type: ProjectGraphNodeType
    readonly label: string
}

/**
 * Project graph edge.
 */
export interface IProjectGraphEdgeDTO {
    readonly from: string
    readonly to: string
    readonly relation: ProjectGraphEdgeRelation
}

/**
 * Project graph representation.
 */
export interface IProjectGraphDTO {
    readonly nodes: readonly IProjectGraphNodeDTO[]
    readonly edges: readonly IProjectGraphEdgeDTO[]
    readonly generatedAt: Date
}

/**
 * Output payload for project graph reading.
 */
export interface IProjectGraphOutput {
    readonly project: IProjectDTO
    readonly graph: IProjectGraphDTO
}

/**
 * Converts domain project entity to API-safe DTO.
 *
 * @param project Source domain entity.
 * @returns Mapped DTO.
 */
export function mapProjectToDTO(project: Project): IProjectDTO {
    return {
        id: project.id.value,
        repositoryId: project.repositoryId.toString(),
        organizationId: project.organizationId.value,
        settings: {
            severity: project.settings.severity,
            ignorePaths: project.settings.ignorePaths,
            cadence: project.settings.cadence,
            limits: project.settings.limits,
            customRuleIds: project.settings.customRuleIds,
            promptOverrides: project.settings.promptOverrides,
        },
        integrations: project.integrations,
    }
}

