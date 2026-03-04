/**
 * Prompt configuration payload delivered by config defaults.
 */
export interface IPromptConfigurationConfigData {
    /**
     * Prompt template name that configuration targets.
     */
    readonly name: string

    /**
     * Default template variables map.
     */
    readonly defaults: Record<string, unknown>

    /**
     * Optional override values for variables.
     */
    readonly overrides?: Record<string, unknown>

    /**
     * Global configuration flag.
     */
    readonly isGlobal?: boolean

    /**
     * Optional organization scope identifier.
     */
    readonly organizationId?: string | null
}
