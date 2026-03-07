import {createToken, type IGitProvider} from "@codenautic/core"

/**
 * DI tokens for git adapter domain.
 */
export const GIT_TOKENS = {
    Provider: createToken<IGitProvider>("adapters.git.provider"),
} as const
