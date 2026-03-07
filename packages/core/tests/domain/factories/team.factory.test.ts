import {describe, expect, test} from "bun:test"

import {TeamFactory} from "../../../src/domain/factories/team.factory"

describe("TeamFactory", () => {
    test("creates team with defaults and normalization", () => {
        const factory = new TeamFactory()
        const team = factory.create({
            name: "  Review Team  ",
            organizationId: "org-1",
            memberIds: ["member-1", "member-1"],
            repoIds: ["gh:repo-1", "gh:repo-2"],
            ruleIds: ["rule-1"],
            disabledRuleUuids: ["disabled-rule-1", "disabled-rule-1", "disabled-rule-2"],
        })

        expect(team.name).toBe("Review Team")
        expect(team.organizationId.value).toBe("org-1")
        expect(team.memberIds).toHaveLength(1)
        expect(team.repoIds.map((repo) => repo.toString())).toEqual([
            "gh:repo-1",
            "gh:repo-2",
        ])
        expect(team.disabledRuleUuids).toEqual([
            "disabled-rule-1",
            "disabled-rule-2",
        ])
    })

    test("reconstitutes team snapshot from storage", () => {
        const factory = new TeamFactory()
        const team = factory.reconstitute({
            id: "team-1",
            name: "Storage Team",
            organizationId: "org-2",
            memberIds: ["member-1", "member-2"],
            repoIds: ["gl:repo-1"],
            ruleIds: ["rule-10", "rule-11"],
            disabledRuleUuids: ["rule-disabled-1", "rule-disabled-2"],
        })

        expect(team.id.value).toBe("team-1")
        expect(team.name).toBe("Storage Team")
        expect(team.organizationId.value).toBe("org-2")
        expect(team.memberIds).toHaveLength(2)
        expect(team.repoIds.map((repo) => repo.toString())).toEqual(["gl:repo-1"])
        expect(team.ruleIds.map((rule) => rule.value)).toEqual(["rule-10", "rule-11"])
        expect(team.disabledRuleUuids).toEqual([
            "rule-disabled-1",
            "rule-disabled-2",
        ])
    })
})
