/**
 * Read-only system settings provider.
 */
export interface ISystemSettingsProvider {
    /**
     * Returns a single setting by key.
     *
     * @param key Setting key.
     * @returns Value when present.
     */
    get<T>(key: string): Promise<T | undefined>

    /**
     * Returns multiple settings by key.
     *
     * @param keys Setting keys.
     * @returns Resolved map of setting values (missing keys omitted).
     */
    getMany<T>(keys: readonly string[]): Promise<ReadonlyMap<string, T>>
}
