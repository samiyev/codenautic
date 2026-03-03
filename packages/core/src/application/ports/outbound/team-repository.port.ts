import type {Team} from "../../../domain/entities/team.entity"
import type {UniqueId} from "../../../domain/value-objects/unique-id.value-object"
import type {IRepository} from "./common/repository.port"

/**
 * Outbound persistence contract for teams.
 */
export interface ITeamRepository extends IRepository<Team> {
    /**
     * Finds teams by owning organization identifier.
     *
     * @param organizationId Organization identifier.
     * @returns Matching teams.
     */
    findByOrganizationId(organizationId: UniqueId): Promise<readonly Team[]>
}
