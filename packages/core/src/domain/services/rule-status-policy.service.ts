import {type RuleStatus, RULE_STATUS} from "../aggregates/rule.aggregate"
import {RuleStatusTransitionError} from "../errors/rule-status-transition.error"

/**
 * Domain service that owns allowed rule status transitions.
 */
export class RuleStatusPolicyService {
    /**
     * Creates policy service instance.
     */
    public constructor() {}

    /**
     * Validates activate transition.
     *
     * @param currentStatus Current rule status.
     * @throws RuleStatusTransitionError when transition is forbidden.
     */
    public ensureCanActivate(currentStatus: RuleStatus): void {
        if (currentStatus === RULE_STATUS.DRAFT || currentStatus === RULE_STATUS.INACTIVE) {
            return
        }
        throw new RuleStatusTransitionError(currentStatus, "activate")
    }

    /**
     * Validates deactivate transition.
     *
     * @param currentStatus Current rule status.
     * @throws RuleStatusTransitionError when transition is forbidden.
     */
    public ensureCanDeactivate(currentStatus: RuleStatus): void {
        if (currentStatus === RULE_STATUS.ACTIVE) {
            return
        }
        throw new RuleStatusTransitionError(currentStatus, "deactivate")
    }

    /**
     * Validates archive transition.
     *
     * @param currentStatus Current rule status.
     * @throws RuleStatusTransitionError when transition is forbidden.
     */
    public ensureCanArchive(currentStatus: RuleStatus): void {
        if (currentStatus !== RULE_STATUS.ARCHIVED) {
            return
        }
        throw new RuleStatusTransitionError(currentStatus, "archive")
    }
}
