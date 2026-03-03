import type {Organization} from "../../../domain/aggregates/organization.aggregate"
import type {UniqueId} from "../../../domain/value-objects/unique-id.value-object"
import type {IRepository} from "./common/repository.port"

/**
 * Outbound persistence contract for organizations.
 */
export interface IOrganizationRepository extends IRepository<Organization> {
    /**
     * Finds organizations by owner identifier.
     *
     * @param ownerId Owner identifier.
     * @returns Matching organizations.
     */
    findByOwnerId(ownerId: UniqueId): Promise<readonly Organization[]>
}
