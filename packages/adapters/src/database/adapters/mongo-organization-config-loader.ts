import type {IReviewConfigDTO} from "@codenautic/core"

import {
    extractReviewConfigLayerByPrefix,
    type SettingsMapInput,
} from "./review-config-layer-normalizer"

/**
 * Organization persistence document used by config loader.
 */
export interface IOrganizationConfigDocument {
    readonly _id: string
    readonly settings: SettingsMapInput
}

/**
 * Minimal organization model contract used by config loader.
 */
export interface IOrganizationConfigModel {
    /**
     * Finds organization by filter.
     *
     * @param filter Mongo-like filter object.
     * @returns Organization document or null.
     */
    findOne(filter: Readonly<Record<string, unknown>>): Promise<IOrganizationConfigDocument | null>
}

/**
 * Mongo-backed organization config loader.
 */
export class MongoOrganizationConfigLoader {
    private readonly organizationModel: IOrganizationConfigModel

    /**
     * Creates loader instance.
     *
     * @param organizationModel Organization model dependency.
     */
    public constructor(organizationModel: IOrganizationConfigModel) {
        this.organizationModel = organizationModel
    }

    /**
     * Loads organization-level review config with team overrides.
     *
     * @param organizationId Organization identifier.
     * @param teamId Team identifier.
     * @returns Partial review config layer or null when missing.
     */
    public async load(
        organizationId: string,
        teamId: string,
    ): Promise<Partial<IReviewConfigDTO> | null> {
        const document = await this.organizationModel.findOne({
            _id: organizationId,
        })
        if (document === null) {
            return null
        }

        const organizationLayer = extractReviewConfigLayerByPrefix(
            document.settings,
            "review.",
        )
        const teamLayer = extractReviewConfigLayerByPrefix(
            document.settings,
            `review.team.${teamId}.`,
        )

        const mergedLayer: Partial<IReviewConfigDTO> = {
            ...organizationLayer,
            ...teamLayer,
        }
        if (Object.keys(mergedLayer).length === 0) {
            return null
        }

        return mergedLayer
    }
}
