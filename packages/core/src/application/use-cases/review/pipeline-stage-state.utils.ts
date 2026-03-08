import type {
    PipelineCollectionItem,
    PipelinePayload,
} from "../../types/review/review-pipeline-state"
import type {IReviewRuleSelectionDTO} from "../../dto/review/review-config.dto"

/**
 * Canonical initial attempt number for stage-level errors.
 */
export const INITIAL_STAGE_ATTEMPT = 1

/**
 * Reads non-empty string field from payload.
 *
 * @param payload Source payload.
 * @param key Field name.
 * @returns Trimmed string when present.
 */
export function readStringField(payload: PipelinePayload, key: string): string | undefined {
    const raw = payload[key]
    if (typeof raw !== "string") {
        return undefined
    }

    const normalized = raw.trim()
    if (normalized.length === 0) {
        return undefined
    }

    return normalized
}

/**
 * Reads non-empty string array field from payload.
 *
 * @param payload Source payload.
 * @param key Field name.
 * @returns Trimmed string array when present and valid.
 */
export function readStringArrayField(
    payload: PipelinePayload,
    key: string,
): readonly string[] | undefined {
    const raw = payload[key]
    if (Array.isArray(raw) === false) {
        return undefined
    }

    const normalizedValues: string[] = []
    for (const item of raw) {
        if (typeof item !== "string") {
            return undefined
        }

        const normalizedItem = item.trim()
        if (normalizedItem.length === 0) {
            return undefined
        }

        normalizedValues.push(normalizedItem)
    }

    return normalizedValues
}

/**
 * Reads boolean field from payload.
 *
 * @param payload Source payload.
 * @param key Field name.
 * @returns Boolean value when present.
 */
export function readBooleanField(payload: PipelinePayload, key: string): boolean | undefined {
    const raw = payload[key]
    if (typeof raw === "boolean") {
        return raw
    }

    if (typeof raw === "string") {
        const normalized = raw.trim().toLowerCase()
        if (normalized === "true") {
            return true
        }
        if (normalized === "false") {
            return false
        }
    }

    return undefined
}

/**
 * Reads object field from payload.
 *
 * @param payload Source payload.
 * @param key Field name.
 * @returns Record-like object when present.
 */
export function readObjectField(
    payload: PipelinePayload,
    key: string,
): Readonly<Record<string, unknown>> | undefined {
    const raw = payload[key]
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
        return undefined
    }

    return raw as Readonly<Record<string, unknown>>
}

/**
 * Reads validated review rule-selection fields from config payload.
 *
 * @param config Review config payload.
 * @returns Normalized rule-selection DTO subset.
 */
export function readReviewRuleSelectionConfig(
    config: PipelinePayload,
): IReviewRuleSelectionDTO {
    const globalRuleIds = readStringArrayField(config, "globalRuleIds")
    const organizationRuleIds = readStringArrayField(config, "organizationRuleIds")

    return {
        ...(globalRuleIds === undefined ? {} : {globalRuleIds}),
        ...(organizationRuleIds === undefined ? {} : {organizationRuleIds}),
    }
}

/**
 * Resolves current head commit id from merge request payload.
 *
 * @param mergeRequest Merge request payload.
 * @returns Current head commit identifier.
 */
export function resolveCurrentHeadCommitId(mergeRequest: PipelinePayload): string | undefined {
    const explicitHead = readStringField(mergeRequest, "currentHeadCommitId")
    if (explicitHead !== undefined) {
        return explicitHead
    }

    const commitsRaw = mergeRequest["commits"]
    if (!Array.isArray(commitsRaw) || commitsRaw.length === 0) {
        return undefined
    }
    const commits: readonly unknown[] = commitsRaw

    for (let index = commits.length - 1; index >= 0; index -= 1) {
        const commit = commits[index]
        if (commit === null || typeof commit !== "object" || Array.isArray(commit)) {
            continue
        }

        const commitId = (commit as Readonly<Record<string, unknown>>)["id"]
        if (typeof commitId !== "string") {
            continue
        }

        const normalized = commitId.trim()
        if (normalized.length > 0) {
            return normalized
        }
    }

    return undefined
}

/**
 * Creates shallow merged external context payload.
 *
 * @param current Current external context.
 * @param patch Patch payload.
 * @returns Merged external context.
 */
export function mergeExternalContext(
    current: PipelinePayload | null,
    patch: Readonly<Record<string, unknown>>,
): PipelinePayload {
    if (current === null) {
        return {
            ...patch,
        }
    }

    return {
        ...current,
        ...patch,
    }
}

/**
 * Type guard for pipeline collection item values.
 *
 * @param value Candidate value.
 * @returns True when value is a collection item.
 */
export function isPipelineCollectionItem(value: unknown): value is PipelineCollectionItem {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return false
    }

    return true
}
