import type {IRepositoryConfigLoader, IReviewConfigDTO} from "@codenautic/core"

import {MongoOrganizationConfigLoader} from "./mongo-organization-config-loader"
import {normalizeReviewConfigLayer} from "./review-config-layer-normalizer"

const REVIEW_DEFAULTS_SETTINGS_KEY = "review.defaults"
const REVIEW_REPOSITORY_SETTINGS_PREFIX = "review.repo."

/**
 * System setting persistence document shape.
 */
export interface ISystemSettingDocument {
    readonly key: string
    readonly value: unknown
}

/**
 * Minimal system settings model contract used by config loader.
 */
export interface ISystemSettingsModel {
    /**
     * Finds one system setting by filter.
     *
     * @param filter Mongo-like filter object.
     * @returns Setting document or null.
     */
    findOne(filter: Readonly<Record<string, unknown>>): Promise<ISystemSettingDocument | null>
}

/**
 * Constructor options for default repository config loader.
 */
export interface IDefaultRepositoryConfigLoaderOptions {
    /**
     * System settings model used for defaults and repository layers.
     */
    readonly systemSettingsModel: ISystemSettingsModel

    /**
     * Optional organization layer loader.
     */
    readonly organizationConfigLoader?: MongoOrganizationConfigLoader

    /**
     * Fallback default layer returned when setting key is absent.
     */
    readonly fallbackDefaultLayer?: Partial<IReviewConfigDTO>
}

/**
 * Default implementation of layered repository config loader.
 */
export class DefaultRepositoryConfigLoader implements IRepositoryConfigLoader {
    private readonly systemSettingsModel: ISystemSettingsModel
    private readonly organizationConfigLoader?: MongoOrganizationConfigLoader
    private readonly fallbackDefaultLayer: Partial<IReviewConfigDTO>

    /**
     * Creates config loader instance.
     *
     * @param options Loader dependencies.
     */
    public constructor(options: IDefaultRepositoryConfigLoaderOptions) {
        this.systemSettingsModel = options.systemSettingsModel
        this.organizationConfigLoader = options.organizationConfigLoader
        this.fallbackDefaultLayer = options.fallbackDefaultLayer ?? {
            severityThreshold: "MEDIUM",
            ignorePaths: [],
            maxSuggestionsPerFile: 20,
            maxSuggestionsPerCCR: 100,
            cadence: "automatic",
            customRuleIds: [],
        }
    }

    /**
     * Loads repository-specific configuration layer.
     *
     * @param repositoryId Repository identifier.
     * @returns Partial repository config layer or null.
     */
    public loadConfig(repositoryId: string): Promise<Partial<IReviewConfigDTO> | null> {
        return this.loadRepository(repositoryId)
    }

    /**
     * Loads organization/team configuration layer.
     *
     * @param organizationId Organization identifier.
     * @param teamId Team identifier.
     * @returns Partial organization layer or null.
     */
    public async loadOrganization(
        organizationId: string,
        teamId: string,
    ): Promise<Partial<IReviewConfigDTO> | null> {
        if (this.organizationConfigLoader === undefined) {
            return null
        }

        return this.organizationConfigLoader.load(organizationId, teamId)
    }

    /**
     * Loads repository configuration layer.
     *
     * @param repositoryId Repository identifier.
     * @returns Partial repository layer or null.
     */
    public async loadRepository(
        repositoryId: string,
    ): Promise<Partial<IReviewConfigDTO> | null> {
        const normalizedRepositoryId = repositoryId.trim()
        if (normalizedRepositoryId.length === 0) {
            return null
        }

        return this.readLayerByKey(`${REVIEW_REPOSITORY_SETTINGS_PREFIX}${normalizedRepositoryId}`)
    }

    /**
     * Loads global default configuration layer.
     *
     * @returns Default layer.
     */
    public async loadDefault(): Promise<Partial<IReviewConfigDTO> | null> {
        const layer = await this.readLayerByKey(REVIEW_DEFAULTS_SETTINGS_KEY)
        if (layer !== null) {
            return layer
        }

        return {
            ...this.fallbackDefaultLayer,
        }
    }

    /**
     * Reads normalized config layer from system settings by key.
     *
     * @param key Setting key.
     * @returns Normalized layer or null.
     */
    private async readLayerByKey(
        key: string,
    ): Promise<Partial<IReviewConfigDTO> | null> {
        const document = await this.systemSettingsModel.findOne({
            key,
        })
        if (document === null) {
            return null
        }

        return normalizeReviewConfigLayer(document.value)
    }
}
