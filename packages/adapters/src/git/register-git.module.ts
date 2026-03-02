import {Container} from "@codenautic/core"

import {GitLabMergeRequestAcl} from "./acl/gitlab-merge-request.acl"
import {GIT_TOKENS} from "./git.tokens"

/**
 * Optional dependency overrides for git module registration.
 */
export interface IGitModuleOverrides {
    gitLabMergeRequestAcl?: GitLabMergeRequestAcl
}

/**
 * Registers git adapter module into target container.
 *
 * @param container Target IoC container.
 * @param overrides Optional dependency overrides.
 * @returns Same container instance for chaining.
 */
export function registerGitModule(
    container: Container,
    overrides: IGitModuleOverrides = {},
): Container {
    container.bindSingleton(GIT_TOKENS.GitLabMergeRequestAcl, () => {
        return overrides.gitLabMergeRequestAcl ?? new GitLabMergeRequestAcl()
    })

    return container
}
