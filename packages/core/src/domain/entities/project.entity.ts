import {OrganizationId} from "../value-objects/organization-id.value-object"
import {RepositoryId} from "../value-objects/repository-id.value-object"
import {UniqueId} from "../value-objects/unique-id.value-object"
import {
    type IProjectSettingsInput,
    ProjectSettings,
} from "../value-objects/project-settings.value-object"
import {Entity} from "./entity"

/**
 * Project state container.
 */
export interface IProjectProps {
    repositoryId: RepositoryId
    organizationId: OrganizationId
    settings: ProjectSettings
    integrations: string[]
}

/**
 * Domain project entity.
 */
export class Project extends Entity<IProjectProps> {
    /**
     * Creates project entity.
     *
     * @param id Entity identifier.
     * @param props Entity props.
     */
    public constructor(id: UniqueId, props: IProjectProps) {
        super(id, props)
        this.props.repositoryId = props.repositoryId
        this.props.organizationId = props.organizationId
        this.props.settings = props.settings
        this.props.integrations = normalizeIntegrations(props.integrations)
        this.ensureStateIsValid()
    }

    /**
     * Repository identifier.
     *
     * @returns Repository id.
     */
    public get repositoryId(): RepositoryId {
        return this.props.repositoryId
    }

    /**
     * Owning organization identifier.
     *
     * @returns Organization id.
     */
    public get organizationId(): OrganizationId {
        return this.props.organizationId
    }

    /**
     * Project settings.
     *
     * @returns Current settings.
     */
    public get settings(): ProjectSettings {
        return this.props.settings
    }

    /**
     * Enabled external project integrations.
     *
     * @returns Copy of integration names.
     */
    public get integrations(): readonly string[] {
        return [...this.props.integrations]
    }

    /**
     * Updates project settings with partial payload.
     *
     * @param settings Settings patch.
     */
    public updateSettings(settings: IProjectSettingsInput): void {
        this.props.settings = this.props.settings.merge(settings)
    }

    /**
     * Adds integration endpoint/type.
     *
     * @param integration Integration value.
     */
    public addIntegration(integration: string): void {
        const normalizedIntegration = normalizeIntegration(integration)

        if (this.hasIntegration(normalizedIntegration)) {
            throw new Error(`Integration ${normalizedIntegration} already exists`)
        }

        this.props.integrations = [...this.props.integrations, normalizedIntegration]
    }

    /**
     * Validates invariants.
     */
    private ensureStateIsValid(): void {
        if (this.props.repositoryId === undefined) {
            throw new Error("Project repositoryId must be defined")
        }

        if (this.props.organizationId === undefined) {
            throw new Error("Project organizationId must be defined")
        }

        if (this.props.settings === undefined) {
            throw new Error("Project settings must be defined")
        }
    }

    /**
     * Checks integration existence.
     */
    private hasIntegration(integration: string): boolean {
        return this.props.integrations.some((item) => item === integration)
    }
}

/**
 * Normalizes integration value.
 */
function normalizeIntegration(integration: string): string {
    const normalizedIntegration = integration.trim().toLowerCase()
    if (normalizedIntegration.length === 0) {
        throw new Error("Integration cannot be empty")
    }

    return normalizedIntegration
}

/**
 * Normalizes integration list and removes duplicates.
 */
function normalizeIntegrations(integrations: readonly string[]): string[] {
    const normalizedIntegrations = integrations.map((integration) => {
        return normalizeIntegration(integration)
    })
    const uniqueIntegrations = new Map<string, string>()

    for (const integration of normalizedIntegrations) {
        uniqueIntegrations.set(integration, integration)
    }

    return [...uniqueIntegrations.values()]
}
