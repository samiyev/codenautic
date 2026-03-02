import {Result} from "@codenautic/core"

import {type IAntiCorruptionLayer} from "../../shared/acl/anti-corruption-layer.interface"
import {
    CONTEXT_ISSUE_STATUS,
    CONTEXT_PROVIDER,
    type ContextIssueStatus,
    type IContextIssueAssigneeDto,
    type IContextIssueDto,
} from "../contracts/issue.contract"
import {CONTEXT_ACL_ERROR_CODE, ContextAclError} from "../errors/context-acl.error"

type UnknownRecord = Record<string, unknown>

/**
 * Jira issue ACL that converts external Jira payloads into stable context DTO.
 */
export class JiraIssueAcl
    implements IAntiCorruptionLayer<unknown, IContextIssueDto, ContextAclError>
{
    /**
     * Creates Jira issue ACL instance.
     */
    public constructor() {}

    /**
     * Maps Jira issue payload into stable context issue DTO.
     *
     * @param external External Jira payload.
     * @returns Stable context issue DTO or normalized validation error.
     */
    public transform(external: unknown): Result<IContextIssueDto, ContextAclError> {
        const payload = toRecord(external)
        if (payload === undefined) {
            return Result.fail(this.createInvalidPayloadError("Jira payload must be a non-null object"))
        }

        const fields = readRecord(payload, "fields")
        if (fields === undefined) {
            return Result.fail(this.createInvalidPayloadError("Jira payload fields object is required"))
        }

        const required = extractRequiredIssueFields(payload, fields)
        if (required.isFail) {
            return Result.fail(required.error)
        }

        return Result.ok({
            provider: CONTEXT_PROVIDER.JIRA,
            issueExternalId: required.value.issueExternalId,
            issueKey: required.value.issueKey,
            projectExternalId: required.value.projectExternalId,
            title: required.value.title,
            description: readOptionalString(fields, "description") ?? "",
            status: mapJiraStatus(required.value.statusName),
            sprintName: extractSprintName(fields) ?? "",
            assignee: extractAssignee(fields),
            url: readOptionalString(payload, "self") ?? "",
            labels: normalizeLabels(fields["labels"]),
        })
    }

    private createInvalidPayloadError(message: string): ContextAclError {
        return new ContextAclError({
            code: CONTEXT_ACL_ERROR_CODE.INVALID_PAYLOAD,
            message,
            retryable: false,
        })
    }
}

interface IRequiredIssueFields {
    readonly issueExternalId: string
    readonly issueKey: string
    readonly projectExternalId: string
    readonly title: string
    readonly statusName: string
}

/**
 * Extracts required Jira issue fields and validates completeness.
 *
 * @param payload Root Jira payload.
 * @param fields Jira fields object.
 * @returns Required fields or validation error.
 */
function extractRequiredIssueFields(
    payload: UnknownRecord,
    fields: UnknownRecord,
): Result<IRequiredIssueFields, ContextAclError> {
    const issueExternalId = readRequiredString(payload, "id")
    const issueKey = readRequiredString(payload, "key")
    const title = readRequiredString(fields, "summary")
    const status = readRecord(fields, "status")
    const project = readRecord(fields, "project")
    if (
        issueExternalId === undefined ||
        issueKey === undefined ||
        title === undefined ||
        status === undefined ||
        project === undefined
    ) {
        return Result.fail(
            new ContextAclError({
                code: CONTEXT_ACL_ERROR_CODE.INVALID_PAYLOAD,
                message: "Jira payload is missing required issue fields",
                retryable: false,
            }),
        )
    }

    const statusName = readRequiredString(status, "name")
    const projectExternalId = readRequiredString(project, "key")
    if (statusName === undefined || projectExternalId === undefined) {
        return Result.fail(
            new ContextAclError({
                code: CONTEXT_ACL_ERROR_CODE.INVALID_PAYLOAD,
                message: "Jira payload status/project fields are incomplete",
                retryable: false,
            }),
        )
    }

    return Result.ok({
        issueExternalId,
        issueKey,
        projectExternalId,
        title,
        statusName,
    })
}

