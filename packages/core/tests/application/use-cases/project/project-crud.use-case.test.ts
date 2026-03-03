import {describe, expect, test} from "bun:test"

import {CreateProjectUseCase} from "../../../../src/application/use-cases/create-project.use-case"
import {DeleteProjectUseCase} from "../../../../src/application/use-cases/delete-project.use-case"
import {GetProjectByIdUseCase} from "../../../../src/application/use-cases/get-project-by-id.use-case"
import {GetProjectGraphUseCase} from "../../../../src/application/use-cases/get-project-graph.use-case"
import {ListProjectsUseCase} from "../../../../src/application/use-cases/list-projects.use-case"
import {UpdateProjectUseCase} from "../../../../src/application/use-cases/update-project.use-case"
import {ValidationError} from "../../../../src/domain/errors/validation.error"
import {ProjectFactory} from "../../../../src/domain/factories/project.factory"
import {InMemoryProjectRepository} from "./project-repository.test-helper"

describe("CreateProjectUseCase", () => {
    test("creates project and returns dto", async () => {
        const projectRepository = new InMemoryProjectRepository()
        const projectFactory = new ProjectFactory()
        const useCase = new CreateProjectUseCase({
            projectRepository,
            projectFactory,
        })

        const result = await useCase.execute({
            repositoryId: "gh:repo-1",
            organizationId: "org-1",
            settings: {
                cadence: "manual",
                customRuleIds: ["rule-1", "rule-1", "rule-2"],
            },
            integrations: ["WebHook", "Slack"],
        })

        expect(result.isOk).toBe(true)
        expect(result.value.project.repositoryId).toBe("gh:repo-1")
        expect(result.value.project.organizationId).toBe("org-1")
        expect(result.value.project.settings.cadence).toBe("manual")
        expect(result.value.project.settings.customRuleIds).toEqual(["rule-1", "rule-2"])
        expect(result.value.project.integrations).toEqual(["webhook", "slack"])
        expect(result.value.project.id).toHaveLength(36)
    })

    test("rejects duplicate repository id", async () => {
        const projectRepository = new InMemoryProjectRepository()
        const projectFactory = new ProjectFactory()
        const useCase = new CreateProjectUseCase({
            projectRepository,
            projectFactory,
        })

        await projectRepository.save(
            projectFactory.create({
                repositoryId: "gh:repo-existing",
                organizationId: "org-1",
            }),
        )

        const result = await useCase.execute({
            repositoryId: "gh:repo-existing",
            organizationId: "org-2",
        })

        expect(result.isFail).toBe(true)
        expect(result.error.code).toBe("VALIDATION_ERROR")
        expect(result.error.fields).toEqual([
            {
                field: "repositoryId",
                message: "Project for repository 'gh:repo-existing' already exists",
            },
        ])
    })

    test("returns field-level errors for invalid input", async () => {
        const useCase = new CreateProjectUseCase({
            projectRepository: new InMemoryProjectRepository(),
            projectFactory: new ProjectFactory(),
        })

        const badRepositoryFormat = await useCase.execute({
            repositoryId: "bad-repo",
            organizationId: "org-1",
        })
        const badOrganization = await useCase.execute({
            repositoryId: "gh:repo-2",
            organizationId: "bad org",
        })
        const badSettings = await useCase.execute({
            repositoryId: "gl:repo-3",
            settings: {
                cadence: "nope",
            },
        })
        const badIntegrations = await useCase.execute({
            repositoryId: "az:repo-4",
            integrations: [""],
        })

        expect(badRepositoryFormat.isFail).toBe(true)
        expect(badRepositoryFormat.error.fields[0]?.field).toBe("repositoryId")
        expect(badOrganization.isFail).toBe(true)
        expect(badOrganization.error.fields[0]?.field).toBe("organizationId")
        expect(badSettings.isFail).toBe(true)
        expect(badSettings.error.fields[0]?.field).toBe("settings")
        expect(badIntegrations.isFail).toBe(true)
        expect(badIntegrations.error.fields[0]?.field).toBe("integrations")
    })
})

