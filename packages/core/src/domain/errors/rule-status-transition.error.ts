import {DomainError} from "./domain.error"

/**
 * Error raised when rule status transition is forbidden by policy.
 */
export class RuleStatusTransitionError extends DomainError {
    /**
     * Creates transition error.
     *
     * @param currentStatus Current rule status.
     * @param attemptedOperation Attempted lifecycle operation.
     */
    public constructor(currentStatus: string, attemptedOperation: string) {
        super(
            "RULE_STATUS_TRANSITION_FORBIDDEN",
            `Cannot '${attemptedOperation}' rule from status '${currentStatus}'`,
        )
    }
}
