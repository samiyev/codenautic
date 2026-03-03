import {describe, expect, test} from "bun:test"

import {GetEnabledRulesUseCase} from "../../../../src/application/use-cases/rules/get-enabled-rules.use-case"
import type {ITeamRuleProvider} from "../../../../src/application/ports/outbound/rule/team-rule-provider.port"
import {
    RULE_STATUS,
    type Rule,
    type RuleStatus,
} from "../../../../src/domain/aggregates/rule.aggregate"
import type {IRuleRepository} from "../../../../src/application/ports/outbound/rule/rule-repository.port"
import {RuleFactory} from "../../../../src/domain/factories/rule.factory"

describe("GetEnabledRulesUseCase", () => {
    test("merges global and organization rules with layer precedence", async () => {
        const repository = createRuleRepository([
            {id: "global-1", status: RULE_STATUS.ACTIVE},
            {id: "global-2", status: RULE_STATUS.ACTIVE},
            {id: "org-1", status: RULE_STATUS.ACTIVE},
            {id: "inactive", status: RULE_STATUS.INACTIVE},
        ])
        const useCase = new GetEnabledRulesUseCase({ruleRepository: repository})

        const result = await useCase.execute({
            organizationId: "org-1",
            globalRuleIds: ["global-1", "global-2"],
            organizationRuleIds: ["global-2", "org-1", "inactive"],
        })

        expect(result.isOk).toBe(true)
        expect(result.value.ruleIds).toEqual(["global-1", "global-2", "org-1"])
    })

    test("applies team overrides and disabled uuids", async () => {
        const repository = createRuleRepository([
            {id: "global-1", status: RULE_STATUS.ACTIVE},
            {id: "global-2", status: RULE_STATUS.ACTIVE},
            {id: "org-1", status: RULE_STATUS.ACTIVE},
            {id: "team-1", status: RULE_STATUS.ACTIVE},
        ])
        const provider = createTeamRuleProvider({
            "team-1": {
                ruleIds: ["team-1", "global-1"],
                disabledRuleUuids: ["global-2"],
            },
        })
        const useCase = new GetEnabledRulesUseCase({
            ruleRepository: repository,
            teamRuleProvider: provider,
        })

        const result = await useCase.execute({
            organizationId: "org-1",
            globalRuleIds: ["global-1", "global-2"],
            organizationRuleIds: ["global-2", "org-1"],
            teamId: "team-1",
        })

        expect(result.isOk).toBe(true)
        expect(result.value.ruleIds).toEqual(["org-1", "team-1", "global-1"])
    })

    test("fallbacks to global+organization when team provider is missing", async () => {
        const repository = createRuleRepository([
            {id: "global-1", status: RULE_STATUS.ACTIVE},
            {id: "global-2", status: RULE_STATUS.ACTIVE},
            {id: "org-1", status: RULE_STATUS.ACTIVE},
        ])
        const useCase = new GetEnabledRulesUseCase({ruleRepository: repository})

        const result = await useCase.execute({
            organizationId: "org-1",
            globalRuleIds: ["global-1"],
            organizationRuleIds: ["global-2", "org-1"],
            teamId: "team-unknown",
        })

        expect(result.isOk).toBe(true)
        expect(result.value.ruleIds).toEqual(["global-1", "global-2", "org-1"])
    })

    test("returns validation error for empty organizationId", async () => {
        const repository = createRuleRepository([])
        const useCase = new GetEnabledRulesUseCase({ruleRepository: repository})

        const result = await useCase.execute({
            organizationId: "   ",
            globalRuleIds: [],
        })

        expect(result.isFail).toBe(true)
        expect(result.error.code).toBe("VALIDATION_ERROR")
        expect(result.error.fields).toEqual([{
            field: "organizationId",
            message: "must be a non-empty string",
        }])
    })

    test("returns validation error for invalid global rule ids", async () => {
        const repository = createRuleRepository([])
        const useCase = new GetEnabledRulesUseCase({ruleRepository: repository})

        const result = await useCase.execute({
            organizationId: "org-1",
            globalRuleIds: ["" as unknown as string],
        })

        expect(result.isFail).toBe(true)
        expect(result.error.fields).toEqual([{
            field: "globalRuleIds",
            message: "must be an array of non-empty strings",
        }])
    })

    test("returns validation error when teamId is invalid type", async () => {
        const repository = createRuleRepository([])
        const useCase = new GetEnabledRulesUseCase({ruleRepository: repository})

        const result = await useCase.execute({
            organizationId: "org-1",
            teamId: 123 as unknown as string,
        })

        expect(result.isFail).toBe(true)
        expect(result.error.fields).toEqual([{
            field: "teamId",
            message: "must be a non-empty string when provided",
        }])
    })
})

function createRuleRepository(
    ruleRows: ReadonlyArray<{readonly id: string; readonly status: RuleStatus}>,
): IRuleRepository {
    const factory = new RuleFactory()

    const rules = ruleRows.map((item): Rule => {
        return factory.reconstitute({
            id: item.id,
            name: `Rule ${item.id}`,
            description: `Rule ${item.id} description`,
            expression: `rule_${item.id}_expression`,
            status: item.status,
            activatedAt: null,
            deactivatedAt: null,
            archivedAt: null,
        })
    })

    return {
        findById(): Promise<Rule | null> {
            return Promise.resolve(null)
        },
        save(): Promise<void> {
            return Promise.resolve()
        },
        findByStatus(status: RuleStatus): Promise<readonly Rule[]> {
            return Promise.resolve(rules.filter((item) => item.status === status))
        },
    }
}

function createTeamRuleProvider(
    configurations: Readonly<Record<string, {
        readonly ruleIds: readonly string[]
        readonly disabledRuleUuids: readonly string[]
    }>>,
): ITeamRuleProvider {
    return {
        getTeamRuleConfiguration(teamId: string) {
            return Promise.resolve(configurations[teamId] ?? null)
        },
    }
}
