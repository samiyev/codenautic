import {describe, expect, test} from "bun:test"

import type {
    ITeamRuleConfiguration,
    ITeamRuleProvider,
} from "../../../../src/application/ports/outbound/rule/team-rule-provider.port"

class InMemoryTeamRuleProvider implements ITeamRuleProvider {
    public readonly configurations: ReadonlyMap<string, ITeamRuleConfiguration> = new Map<
        string,
        ITeamRuleConfiguration
    >([
        ["team-1", {ruleIds: ["team-rule-1"], disabledRuleUuids: ["global-rule-2"]}],
        ["team-2", {ruleIds: ["team-rule-2"], disabledRuleUuids: []}],
    ])

    public getTeamRuleConfiguration(teamId: string): Promise<ITeamRuleConfiguration | null> {
        return Promise.resolve(this.configurations.get(teamId) ?? null)
    }
}

describe("ITeamRuleProvider contract", () => {
    test("returns configuration when team exists", async () => {
        const provider = new InMemoryTeamRuleProvider()
        const configuration = await provider.getTeamRuleConfiguration("team-1")

        expect(configuration).toEqual({
            ruleIds: ["team-rule-1"],
            disabledRuleUuids: ["global-rule-2"],
        })
    })

    test("returns null for unknown team", async () => {
        const provider = new InMemoryTeamRuleProvider()
        const configuration = await provider.getTeamRuleConfiguration("unknown-team")

        expect(configuration).toBeNull()
    })
})
