import type {Rule, RuleStatus} from "../../../../domain/aggregates/rule.aggregate"
import type {IRepository} from "../common/repository.port"

/**
 * Outbound persistence contract for rule aggregates.
 */
export interface IRuleRepository extends IRepository<Rule> {
    /**
     * Finds rules by lifecycle status.
     *
     * @param status Rule lifecycle status.
     * @returns List of matching rules.
     */
    findByStatus(status: RuleStatus): Promise<readonly Rule[]>
}
