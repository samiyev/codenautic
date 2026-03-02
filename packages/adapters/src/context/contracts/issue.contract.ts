/**
 * Supported context providers for ACL contracts.
 */
export const CONTEXT_PROVIDER = {
    JIRA: "jira",
    LINEAR: "linear",
} as const

/**
 * Supported context provider label.
 */
export type ContextProvider = (typeof CONTEXT_PROVIDER)[keyof typeof CONTEXT_PROVIDER]

/**
 * Unified issue status taxonomy for context providers.
 */
export const CONTEXT_ISSUE_STATUS = {
    TODO: "todo",
    IN_PROGRESS: "in_progress",
    DONE: "done",
    BLOCKED: "blocked",
    UNKNOWN: "unknown",
} as const

/**
 * Unified issue status value.
 */
export type ContextIssueStatus = (typeof CONTEXT_ISSUE_STATUS)[keyof typeof CONTEXT_ISSUE_STATUS]

/**
 * Optional assignee payload for context issue DTO.
 */
export interface IContextIssueAssigneeDto {
    readonly externalId: string
    readonly displayName: string
}

/**
 * Stable context issue DTO produced by ACL adapters.
 */
export interface IContextIssueDto {
    readonly provider: ContextProvider
    readonly issueExternalId: string
    readonly issueKey: string
    readonly projectExternalId: string
    readonly title: string
    readonly description: string
    readonly status: ContextIssueStatus
    readonly sprintName: string
    readonly assignee?: IContextIssueAssigneeDto
    readonly url: string
    readonly labels: readonly string[]
}
