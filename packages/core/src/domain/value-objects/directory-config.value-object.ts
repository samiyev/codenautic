/**
 * Directory-scoped configuration payload.
 */
export interface IDirectoryConfig<TConfig = Readonly<Record<string, unknown>>> {
    /**
     * Directory matcher path or glob pattern.
     */
    readonly path: string

    /**
     * Configuration overrides for the matched directory.
     */
    readonly config: TConfig
}
