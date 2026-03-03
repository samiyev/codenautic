import {describe, expect, test} from "bun:test"

import type {IOrganizationRepository} from "../../../../src/application/ports/outbound/organization-repository.port"
import type {ITeamRepository} from "../../../../src/application/ports/outbound/team-repository.port"
import type {IUserRepository} from "../../../../src/application/ports/outbound/user-repository.port"
import type {IProjectFilters, IProjectRepository} from "../../../../src/application/ports/outbound/project-repository.port"
import {Organization} from "../../../../src/domain/aggregates/organization.aggregate"
import {Team} from "../../../../src/domain/entities/team.entity"
import {Project} from "../../../../src/domain/entities/project.entity"
import {User as DomainUser} from "../../../../src/domain/entities/user.entity"
import {OrganizationFactory} from "../../../../src/domain/factories/organization.factory"
import {TeamFactory} from "../../../../src/domain/factories/team.factory"
import {ProjectFactory} from "../../../../src/domain/factories/project.factory"
import {UserFactory} from "../../../../src/domain/factories/user.factory"
import {OrganizationId} from "../../../../src/domain/value-objects/organization-id.value-object"
import {RepositoryId} from "../../../../src/domain/value-objects/repository-id.value-object"
import {UniqueId} from "../../../../src/domain/value-objects/unique-id.value-object"

class InMemoryOrganizationRepository implements IOrganizationRepository {
    private readonly storage: Map<string, Organization>

    public constructor() {
        this.storage = new Map<string, Organization>()
    }

    public findById(id: UniqueId): Promise<Organization | null> {
        return Promise.resolve(this.storage.get(id.value) ?? null)
    }

    public save(entity: Organization): Promise<void> {
        this.storage.set(entity.id.value, entity)
        return Promise.resolve()
    }

    public findByOwnerId(ownerId: UniqueId): Promise<readonly Organization[]> {
        return Promise.resolve(
            [...this.storage.values()].filter((organization) => {
                return organization.ownerId.value === ownerId.value
            }),
        )
    }
}

class InMemoryTeamRepository implements ITeamRepository {
    private readonly storage: Map<string, Team>

    public constructor() {
        this.storage = new Map<string, Team>()
    }

    public findById(id: UniqueId): Promise<Team | null> {
        return Promise.resolve(this.storage.get(id.value) ?? null)
    }

    public save(entity: Team): Promise<void> {
        this.storage.set(entity.id.value, entity)
        return Promise.resolve()
    }

    public findByOrganizationId(organizationId: UniqueId): Promise<readonly Team[]> {
        return Promise.resolve(
            [...this.storage.values()].filter((team) => {
                return team.organizationId.value === organizationId.value
            }),
        )
    }
}

class InMemoryProjectRepository implements IProjectRepository {
    private readonly storage: Map<string, Project>

    public constructor() {
        this.storage = new Map<string, Project>()
    }

    public findById(id: UniqueId): Promise<Project | null> {
        return Promise.resolve(this.storage.get(id.value) ?? null)
    }

    public save(entity: Project): Promise<void> {
        this.storage.set(entity.id.value, entity)
        return Promise.resolve()
    }

    public findByRepositoryId(repositoryId: RepositoryId): Promise<Project | null> {
        for (const project of this.storage.values()) {
            if (project.repositoryId.toString() === repositoryId.toString()) {
                return Promise.resolve(project)
            }
        }

        return Promise.resolve(null)
    }

    public findByOrganizationId(organizationId: OrganizationId): Promise<readonly Project[]> {
        return Promise.resolve(
            [...this.storage.values()].filter((project) => {
                return project.organizationId.value === organizationId.value
            }),
        )
    }

    public findAll(filters?: IProjectFilters): Promise<readonly Project[]> {
        return Promise.resolve(
            [...this.storage.values()].filter((project) => {
                if (filters?.organizationId !== undefined &&
                    project.organizationId.value !== filters.organizationId.value
                ) {
                    return false
                }

                if (filters?.repositoryId !== undefined &&
                    project.repositoryId.toString() !== filters.repositoryId.toString()
                ) {
                    return false
                }

                return true
            }),
        )
    }

    public count(filters?: IProjectFilters): Promise<number> {
        return this.findAll(filters).then((projects) => {
            return projects.length
        })
    }
}

class InMemoryUserRepository implements IUserRepository {
    private readonly storage: Map<string, DomainUser>

    public constructor() {
        this.storage = new Map<string, DomainUser>()
    }

    public findById(id: UniqueId): Promise<DomainUser | null> {
        return Promise.resolve(this.storage.get(id.value) ?? null)
    }