/**
 * Maps Jira status label into normalized status taxonomy.
 *
 * @param statusName Raw Jira status label.
 * @returns Normalized context issue status.
 */
function mapJiraStatus(statusName: string): ContextIssueStatus {
    const normalized = statusName.trim().toLowerCase()
    if (normalized === "to do") {
        return CONTEXT_ISSUE_STATUS.TODO
    }
    if (normalized === "in progress") {
        return CONTEXT_ISSUE_STATUS.IN_PROGRESS
    }
    if (normalized === "done") {
        return CONTEXT_ISSUE_STATUS.DONE
    }
    if (normalized === "blocked") {
        return CONTEXT_ISSUE_STATUS.BLOCKED
    }

    return CONTEXT_ISSUE_STATUS.UNKNOWN
}

/**
 * Extracts sprint name from Jira fields.
 *
 * @param fields Jira fields object.
 * @returns Sprint name when present.
 */
function extractSprintName(fields: UnknownRecord): string | undefined {
    const sprint = readRecord(fields, "sprint")
    if (sprint !== undefined) {
        const sprintName = readRequiredString(sprint, "name")
        if (sprintName !== undefined) {
            return sprintName
        }
    }

    const customSprint = fields["customfield_10020"]
    if (Array.isArray(customSprint) === false || customSprint.length === 0) {
        return undefined
    }

    const firstSprint = toRecord(customSprint[0])
    if (firstSprint === undefined) {
        return undefined
    }

    return readRequiredString(firstSprint, "name")
}

/**
 * Extracts assignee payload from Jira fields.
 *
 * @param fields Jira fields object.
 * @returns Normalized assignee payload when complete.
 */
function extractAssignee(fields: UnknownRecord): IContextIssueAssigneeDto | undefined {
    const assignee = readRecord(fields, "assignee")
    if (assignee === undefined) {
        return undefined
    }

    const externalId = readRequiredString(assignee, "accountId")
    const displayName = readRequiredString(assignee, "displayName")
    if (externalId === undefined || displayName === undefined) {
        return undefined
    }

    return {
        externalId,
        displayName,
    }
}

/**
 * Normalizes Jira labels by trimming, deduplicating and filtering invalid entries.
 *
 * @param labels Unknown labels payload.
 * @returns Sanitized labels array.
 */
function normalizeLabels(labels: unknown): readonly string[] {
    if (Array.isArray(labels) === false) {
        return []
    }

    const seen = new Set<string>()
    const normalizedLabels: string[] = []
    for (const label of labels) {
        if (typeof label !== "string") {
            continue
        }

        const normalized = label.trim()
        if (normalized.length === 0) {
            continue
        }
        if (seen.has(normalized)) {
            continue
        }

        seen.add(normalized)
        normalizedLabels.push(normalized)
    }

    return normalizedLabels
}

/**
 * Converts unknown value to record.
 *
 * @param value Unknown value.
 * @returns Record when value is object.
 */
function toRecord(value: unknown): UnknownRecord | undefined {
    if (typeof value !== "object" || value === null) {
        return undefined
    }

    return value as UnknownRecord
}

/**
 * Reads nested record from object by key.
 *
 * @param value Source object.
 * @param key Property key.
 * @returns Nested record when valid.
 */
function readRecord(value: UnknownRecord, key: string): UnknownRecord | undefined {
    return toRecord(value[key])
}

/**
 * Reads optional string field from object.
 *
 * @param value Source object.
 * @param key Property key.
 * @returns Trimmed string value when present.
 */
function readOptionalString(value: UnknownRecord, key: string): string | undefined {
    const candidate = value[key]
    if (typeof candidate !== "string") {
        return undefined
    }

    return candidate.trim()
}

/**
 * Reads required non-empty string field from object.
 *
 * @param value Source object.
 * @param key Property key.
 * @returns Trimmed non-empty string when present.
 */
function readRequiredString(value: UnknownRecord, key: string): string | undefined {
    const candidate = readOptionalString(value, key)
    if (candidate === undefined || candidate.length === 0) {
        return undefined
    }

    return candidate
}
