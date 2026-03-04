import {Project, type IProjectProps} from "../entities/project.entity"
import {OrganizationId} from "../value-objects/organization-id.value-object"
import {RepositoryId} from "../value-objects/repository-id.value-object"
import {UniqueId} from "../value-objects/unique-id.value-object"
import {
    type IProjectSettingsInput,
    ProjectSettings,
} from "../value-objects/project-settings.value-object"
import {type IEntityFactory} from "./entity-factory.interface"

/**
 * Payload for creating project.
 */
export interface ICreateProjectProps {
    repositoryId: string
    organizationId?: string | null
    settings?: IProjectSettingsInput
    integrations?: readonly string[]
}

/**
 * Persistence snapshot for project reconstitution.
 */
export interface IReconstituteProjectProps {
    id: string
    repositoryId: string
    organizationId?: string | null
    settings?: IProjectSettingsInput
    integrations?: readonly string[]
}

/**
 * Factory for project entity creation and restoration.
 */
export class ProjectFactory implements IEntityFactory<Project, ICreateProjectProps, IReconstituteProjectProps> {
    /**
     * Creates factory instance.
     */
    public constructor() {}

    /**
     * Creates new project.
     *
     * @param input Input payload.
     * @returns New project entity.
     */
    public create(input: ICreateProjectProps): Project {
        const props: IProjectProps = {
            repositoryId: RepositoryId.parse(input.repositoryId),
            organizationId: OrganizationId.create(input.organizationId),
            settings: ProjectSettings.create(input.settings),
            integrations: [...(input.integrations ?? [])],
        }

        return new Project(UniqueId.create(), props)
    }

    /**
     * Reconstitutes project from persistence snapshot.
     *
     * @param input Snapshot payload.
     * @returns Restored project entity.
     */
    public reconstitute(input: IReconstituteProjectProps): Project {
        const props: IProjectProps = {
            repositoryId: RepositoryId.parse(input.repositoryId),
            organizationId: OrganizationId.create(input.organizationId),
            settings: ProjectSettings.create(input.settings),
            integrations: [...(input.integrations ?? [])],
        }

        return new Project(UniqueId.create(input.id), props)
    }
}
