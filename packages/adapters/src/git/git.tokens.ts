import {createToken} from "@codenautic/core"

import {GitLabMergeRequestAcl} from "./acl/gitlab-merge-request.acl"

/**
 * Git domain IoC tokens.
 */
export const GIT_TOKENS = {
    GitLabMergeRequestAcl: createToken<GitLabMergeRequestAcl>(
        "adapters.git.gitlab-merge-request-acl",
    ),
} as const
