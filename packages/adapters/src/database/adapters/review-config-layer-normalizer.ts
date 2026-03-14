import type {IReviewConfigDTO} from "@codenautic/core"

/**
 * Supported settings map shape for config extraction.
 */
export type SettingsMapInput = Map<string, unknown> | Record<string, unknown>

/**
 * Normalizes plain record into partial review config layer.
 *
 * @param payload Raw settings payload.
 * @returns Normalized review config layer or null when empty/invalid.
 */
export function normalizeReviewConfigLayer(
    payload: unknown,
): Partial<IReviewConfigDTO> | null {
    const record = readObject(payload)
    if (record === undefined) {
        return null
    }

    const layer = normalizeEntries(Object.entries(record))
    if (Object.keys(layer).length === 0) {
        return null
    }

    return layer
}

/**
 * Extracts prefixed review config keys from map/object settings.
 *
 * @param settings Settings map/object.
 * @param prefix Config key prefix.
 * @returns Normalized config layer.
 */
export function extractReviewConfigLayerByPrefix(
    settings: SettingsMapInput,
    prefix: string,
): Partial<IReviewConfigDTO> {
    const normalizedPrefix = prefix.trim()
    if (normalizedPrefix.length === 0) {
        return {}
    }

    const entries = settings instanceof Map ? [...settings.entries()] : Object.entries(settings)
    const normalizedEntries: Array<readonly [string, unknown]> = []

    for (const [key, value] of entries) {
        if (key.startsWith(normalizedPrefix)) {
            normalizedEntries.push([key.slice(normalizedPrefix.length), value])
        }
    }

    return normalizeEntries(normalizedEntries)
}

/**
 * Normalizes key-value entries into review config layer.
 *
 * @param entries Candidate config entries.
 * @returns Normalized layer.
 */
function normalizeEntries(
    entries: readonly (readonly [string, unknown])[],
): Partial<IReviewConfigDTO> {
    const layer: Record<string, unknown> = {}

    for (const [rawKey, rawValue] of entries) {
        const key = rawKey.trim()
        if (key.length === 0) {
            continue
        }

        const normalizer = REVIEW_CONFIG_FIELD_NORMALIZERS[key]
        if (normalizer === undefined) {
            continue
        }

        const normalizedValue = normalizer(rawValue)
        if (normalizedValue !== undefined) {
            layer[key] = normalizedValue
        }
    }

    return layer as Partial<IReviewConfigDTO>
}

type ReviewConfigFieldValue = string | number | boolean | readonly string[] | undefined
type ValueNormalizer = (rawValue: unknown) => ReviewConfigFieldValue

const REVIEW_CONFIG_FIELD_NORMALIZERS: Readonly<Record<string, ValueNormalizer>> = {
    severityThreshold: readString,
    cadence: readString,
    reviewDepthStrategy(rawValue: unknown): ReviewConfigFieldValue {
        return readString(rawValue)
    },
    maxSuggestionsPerFile: readFiniteNumber,
    maxSuggestionsPerCCR: readFiniteNumber,
    autoCreateIssues(rawValue: unknown): ReviewConfigFieldValue {
        return typeof rawValue === "boolean" ? rawValue : undefined
    },
    ignorePaths: readStringArray,
    customRuleIds: readStringArray,
    globalRuleIds: readStringArray,
    organizationRuleIds: readStringArray,
} as const

/**
 * Reads plain object.
 *
 * @param value Raw payload.
 * @returns Plain object or undefined.
 */
function readObject(value: unknown): Record<string, unknown> | undefined {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return undefined
    }

    return value as Record<string, unknown>
}

/**
 * Reads non-empty string.
 *
 * @param value Raw value.
 * @returns Trimmed string or undefined.
 */
function readString(value: unknown): string | undefined {
    if (typeof value !== "string") {
        return undefined
    }

    const normalized = value.trim()
    if (normalized.length === 0) {
        return undefined
    }

    return normalized
}

/**
 * Reads finite number.
 *
 * @param value Raw value.
 * @returns Numeric value or undefined.
 */
function readFiniteNumber(value: unknown): number | undefined {
    if (typeof value !== "number" || Number.isFinite(value) === false) {
        return undefined
    }

    return value
}

/**
 * Reads string array from array, JSON string, or comma-separated string.
 *
 * @param value Raw value.
 * @returns String array or undefined.
 */
function readStringArray(value: unknown): readonly string[] | undefined {
    if (Array.isArray(value)) {
        return normalizeStringArray(value)
    }

    if (typeof value !== "string") {
        return undefined
    }

    const normalized = value.trim()
    if (normalized.length === 0) {
        return undefined
    }

    const parsedFromJson = tryParseJsonArray(normalized)
    if (parsedFromJson !== undefined) {
        return parsedFromJson
    }

    return normalizeStringArray(normalized.split(","))
}

/**
 * Parses JSON string and returns normalized string array when possible.
 *
 * @param value JSON candidate.
 * @returns Normalized string array or undefined.
 */
function tryParseJsonArray(value: string): readonly string[] | undefined {
    try {
        const parsed = JSON.parse(value) as unknown
        if (Array.isArray(parsed) === false) {
            return undefined
        }

        return normalizeStringArray(parsed)
    } catch {
        return undefined
    }
}

/**
 * Normalizes string array and filters empty values.
 *
 * @param values Raw values.
 * @returns Normalized immutable string array.
 */
function normalizeStringArray(values: readonly unknown[]): readonly string[] {
    const normalized: string[] = []
    for (const value of values) {
        if (typeof value !== "string") {
            continue
        }

        const item = value.trim()
        if (item.length > 0) {
            normalized.push(item)
        }
    }

    return normalized
}
