import {describe, expect, test} from "bun:test"

import type {
    ILibraryRuleFilters,
    ILibraryRuleRepository,
} from "../../../../src/application/ports/outbound/rule/library-rule-repository.port"
import type {ITeamRuleProvider} from "../../../../src/application/ports/outbound/rule/team-rule-provider.port"
import {GetEnabledRulesUseCase} from "../../../../src/application/use-cases/rules/get-enabled-rules.use-case"
import type {LibraryRule} from "../../../../src/domain/entities/library-rule.entity"
import {LibraryRuleFactory} from "../../../../src/domain/factories/library-rule.factory"
import {OrganizationId} from "../../../../src/domain/value-objects/organization-id.value-object"
import {UniqueId} from "../../../../src/domain/value-objects/unique-id.value-object"

describe("GetEnabledRulesUseCase", () => {
    test("merges global and organization rules by library uuid", async () => {
        const repository = createLibraryRuleRepository([
            {uuid: "global-1", isGlobal: true},
            {uuid: "global-2", isGlobal: true},
            {uuid: "org-1", organizationId: "org-1"},
            {uuid: "other-org", organizationId: "org-2"},
        ])
        const useCase = new GetEnabledRulesUseCase({libraryRuleRepository: repository})

        const result = await useCase.execute({
            organizationId: "org-1",
            globalRuleIds: ["global-1", "global-2"],
            organizationRuleIds: ["global-2", "org-1", "other-org", "missing"],
        })

        expect(result.isOk).toBe(true)
        expect(result.value.ruleIds).toEqual(["global-1", "global-2", "org-1"])
    })

    test("applies team overrides and disabled uuids", async () => {
        const repository = createLibraryRuleRepository([
            {uuid: "global-1", isGlobal: true},
            {uuid: "global-2", isGlobal: true},
            {uuid: "org-1", organizationId: "org-1"},
            {uuid: "team-1", organizationId: "org-1"},
        ])
        const provider = createTeamRuleProvider({
            "team-1": {
                ruleIds: ["team-1", "global-1"],
                disabledRuleUuids: ["global-2"],
            },
        })
        const useCase = new GetEnabledRulesUseCase({
            libraryRuleRepository: repository,
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

    test("falls back to global and organization layers when team provider is missing", async () => {
        const repository = createLibraryRuleRepository([
            {uuid: "global-1", isGlobal: true},
            {uuid: "global-2", isGlobal: true},
            {uuid: "org-1", organizationId: "org-1"},
        ])
        const useCase = new GetEnabledRulesUseCase({libraryRuleRepository: repository})

        const result = await useCase.execute({
            organizationId: "org-1",
            globalRuleIds: ["global-1"],
            organizationRuleIds: ["global-2", "org-1"],
            teamId: "team-unknown",
        })

        expect(result.isOk).toBe(true)
        expect(result.value.ruleIds).toEqual(["global-1", "global-2", "org-1"])
    })

    test("ignores rules outside global and target organization scope", async () => {
        const repository = createLibraryRuleRepository([
            {uuid: "global-1", isGlobal: true},
            {uuid: "org-1", organizationId: "org-1"},
            {uuid: "foreign-org-1", organizationId: "org-2"},
        ])
        const provider = createTeamRuleProvider({
            "team-1": {
                ruleIds: ["foreign-org-1", "org-1"],
                disabledRuleUuids: [],
            },
        })
        const useCase = new GetEnabledRulesUseCase({
            libraryRuleRepository: repository,
            teamRuleProvider: provider,
        })

        const result = await useCase.execute({
            organizationId: "org-1",
            globalRuleIds: ["global-1", "foreign-org-1"],
            organizationRuleIds: ["org-1"],
            teamId: "team-1",
        })

        expect(result.isOk).toBe(true)
        expect(result.value.ruleIds).toEqual(["global-1", "org-1"])
    })

    test("returns validation error for empty organizationId", async () => {
        const repository = createLibraryRuleRepository([])
        const useCase = new GetEnabledRulesUseCase({libraryRuleRepository: repository})

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
        const repository = createLibraryRuleRepository([])
        const useCase = new GetEnabledRulesUseCase({libraryRuleRepository: repository})

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
        const repository = createLibraryRuleRepository([])
        const useCase = new GetEnabledRulesUseCase({libraryRuleRepository: repository})

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

function createLibraryRuleRepository(
    ruleRows: ReadonlyArray<{
        readonly uuid: string
        readonly isGlobal?: boolean
        readonly organizationId?: string
    }>,
): ILibraryRuleRepository {
    const factory = new LibraryRuleFactory()
    const rules = ruleRows.map((item): LibraryRule => {
        return factory.create({
            uuid: item.uuid,
            title: `Rule ${item.uuid}`,
            rule: `Rule body ${item.uuid}`,
            whyIsThisImportant: `Rule importance ${item.uuid}`,
            severity: "MEDIUM",
            examples: [{
                snippet: `bad ${item.uuid}`,
                isCorrect: false,
            }],
            language: "ts",
            buckets: ["maintainability"],
            scope: "FILE",
            plugAndPlay: true,
            ...(item.isGlobal === true
                ? {
                    isGlobal: true,
                }
                : {
                    organizationId: item.organizationId ?? "org-1",
                }),
        })
    })
    const rulesByUuid = new Map<string, LibraryRule>(
        rules.map((rule): [string, LibraryRule] => {
            return [rule.uuid, rule]
        }),
    )

    return {
        findById(id: UniqueId): Promise<LibraryRule | null> {
            const rule = rules.find((item) => item.id.equals(id))
            return Promise.resolve(rule ?? null)
        },
        save(_entity: LibraryRule): Promise<void> {
            return Promise.resolve()
        },
        findByUuid(ruleUuid: string): Promise<LibraryRule | null> {
            return Promise.resolve(rulesByUuid.get(ruleUuid) ?? null)
        },
        findByLanguage(_language: string): Promise<readonly LibraryRule[]> {
            return Promise.resolve([])
        },
        findByCategory(_category: string): Promise<readonly LibraryRule[]> {
            return Promise.resolve([])
        },
        findGlobal(): Promise<readonly LibraryRule[]> {
            return Promise.resolve(rules.filter((rule) => rule.isGlobal === true))
        },
        findByOrganization(organizationId: OrganizationId): Promise<readonly LibraryRule[]> {
            return Promise.resolve(rules.filter((rule) => {
                return rule.organizationId?.value === organizationId.value
            }))
        },
        count(_filters: ILibraryRuleFilters): Promise<number> {
            return Promise.resolve(rules.length)
        },
        saveMany(_rules: readonly LibraryRule[]): Promise<void> {
            return Promise.resolve()
        },
        delete(_id: UniqueId): Promise<void> {
            return Promise.resolve()
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
