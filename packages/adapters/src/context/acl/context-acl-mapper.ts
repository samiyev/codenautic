import type {IExternalContext, IJiraTicket, ILinearIssue} from "@codenautic/core"

const DEFAULT_FETCHED_AT = new Date(0)
const EMPTY_RECORD: Readonly<Record<string, unknown>> = {}

/**
 * Normalizes external Jira payload to shared ticket DTO.
 *
 * @param payload External Jira payload.
 * @returns Normalized Jira ticket DTO.
 */
export function mapExternalJiraTicket(payload: unknown): IJiraTicket {
    const root = toRecord(payload) ?? EMPTY_RECORD
    const fields = toRecord(root["fields"])
    const statusField = toRecord(fields?.["status"])
    const statusRoot = toRecord(root["status"])

    return {
        key: readIdentifier(root, ["key", "issueKey", "id"], "UNKNOWN"),
        summary: readText(fields, ["summary"], readText(root, ["summary", "title"], "(no summary)")),
        status: readText(
            statusField,
            ["name", "statusCategory"],
            readText(statusRoot, ["name"], readText(root, ["status"], "unknown")),
        ),
    }
}

/**
 * Normalizes external Linear payload to shared issue DTO.
 *
 * @param payload External Linear payload.
 * @returns Normalized Linear issue DTO.
 */
export function mapExternalLinearIssue(payload: unknown): ILinearIssue {
    const root = toRecord(payload) ?? EMPTY_RECORD
    const state = toRecord(root["state"])
    const status = toRecord(root["status"])

    return {
        id: readIdentifier(root, ["id", "identifier", "issueId"], "UNKNOWN"),
        title: readText(root, ["title", "name"], "(no title)"),
        state: readText(state, ["name"], readText(status, ["name"], readText(root, ["state"], "unknown"))),
    }
}

/**
 * Normalizes external Jira context payload.
 *
 * @param payload External Jira payload.
 * @returns Shared external context.
 */
export function mapJiraContext(payload: unknown): IExternalContext {
    const root = toRecord(payload) ?? EMPTY_RECORD

    return {
        source: "JIRA",
        data: {
            ticket: mapExternalJiraTicket(payload),
            sprint: resolveJiraSprint(root),
        },
        fetchedAt: resolveFetchedAt(root),
    }
}

/**
 * Normalizes external Linear context payload.
 *
 * @param payload External Linear payload.
 * @returns Shared external context.
 */
export function mapLinearContext(payload: unknown): IExternalContext {
    const root = toRecord(payload) ?? EMPTY_RECORD

    return {
        source: "LINEAR",
        data: {
            issue: mapExternalLinearIssue(payload),
            cycle: resolveLinearCycle(root),
        },
        fetchedAt: resolveFetchedAt(root),
    }
}

/**
 * Resolves Jira sprint from common payload locations.
 *
 * @param root Jira root payload.
 * @returns Sprint name when available.
 */
function resolveJiraSprint(root: Readonly<Record<string, unknown>>): string | undefined {
    const fields = toRecord(root["fields"])
    const sprint = toRecord(fields?.["sprint"])
    const sprintName = readText(sprint, ["name"])

    if (sprintName.length > 0) {
        return sprintName
    }

    const boardSprint = toArray(fields?.["customfield_10020"])
    const firstBoardSprint = toRecord(boardSprint[0])
    const boardSprintName = readText(firstBoardSprint, ["name"])

    if (boardSprintName.length > 0) {
        return boardSprintName
    }

    return undefined
}

/**
 * Resolves Linear cycle from common payload locations.
 *
 * @param root Linear root payload.
 * @returns Cycle name when available.
 */
function resolveLinearCycle(root: Readonly<Record<string, unknown>>): string | undefined {
    const cycle = toRecord(root["cycle"])
    const cycleName = readText(cycle, ["name"])

    if (cycleName.length > 0) {
        return cycleName
    }

    return readText(root, ["cycleName"])
}

/**
 * Resolves fetched-at timestamp from payload.
 *
 * @param root Payload root object.
 * @returns Valid timestamp.
 */
function resolveFetchedAt(root: Readonly<Record<string, unknown>>): Date {
    const candidates: readonly unknown[] = [
        root["fetchedAt"],
        root["updatedAt"],
        root["updated_at"],
        root["timestamp"],
    ]

    for (const candidate of candidates) {
        if (candidate instanceof Date && Number.isNaN(candidate.valueOf()) === false) {
            return new Date(candidate.getTime())
        }

        if (typeof candidate === "string" || typeof candidate === "number") {
            const parsed = new Date(candidate)
            if (Number.isNaN(parsed.valueOf()) === false) {
                return parsed
            }
        }
    }

    return new Date(DEFAULT_FETCHED_AT.getTime())
}

/**
 * Converts unknown to plain object record.
 *
 * @param value Candidate value.
 * @returns Plain record or null.
 */
function toRecord(value: unknown): Readonly<Record<string, unknown>> | null {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return null
    }

    return value as Readonly<Record<string, unknown>>
}

/**
 * Converts unknown value to readonly array.
 *
 * @param value Candidate value.
 * @returns Array or empty list.
 */
function toArray(value: unknown): readonly unknown[] {
    if (Array.isArray(value)) {
        return value
    }

    return []
}

/**
 * Reads textual value by candidate keys.
 *
 * @param source Source record.
 * @param keys Candidate keys.
 * @param fallback Fallback value.
 * @returns Normalized string.
 */
function readText(
    source: Readonly<Record<string, unknown>> | null,
    keys: readonly string[],
    fallback = "",
): string {
    for (const key of keys) {
        const value = source?.[key]
        if (typeof value === "string") {
            const normalized = value.trim()
            if (normalized.length > 0) {
                return normalized
            }
        }
    }

    return fallback
}

/**
 * Reads identifier value by candidate keys.
 *
 * @param source Source record.
 * @param keys Candidate keys.
 * @param fallback Fallback value.
 * @returns Normalized identifier.
 */
function readIdentifier(
    source: Readonly<Record<string, unknown>> | null,
    keys: readonly string[],
    fallback = "",
): string {
    for (const key of keys) {
        const value = source?.[key]

        if (typeof value === "string") {
            const normalized = value.trim()
            if (normalized.length > 0) {
                return normalized
            }
        }

        if (typeof value === "number" && Number.isFinite(value)) {
            return String(value)
        }
    }

    return fallback
}
