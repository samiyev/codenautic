import {
    createToken,
    type IExternalContextProvider,
} from "@codenautic/core"

/**
 * DI tokens for context adapter domain.
 */
export const CONTEXT_TOKENS = {
    Provider: createToken<IExternalContextProvider>("adapters.context.provider"),
    Providers: createToken<readonly IExternalContextProvider[]>("adapters.context.providers"),
} as const

