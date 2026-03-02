import {Container} from "@codenautic/core"

import {JiraIssueAcl} from "./acl/jira-issue.acl"
import {CONTEXT_TOKENS} from "./context.tokens"

/**
 * Optional dependency overrides for context module registration.
 */
export interface IContextModuleOverrides {
    jiraIssueAcl?: JiraIssueAcl
}

/**
 * Registers context adapter module into target container.
 *
 * @param container Target IoC container.
 * @param overrides Optional dependency overrides.
 * @returns Same container instance for chaining.
 */
export function registerContextModule(
    container: Container,
    overrides: IContextModuleOverrides = {},
): Container {
    container.bindSingleton(CONTEXT_TOKENS.JiraIssueAcl, () => {
        return overrides.jiraIssueAcl ?? new JiraIssueAcl()
    })

    return container
}