describe("GetProjectByIdUseCase", () => {
    test("returns project by identifier", async () => {
        const projectRepository = new InMemoryProjectRepository()
        const projectFactory = new ProjectFactory()
        const project = projectFactory.create({
            repositoryId: "gh:get-repo",
            organizationId: "org-1",
        })
        await projectRepository.save(project)

        const useCase = new GetProjectByIdUseCase(projectRepository)
        const result = await useCase.execute({
            projectId: project.id.value,
        })

        expect(result.isOk).toBe(true)
        expect(result.value.project.id).toBe(project.id.value)
        expect(result.value.project.repositoryId).toBe("gh:get-repo")
    })

    test("returns validation error for invalid project id", async () => {
        const useCase = new GetProjectByIdUseCase(new InMemoryProjectRepository())
        const result = await useCase.execute({
            projectId: " ",
        })

        expect(result.isFail).toBe(true)
        expect(result.error).toBeInstanceOf(ValidationError)
        expect(result.error.fields).toEqual([
            {
                field: "projectId",
                message: "must be a non-empty string",
            },
        ])
    })

    test("returns error when project not found", async () => {
        const useCase = new GetProjectByIdUseCase(new InMemoryProjectRepository())
        const result = await useCase.execute({
            projectId: "non-existing-id",
        })

        expect(result.isFail).toBe(true)
        expect(result.error.fields).toEqual([
            {
                field: "projectId",
                message: "Project 'non-existing-id' not found",
            },
        ])
    })
})

describe("ListProjectsUseCase", () => {
    test("returns filtered project list and total count", async () => {
        const projectRepository = new InMemoryProjectRepository()
        const projectFactory = new ProjectFactory()

        await projectRepository.save(
            projectFactory.create({
                repositoryId: "gh:list-a",
                organizationId: "org-main",
            }),
        )
        await projectRepository.save(
            projectFactory.create({
                repositoryId: "gl:list-b",
                organizationId: "org-main",
            }),
        )
        await projectRepository.save(
            projectFactory.create({
                repositoryId: "az:list-c",
                organizationId: "org-other",
            }),
        )

        const useCase = new ListProjectsUseCase(projectRepository)

        const byOrganization = await useCase.execute({
            organizationId: "org-main",
        })
        const byRepository = await useCase.execute({
            repositoryId: "gh:list-a",
        })
        const all = await useCase.execute({})
        const invalidFilter = await useCase.execute({
            repositoryId: "wrong-format",
        })

        expect(byOrganization.isOk).toBe(true)
        expect(byOrganization.value.projects).toHaveLength(2)
        expect(byOrganization.value.totalCount).toBe(2)
        expect(byRepository.isOk).toBe(true)
        expect(byRepository.value.projects).toHaveLength(1)
        expect(byRepository.value.projects[0]?.repositoryId).toBe("gh:list-a")
        expect(all.isOk).toBe(true)
        expect(all.value.totalCount).toBe(3)
        expect(invalidFilter.isFail).toBe(true)
        expect(invalidFilter.error.fields).toEqual([
            {
                field: "repositoryId",
                message: "RepositoryId must match format <platform>:<id>",
            },
        ])
    })
})

describe("UpdateProjectUseCase", () => {
    test("updates project settings and adds integrations", async () => {
        const projectRepository = new InMemoryProjectRepository()
        const projectFactory = new ProjectFactory()
        const project = projectFactory.create({
            repositoryId: "gh:update-repo",
            organizationId: "org-1",
            integrations: ["slack"],
            settings: {
                cadence: "manual",
            },
        })
        await projectRepository.save(project)

        const useCase = new UpdateProjectUseCase(projectRepository)
        const result = await useCase.execute({
            projectId: project.id.value,
            settings: {
                severity: "HIGH",
            },
            integrationsToAdd: ["webhook"],
        })

        expect(result.isOk).toBe(true)
        expect(result.value.project.settings.severity).toBe("HIGH")
        expect(result.value.project.integrations).toEqual(["slack", "webhook"])
    })

    test("returns error when integration is duplicated", async () => {
        const projectRepository = new InMemoryProjectRepository()
        const projectFactory = new ProjectFactory()
        const project = projectFactory.create({
            repositoryId: "gh:update-dup",
            organizationId: "org-1",
            integrations: ["slack"],
        })
        await projectRepository.save(project)

        const useCase = new UpdateProjectUseCase(projectRepository)
        const result = await useCase.execute({
            projectId: project.id.value,
            integrationsToAdd: ["slack"],
        })

        expect(result.isFail).toBe(true)
        expect(result.error.fields).toEqual([
            {
                field: "integrationsToAdd",
                message: "Integration slack already exists",
            },
        ])
    })

    test("returns not-found when project does not exist", async () => {
        const useCase = new UpdateProjectUseCase(new InMemoryProjectRepository())
        const result = await useCase.execute({
            projectId: "does-not-exist",
            settings: {
                severity: "LOW",
            },
        })

        expect(result.isFail).toBe(true)
        expect(result.error.fields).toEqual([
            {
                field: "projectId",
                message: "projectId not found",
            },
        ])
    })
})

