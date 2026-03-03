import type {IProjectFilters, IProjectRepository} from "../../../../src/application/ports/outbound/project-repository.port"
import {Project} from "../../../../src/domain/entities/project.entity"
import {OrganizationId} from "../../../../src/domain/value-objects/organization-id.value-object"
import {RepositoryId} from "../../../../src/domain/value-objects/repository-id.value-object"
import {UniqueId} from "../../../../src/domain/value-objects/unique-id.value-object"

/**
 * In-memory implementation of project repository for unit tests.
 */
export class InMemoryProjectRepository implements IProjectRepository {
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

    public delete(id: UniqueId): Promise<void> {
        this.storage.delete(id.value)
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
