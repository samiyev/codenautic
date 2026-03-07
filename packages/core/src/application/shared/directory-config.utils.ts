import type {IDirectoryConfig} from "../../domain/value-objects/directory-config.value-object"

export type DirectoryConfigRecord = IDirectoryConfig<Readonly<Record<string, unknown>>>

/**
 * Parses directory configs from raw config payload.
 *
 * @param config Pipeline config payload.
 * @returns Normalized directory configs.
 */
export function parseDirectoryConfigs(
    config: Readonly<Record<string, unknown>>,
): readonly DirectoryConfigRecord[] {
    const directories = config["directories"]
    if (Array.isArray(directories) === false) {
        return []
    }

    const parsedDirectories: DirectoryConfigRecord[] = []

    for (const rawDirectoryConfig of directories) {
        const directoryConfig = resolveDirectoryConfig(rawDirectoryConfig)
        if (directoryConfig !== undefined) {
            parsedDirectories.push(directoryConfig)
        }
    }

    return parsedDirectories
}

/**
 * Deep merges base config with directory override.
 *
 * @param baseConfig Base config payload.
 * @param overrideConfig Directory override config.
 * @returns Merged config payload.
 */
export function mergeConfigWithOverride(
    baseConfig: Readonly<Record<string, unknown>>,
    overrideConfig: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
    const normalizedBase: Record<string, unknown> = {
        ...baseConfig,
    }
    delete normalizedBase.directories

    return deepMerge(normalizedBase, overrideConfig)
}

/**
 * Builds deterministic fingerprint for config grouping.
 *
 * @param config Config payload.
 * @returns Stable fingerprint string.
 */
export function buildConfigFingerprint(config: Readonly<Record<string, unknown>>): string {
    const normalized = normalizeForFingerprint(config)
    return JSON.stringify(normalized)
}

function resolveDirectoryConfig(rawDirectoryConfig: unknown): DirectoryConfigRecord | undefined {
    if (rawDirectoryConfig === null || typeof rawDirectoryConfig !== "object" || Array.isArray(rawDirectoryConfig)) {
        return undefined
    }

    const record = rawDirectoryConfig as Readonly<Record<string, unknown>>
    const path = resolveString(record["path"])
    if (path === undefined) {
        return undefined
    }

    const config = readObjectField(record, "config")
    if (config === undefined) {
        return undefined
    }

    return {
        path,
        config,
    }
}

function resolveString(value: unknown): string | undefined {
    if (typeof value !== "string") {
        return undefined
    }

    const normalized = value.trim()
    if (normalized.length === 0) {
        return undefined
    }

    return normalized
}

function readObjectField(
    record: Readonly<Record<string, unknown>>,
    field: string,
): Readonly<Record<string, unknown>> | undefined {
    const value = record[field]
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return undefined
    }

    return value as Readonly<Record<string, unknown>>
}

function deepMerge(
    baseConfig: Readonly<Record<string, unknown>>,
    overrideConfig: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
    const result: Record<string, unknown> = {
        ...baseConfig,
    }

    for (const [key, value] of Object.entries(overrideConfig)) {
        const baseValue = result[key]
        if (isPlainObject(baseValue) && isPlainObject(value)) {
            result[key] = deepMerge(baseValue, value)
            continue
        }

        result[key] = value
    }

    return result
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && Array.isArray(value) === false
}

function normalizeForFingerprint(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map((entry) => normalizeForFingerprint(entry))
    }

    if (isPlainObject(value)) {
        const entries = Object.entries(value)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, entryValue]) => [key, normalizeForFingerprint(entryValue)])

        return Object.fromEntries(entries)
    }

    return value
}
