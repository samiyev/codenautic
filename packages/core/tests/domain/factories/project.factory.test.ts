import {describe, expect, test} from "bun:test"

import {ProjectFactory} from "../../../src/domain/factories/project.factory"

describe("ProjectFactory", () => {
    test("creates project with normalized fields", () => {
        const factory = new ProjectFactory()
        const project = factory.create({
            repositoryId: " gh:repo-1 ",
            organizationId: "org-1",
            integrations: [" API ", "API"],
            settings: {
                severity: "high",
                ignorePaths: [" src/** "],
            },
        })

        expect(project.repositoryId.toString()).toBe("gh:repo-1")
        expect(project.organizationId.value).toBe("org-1")
        expect(project.integrations).toEqual(["api"])
        expect(project.settings.severity).toBe("HIGH")
        expect(project.settings.ignorePaths).toEqual(["src/**"])
    })

    test("reconstitutes project snapshot from persistence", () => {
        const factory = new ProjectFactory()
        const project = factory.reconstitute({
            id: "project-1",
            repositoryId: "gl:repo-2",
            organizationId: "org-2",
            integrations: ["web", "web"],
            settings: {
                cadence: "manual",
                customRuleIds: ["rule-2", "rule-3"],
            },
        })

        expect(project.id.value).toBe("project-1")
        expect(project.repositoryId.platform).toBe("gl")
        expect(project.integrations).toEqual(["web"])
        expect(project.settings.customRuleIds).toEqual(["rule-2", "rule-3"])
    })
})