describe("DeleteProjectUseCase", () => {
    test("deletes existing project", async () => {
        const projectRepository = new InMemoryProjectRepository()
        const projectFactory = new ProjectFactory()
        const project = projectFactory.create({
            repositoryId: "gh:delete-repo",
            organizationId: "org-1",
        })
        await projectRepository.save(project)

        const useCase = new DeleteProjectUseCase(projectRepository)
        const result = await useCase.execute({
            projectId: project.id.value,
        })

        expect(result.isOk).toBe(true)
        expect(result.value.projectId).toBe(project.id.value)

        const afterDelete = await useCase.execute({
            projectId: project.id.value,
        })
        expect(afterDelete.isFail).toBe(true)
        expect(afterDelete.error.fields).toEqual([
            {
                field: "projectId",
                message: `Project '${project.id.value}' not found`,
            },
        ])
    })

    test("returns validation error for invalid project id", async () => {
        const useCase = new DeleteProjectUseCase(new InMemoryProjectRepository())
        const result = await useCase.execute({
            projectId: "",
        })

        expect(result.isFail).toBe(true)
        expect(result.error.fields).toEqual([
            {
                field: "projectId",
                message: "must be a non-empty string",
            },
        ])
    })
})

describe("GetProjectGraphUseCase", () => {
    test("returns normalized graph representation", async () => {
        const projectRepository = new InMemoryProjectRepository()
        const projectFactory = new ProjectFactory()
        const project = projectFactory.create({
            repositoryId: "gh:graph-repo",
            organizationId: "org-1",
            settings: {
                customRuleIds: ["rule-a", "rule-b"],
            },
            integrations: ["Slack", "Webhook"],
        })
        await projectRepository.save(project)

        const useCase = new GetProjectGraphUseCase(projectRepository)
        const result = await useCase.execute({
            projectId: project.id.value,
        })

        expect(result.isOk).toBe(true)
        expect(result.value.graph.nodes).toEqual([
            {id: project.id.value, type: "project", label: "project"},
            {id: `${project.id.value}:rule:rule-a`, type: "rule", label: "rule-a"},
            {id: `${project.id.value}:rule:rule-b`, type: "rule", label: "rule-b"},
            {id: `${project.id.value}:integration:slack`, type: "integration", label: "slack"},
            {id: `${project.id.value}:integration:webhook`, type: "integration", label: "webhook"},
        ])
        expect(result.value.graph.edges).toEqual([
            {
                from: project.id.value,
                to: `${project.id.value}:rule:rule-a`,
                relation: "uses-custom-rule",
            },
            {
                from: project.id.value,
                to: `${project.id.value}:rule:rule-b`,
                relation: "uses-custom-rule",
            },
            {
                from: project.id.value,
                to: `${project.id.value}:integration:slack`,
                relation: "uses-integration",
            },
            {
                from: project.id.value,
                to: `${project.id.value}:integration:webhook`,
                relation: "uses-integration",
            },
        ])
    })

    test("returns error when project does not exist", async () => {
        const useCase = new GetProjectGraphUseCase(new InMemoryProjectRepository())
        const result = await useCase.execute({
            projectId: "missing-project",
        })

        expect(result.isFail).toBe(true)
        expect(result.error.fields).toEqual([
            {
                field: "projectId",
                message: "Project 'missing-project' not found",
            },
        ])
    })
})
