import {describe, expect, test} from "bun:test"

import {
    AllowAllAuthService,
    DefaultRepositoryConfigLoader,
    MongoOrganizationConfigLoader,
    type IOrganizationConfigDocument,
    type IOrganizationConfigModel,
    type ISystemSettingDocument,
    type ISystemSettingsModel,
} from "../../src/database/adapters"

/**
 * Creates organization model test double.
 *
 * @param document Organization document.
 * @returns Model stub.
 */
function createOrganizationModel(
    document: IOrganizationConfigDocument | null,
): IOrganizationConfigModel {
    return {
        findOne(_filter): Promise<IOrganizationConfigDocument | null> {
            return Promise.resolve(document)
        },
    }
}

/**
 * Creates system settings model test double with captured keys.
 *
 * @param resolver Key-based resolver.
 * @returns Model stub.
 */
function createSystemSettingsModel(
    resolver: (key: string) => ISystemSettingDocument | null,
): ISystemSettingsModel {
    return {
        findOne(
            filter: Readonly<Record<string, unknown>>,
        ): Promise<ISystemSettingDocument | null> {
            const key = typeof filter["key"] === "string" ? filter["key"] : ""
            return Promise.resolve(resolver(key))
        },
    }
}

describe("database category D adapters", () => {
    test("AllowAllAuthService always allows access", async () => {
        const service = new AllowAllAuthService()

        const canAccess = await service.canAccess({
            actorId: "user-1",
            organizationId: "org-1",
            repositoryId: "repo-1",
            action: "review:write",
        })
        const authorized = await service.authorize({
            actorId: "user-2",
            organizationId: "org-2",
            action: "settings:read",
        })

        await service.assertCanAccess({
            actorId: "user-3",
            repositoryId: "repo-3",
            action: "review:delete",
        })

        expect(canAccess).toBe(true)
        expect(authorized).toBe(true)
    })

    test("MongoOrganizationConfigLoader merges organization and team review layers", async () => {
        const loader = new MongoOrganizationConfigLoader(
            createOrganizationModel({
                _id: "org-1",
                settings: {
                    "review.severityThreshold": "LOW",
                    "review.maxSuggestionsPerFile": 20,
                    "review.ignorePaths": "[\"dist/**\", \"coverage/**\"]",
                    "review.team.team-1.maxSuggestionsPerFile": 5,
                    "review.team.team-1.customRuleIds": "rule-1, rule-2",
                },
            }),
        )

        const layer = await loader.load("org-1", "team-1")

        expect(layer).not.toBeNull()
        expect(layer?.severityThreshold).toBe("LOW")
        expect(layer?.maxSuggestionsPerFile).toBe(5)
        expect(layer?.ignorePaths).toEqual(["dist/**", "coverage/**"])
        expect(layer?.customRuleIds).toEqual(["rule-1", "rule-2"])
    })

    test("DefaultRepositoryConfigLoader reads repository layer from settings storage", async () => {
        const settingsModel = createSystemSettingsModel((key) => {
            if (key === "review.repo.repo-1") {
                return {
                    key,
                    value: {
                        cadence: "manual",
                        maxSuggestionsPerCCR: 33,
                    },
                }
            }
            return null
        })
        const loader = new DefaultRepositoryConfigLoader({
            systemSettingsModel: settingsModel,
        })

        const layer = await loader.loadConfig("repo-1")

        expect(layer).toEqual({
            cadence: "manual",
            maxSuggestionsPerCCR: 33,
        })
    })

    test("DefaultRepositoryConfigLoader falls back to defaults and delegates organization layer", async () => {
        const organizationLoader = new MongoOrganizationConfigLoader(
            createOrganizationModel({
                _id: "org-1",
                settings: {
                    "review.severityThreshold": "HIGH",
                    "review.maxSuggestionsPerCCR": 42,
                },
            }),
        )
        const loader = new DefaultRepositoryConfigLoader({
            systemSettingsModel: createSystemSettingsModel(() => null),
            organizationConfigLoader: organizationLoader,
            fallbackDefaultLayer: {
                severityThreshold: "MEDIUM",
                ignorePaths: [],
                maxSuggestionsPerFile: 15,
                maxSuggestionsPerCCR: 60,
                cadence: "automatic",
                customRuleIds: [],
            },
        })

        const defaultLayer = await loader.loadDefault()
        const organizationLayer = await loader.loadOrganization("org-1", "team-1")

        expect(defaultLayer).toEqual({
            severityThreshold: "MEDIUM",
            ignorePaths: [],
            maxSuggestionsPerFile: 15,
            maxSuggestionsPerCCR: 60,
            cadence: "automatic",
            customRuleIds: [],
        })
        expect(organizationLayer).toEqual({
            severityThreshold: "HIGH",
            maxSuggestionsPerCCR: 42,
        })
    })
})
