import type {OrganizationId} from "../../../domain/value-objects/organization-id.value-object"
import type {PromptConfiguration} from "../../../domain/entities/prompt-configuration.entity"

/**
 * Outbound persistence contract for prompt configurations.
 */
export interface IPromptConfigurationRepository {
    /**
     * Finds configuration by template identifier.
     *
     * @param templateId Template identifier.
     * @returns Matching configuration or null.
     */
    findByTemplateId(templateId: string): Promise<PromptConfiguration | null>

    /**
     * Finds configuration by configuration name.
     *
     * @param name Config name.
     * @param organizationId Optional organization scope.
     * @returns Matching configuration or null.
     */
    findByName(name: string, organizationId?: OrganizationId): Promise<PromptConfiguration | null>

    /**
     * Persists configuration entity.
     *
     * @param configuration Configuration entity.
     */
    save(configuration: PromptConfiguration): Promise<void>

    /**
     * Deletes configuration entity.
     *
     * @param id Configuration identifier.
     */
    delete(id: string): Promise<void>
}
