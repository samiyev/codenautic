import {describe, expect, test} from "bun:test"

import {RULE_STATUS} from "../../../src/domain/aggregates/rule.aggregate"
import {RuleStatusTransitionError} from "../../../src/domain/errors/rule-status-transition.error"
import {RuleStatusPolicyService} from "../../../src/domain/services/rule-status-policy.service"

describe("RuleStatusPolicyService", () => {
    test("allows activate from draft and inactive", () => {
        const policy = new RuleStatusPolicyService()

        expect(() => {
            policy.ensureCanActivate(RULE_STATUS.DRAFT)
            policy.ensureCanActivate(RULE_STATUS.INACTIVE)
        }).not.toThrow()
    })

    test("blocks activate from active and archived", () => {
        const policy = new RuleStatusPolicyService()

        expect(() => {
            policy.ensureCanActivate(RULE_STATUS.ACTIVE)
        }).toThrow(RuleStatusTransitionError)

        expect(() => {
            policy.ensureCanActivate(RULE_STATUS.ARCHIVED)
        }).toThrow(RuleStatusTransitionError)
    })

    test("allows deactivate only from active", () => {
        const policy = new RuleStatusPolicyService()

        expect(() => {
            policy.ensureCanDeactivate(RULE_STATUS.ACTIVE)
        }).not.toThrow()

        expect(() => {
            policy.ensureCanDeactivate(RULE_STATUS.DRAFT)
        }).toThrow(RuleStatusTransitionError)
    })

    test("allows archive from non-archived statuses only", () => {
        const policy = new RuleStatusPolicyService()

        expect(() => {
            policy.ensureCanArchive(RULE_STATUS.DRAFT)
            policy.ensureCanArchive(RULE_STATUS.ACTIVE)
            policy.ensureCanArchive(RULE_STATUS.INACTIVE)
        }).not.toThrow()

        expect(() => {
            policy.ensureCanArchive(RULE_STATUS.ARCHIVED)
        }).toThrow(RuleStatusTransitionError)
    })
})
