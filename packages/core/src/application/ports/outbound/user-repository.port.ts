import type {User as DomainUser} from "../../../domain/entities/user.entity"
import type {IRepository} from "./common/repository.port"

/**
 * Outbound persistence contract for users.
 */
export interface IUserRepository extends IRepository<DomainUser> {
    /**
     * Finds user by email.
     *
     * @param email User email.
     * @returns User by email or null.
     */
    findByEmail(email: string): Promise<DomainUser | null>
}
