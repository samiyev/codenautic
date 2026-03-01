import {describe, expect, test} from "bun:test"

import {RULE_STATUS} from "../../../src/domain/aggregates/rule.aggregate"
import {RuleFactory} from "../../../src/domain/factories/rule.factory"

describe("RuleFactory", () => {
    test("creates new rule aggregate", () => {
        const factory = new RuleFactory()
        const rule = factory.create({
            name: "No wildcard imports",
            description: "Disallow wildcard imports in core",
            expression: "wildcard-import == false",
        })

        expect(rule.id.value.length).toBeGreaterThan(0)
        expect(rule.status).toBe(RULE_STATUS.DRAFT)
        expect(rule.name).toBe("No wildcard imports")
    })

    test("reconstitutes rule snapshot with string timestamps", () => {
        const factory = new RuleFactory()
        const rule = factory.reconstitute({
            id: "rule-123",
            name: "Strict boolean checks",
            description: "Enforce strict boolean expressions",
            expression: "strict-boolean == true",
            status: RULE_STATUS.INACTIVE,
            activatedAt: "2026-03-01T08:00:00.000Z",
            deactivatedAt: "2026-03-01T08:30:00.000Z",
            archivedAt: null,
        })

        expect(rule.id.value).toBe("rule-123")
        expect(rule.status).toBe(RULE_STATUS.INACTIVE)
        expect(rule.activatedAt?.toISOString()).toBe("2026-03-01T08:00:00.000Z")
        expect(rule.deactivatedAt?.toISOString()).toBe("2026-03-01T08:30:00.000Z")
    })

    test("validates required string fields", () => {
        const factory = new RuleFactory()

        expect(() => {
            factory.create({
                name: "   ",
                description: "desc",
                expression: "expr",
            })
        }).toThrow("Rule name cannot be empty")

        expect(() => {
            factory.create({
                name: "Name",
                description: "   ",
                expression: "expr",
            })
        }).toThrow("Rule description cannot be empty")

        expect(() => {
            factory.create({
                name: "Name",
                description: "Desc",
                expression: "   ",
            })
        }).toThrow("Rule expression cannot be empty")
    })
})
