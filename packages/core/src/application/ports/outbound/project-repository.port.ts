import type {OrganizationId} from "../../../domain/value-objects/organization-id.value-object"
import type {Project} from "../../../domain/entities/project.entity"
import type {RepositoryId} from "../../../domain/value-objects/repository-id.value-object"
import type {IRepository} from "./common/repository.port"

/**
 * Filters for querying projects repository.
 */
export interface IProjectFilters {
    /**
     * Restricts query by owning organization.
     */
    readonly organizationId?: OrganizationId

    /**
     * Restricts query by repository identifier.
     */
    readonly repositoryId?: RepositoryId
}

/**
 * Outbound persistence contract for project entities.
 */
export interface IProjectRepository extends IRepository<Project> {
    /**
     * Finds project by repository identifier.
     *
     * @param repositoryId Repository identifier.
     * @returns Matching project or null.
     */
    findByRepositoryId(repositoryId: RepositoryId): Promise<Project | null>

    /**
     * Finds projects by organization.
     *
     * @param organizationId Organization identifier.
     * @returns Matching projects.
     */
    findByOrganizationId(organizationId: OrganizationId): Promise<readonly Project[]>

    /**
     * Finds projects by optional filters.
     *
     * @param filters Query filters.
     * @returns Matching projects.
     */
    findAll(filters?: IProjectFilters): Promise<readonly Project[]>

    /**
     * Counts projects by optional filters.
     *
     * @param filters Query filters.
     * @returns Matching count.
     */
    count(filters?: IProjectFilters): Promise<number>
}
