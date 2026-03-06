/**
 * System setting persistence record.
 */
export interface ISystemSettingRecord {
    readonly key: string
    readonly value: unknown
}

/**
 * CRUD repository for system settings.
 */
export interface ISystemSettingsRepository {
    /**
     * Finds setting by key.
     *
     * @param key Setting key.
     * @returns Setting record or null.
     */
    findByKey(key: string): Promise<ISystemSettingRecord | null>

    /**
     * Loads all settings.
     *
     * @returns List of settings.
     */
    findAll(): Promise<readonly ISystemSettingRecord[]>

    /**
     * Upserts setting by key.
     *
     * @param setting Setting record.
     */
    upsert(setting: ISystemSettingRecord): Promise<void>

    /**
     * Deletes setting by key.
     *
     * @param key Setting key.
     */
    deleteByKey(key: string): Promise<void>
}