    public save(entity: DomainUser): Promise<void> {
        this.storage.set(entity.id.value, entity)
        return Promise.resolve()
    }

    public findByEmail(email: string): Promise<DomainUser | null> {
        const lowered = email.toLowerCase()
        for (const user of this.storage.values()) {
            if (user.email === lowered) {
                return Promise.resolve(user)
            }
        }
        return Promise.resolve(null)
    }
}

describe("IOrganizationRepository contract", () => {
    test("finds organization by owner identifier", async () => {
        const organizationFactory = new OrganizationFactory()
        const repository = new InMemoryOrganizationRepository()
        const ownerId = UniqueId.create("owner-1")
        const organization = organizationFactory.create({
            name: "Org team",
            ownerId: ownerId.value,
        })

        await repository.save(organization)
        const byOwner = await repository.findByOwnerId(ownerId)

        expect(byOwner).toHaveLength(1)
        expect(byOwner[0]?.id.equals(organization.id)).toBe(true)
    })
})

describe("ITeamRepository contract", () => {
    test("finds teams by organization identifier", async () => {
        const teamFactory = new TeamFactory()
        const repository = new InMemoryTeamRepository()
        const organization = UniqueId.create("org-1")
        const teamA = teamFactory.create({
            name: "Team A",
            organizationId: organization.value,
        })
        const teamB = teamFactory.create({
            name: "Team B",
            organizationId: "org-2",
        })

        await repository.save(teamA)
        await repository.save(teamB)

        const found = await repository.findByOrganizationId(organization)

        expect(found).toHaveLength(1)
        expect(found[0]?.name).toBe("Team A")
    })
})

describe("IUserRepository contract", () => {
    test("finds user by email", async () => {
        const userFactory = new UserFactory()
        const repository = new InMemoryUserRepository()
        const user = userFactory.create({
            email: "User@Example.com",
            displayName: "User",
            roles: ["MEMBER"],
            preferences: {
                theme: "DARK",
                language: "en",
                receiveEmailNotifications: true,
            },
            authProviders: ["github"],
        })

        await repository.save(user)

        const found = await repository.findByEmail("user@example.com")

        expect(found?.id.equals(user.id)).toBe(true)
        expect(found?.email).toBe("user@example.com")
    })
})

describe("IProjectRepository contract", () => {
    test("finds projects by repository and organization identifiers", async () => {
        const projectFactory = new ProjectFactory()
        const repository = new InMemoryProjectRepository()
        const repositoryIdA = RepositoryId.parse("gh:repo-1")
        const repositoryIdB = RepositoryId.parse("gl:repo-2")
        const orgId = OrganizationId.create("org-1")

        await repository.save(
            projectFactory.create({
                repositoryId: repositoryIdA.toString(),
                organizationId: orgId.value,
                settings: {
                    cadence: "manual",
                },
            }),
        )
        await repository.save(
            projectFactory.create({
                repositoryId: repositoryIdB.toString(),
                organizationId: orgId.value,
                settings: {
                    cadence: "automatic",
                },
            }),
        )

        const byRepository = await repository.findByRepositoryId(repositoryIdA)
        const byOrganization = await repository.findByOrganizationId(orgId)

        expect(byRepository?.repositoryId.toString()).toBe("gh:repo-1")
        expect(byOrganization).toHaveLength(2)
    })

    test("finds all projects using filters and counts", async () => {
        const projectFactory = new ProjectFactory()
        const repository = new InMemoryProjectRepository()
        const orgMain = OrganizationId.create("org-main")
        const orgOther = OrganizationId.create("org-other")

        await repository.save(
            projectFactory.create({
                repositoryId: "gh:repo-main",
                organizationId: orgMain.value,
            }),
        )
        await repository.save(
            projectFactory.create({
                repositoryId: "gl:repo-other",
                organizationId: orgMain.value,
            }),
        )
        await repository.save(
            projectFactory.create({
                repositoryId: "az:repo-third",
                organizationId: orgOther.value,
            }),
        )

        const allMainByFilters = await repository.findAll({
            organizationId: orgMain,
        })
        const countMain = await repository.count({
            organizationId: orgMain,
        })
        const allMainAndRepo = await repository.findAll({
            organizationId: orgMain,
            repositoryId: RepositoryId.parse("gl:repo-other"),
        })

        expect(allMainByFilters).toHaveLength(2)
        expect(countMain).toBe(2)
        expect(allMainAndRepo).toHaveLength(1)
        expect(allMainAndRepo[0]?.repositoryId.toString()).toBe("gl:repo-other")
    })
})
