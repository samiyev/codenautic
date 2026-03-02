import {createToken} from "@codenautic/core"

import {JiraIssueAcl} from "./acl/jira-issue.acl"

/**
 * Context domain IoC tokens.
 */
export const CONTEXT_TOKENS = {
    JiraIssueAcl: createToken<JiraIssueAcl>("adapters.context.jira-issue-acl"),
} as const
