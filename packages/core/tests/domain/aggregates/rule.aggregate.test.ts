import {describe, expect, test} from "bun:test"

import {RULE_STATUS} from "../../../src/domain/aggregates/rule.aggregate"
import {RuleStatusTransitionError} from "../../../src/domain/errors/rule-status-transition.error"
import {RuleFactory} from "../../../src/domain/factories/rule.factory"

describe("Rule aggregate", () => {
    test("creates in draft state with null lifecycle timestamps", () => {
        const factory = new RuleFactory()
        const rule = factory.create({
            name: "No TODO in production",
            description: "Disallow TODO markers in changed lines",
            expression: "todo-marker == false",
        })

        expect(rule.status).toBe(RULE_STATUS.DRAFT)
        expect(rule.description).toBe("Disallow TODO markers in changed lines")
        expect(rule.expression).toBe("todo-marker == false")
        expect(rule.activatedAt).toBeNull()
        expect(rule.deactivatedAt).toBeNull()
        expect(rule.archivedAt).toBeNull()
    })

    test("activates rule and emits RuleActivated event", () => {
        const factory = new RuleFactory()
        const rule = factory.create({
            name: "No debug logs",
            description: "Disallow debug statements in runtime",
            expression: "debug-log == false",
        })

        rule.activate(new Date("2026-03-01T12:00:00.000Z"))
        const events = rule.pullDomainEvents()

        expect(rule.status).toBe(RULE_STATUS.ACTIVE)
        expect(rule.activatedAt?.toISOString()).toBe("2026-03-01T12:00:00.000Z")
        expect(events.length).toBe(1)
        expect(events[0]?.eventName).toBe("RuleActivated")
    })

    test("deactivates active rule", () => {
        const factory = new RuleFactory()
        const rule = factory.create({
            name: "No hardcoded secrets",
            description: "Disallow hardcoded secrets in config files",
            expression: "secret-literal == false",
        })

        rule.activate(new Date("2026-03-01T11:00:00.000Z"))
        rule.pullDomainEvents()
        rule.deactivate(new Date("2026-03-01T11:30:00.000Z"))

        expect(rule.status).toBe(RULE_STATUS.INACTIVE)
        expect(rule.deactivatedAt?.toISOString()).toBe("2026-03-01T11:30:00.000Z")
    })

    test("archives non-archived rule", () => {
        const factory = new RuleFactory()
        const rule = factory.create({
            name: "Max function complexity",
            description: "Keep complexity under threshold",
            expression: "complexity <= 10",
        })

        rule.archive(new Date("2026-03-01T13:00:00.000Z"))

        expect(rule.status).toBe(RULE_STATUS.ARCHIVED)
        expect(rule.archivedAt?.toISOString()).toBe("2026-03-01T13:00:00.000Z")
    })

    test("blocks invalid status transitions", () => {
        const factory = new RuleFactory()
        const rule = factory.create({
            name: "No unsafe any",
            description: "Disallow explicit any in domain layer",
            expression: "explicit-any == false",
        })

        expect(() => {
            rule.deactivate(new Date("2026-03-01T10:00:00.000Z"))
        }).toThrow(RuleStatusTransitionError)

        rule.activate(new Date("2026-03-01T10:10:00.000Z"))
        expect(() => {
            rule.activate(new Date("2026-03-01T10:15:00.000Z"))
        }).toThrow(RuleStatusTransitionError)

        rule.archive(new Date("2026-03-01T10:20:00.000Z"))
        expect(() => {
            rule.archive(new Date("2026-03-01T10:25:00.000Z"))
        }).toThrow(RuleStatusTransitionError)
    })
})
