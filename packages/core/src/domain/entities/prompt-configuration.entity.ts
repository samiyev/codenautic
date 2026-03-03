import {Entity} from "./entity"
import {OrganizationId} from "../value-objects/organization-id.value-object"
import {UniqueId} from "../value-objects/unique-id.value-object"

/**
 * Prompt configuration metadata.
 */
export interface IPromptConfigurationProps {
    /**
     * Template that configuration belongs to.
     */
    templateId: UniqueId

    /**
     * Configuration name.
     */
    name: string

    /**
     * Default values used in prompt rendering.
     */
    defaults: Record<string, unknown>

    /**
     * Per-team/project overrides.
     */
    overrides: Record<string, unknown>

    /**
     * Indicates if configuration is shared globally.
     */
    isGlobal: boolean

    /**
     * Organization scope identifier, optional for global configuration.
     */
    organizationId?: OrganizationId
}

/**
 * Configuration entity for prompt composition.
 */
export class PromptConfiguration extends Entity<IPromptConfigurationProps> {
    /**
     * Creates prompt configuration.
     *
     * @param id Entity identifier.
     * @param props Configuration props.
     */
    public constructor(id: UniqueId, props: IPromptConfigurationProps) {
        super(id, props)
        this.props.templateId = props.templateId
        this.props.name = normalizeName(props.name)
        this.props.defaults = normalizeVariablesMap(props.defaults)
        this.props.overrides = normalizeVariablesMap(props.overrides)
        this.props.isGlobal = props.isGlobal
        this.props.organizationId = normalizeOrganizationId(props.organizationId)
        this.validateState()
    }

    /**
     * Linked prompt template id.
     *
     * @returns Template id.
     */
    public get templateId(): UniqueId {
        return this.props.templateId
    }

    /**
     * Configuration name.
     *
     * @returns Config name.
     */
    public get name(): string {
        return this.props.name
    }

    /**
     * Default rendering values.
     *
     * @returns Copy of defaults.
     */
    public get defaults(): Record<string, unknown> {
        return {...this.props.defaults}
    }

    /**
     * Overrides for rendering variables.
     *
     * @returns Copy of overrides.
     */
    public get overrides(): Record<string, unknown> {
        return {...this.props.overrides}
    }

    /**
     * Global configuration flag.
     *
     * @returns True when global.
     */
    public get isGlobal(): boolean {
        return this.props.isGlobal
    }

    /**
     * Organization identifier for scoped configuration.
     *
     * @returns Organization id when not global.
     */
    public get organizationId(): OrganizationId | undefined {
        return this.props.organizationId
    }

    /**
     * Validates configuration state.
     */
    private validateState(): void {
        if (this.props.isGlobal === true) {
            if (this.props.organizationId !== undefined) {
                throw new Error("Global configuration cannot have organizationId")
            }
            return
        }

        if (this.props.organizationId === undefined) {
            throw new Error("Non-global configuration must have organizationId")
        }
    }
}

/**
 * Normalizes configuration name.
 *
 * @param value Raw name.
 * @returns Trimmed name.
 */
function normalizeName(value: string): string {
    const normalized = value.trim()
    if (normalized.length === 0) {
        throw new Error("Prompt configuration name cannot be empty")
    }

    return normalized
}

/**
 * Normalizes organizationId field.
 *
 * @param value Organization identifier.
 * @returns OrganizationId when provided.
 */
function normalizeOrganizationId(value: OrganizationId | undefined): OrganizationId | undefined {
    if (value === undefined) {
        return undefined
    }

    return value
}

/**
 * Normalizes variables map.
 *
 * @param value Raw values map.
 * @returns Shallow copy of values map.
 */
function normalizeVariablesMap(value: Record<string, unknown>): Record<string, unknown> {
    if (value === undefined || value === null) {
        return {}
    }

    const result: Record<string, unknown> = {}

    for (const key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
            const trimmedKey = key.trim()
            if (trimmedKey.length > 0) {
                result[trimmedKey] = value[key]
            }
        }
    }

    return result
}
