import {
    Container,
    TOKENS,
    type IExternalContextProvider,
} from "@codenautic/core"

import {bindConstantSingleton} from "../shared/bind-constant-singleton"
import {CONTEXT_TOKENS} from "./context.tokens"

/**
 * Registration options for context adapter module.
 */
export interface IRegisterContextModuleOptions {
    /**
     * External-context providers available for runtime.
     */
    readonly providers: readonly IExternalContextProvider[]

    /**
     * Optional explicit default provider override.
     */
    readonly defaultProvider?: IExternalContextProvider
}

/**
 * Registers context adapters in DI container.
 *
 * @param container Target container.
 * @param options Module options.
 */
export function registerContextModule(
    container: Container,
    options: IRegisterContextModuleOptions,
): void {
    const providers = [...options.providers]
    bindConstantSingleton(container, CONTEXT_TOKENS.Providers, providers)

    const defaultProvider = resolveDefaultProvider(options)
    if (defaultProvider !== undefined) {
        bindConstantSingleton(container, CONTEXT_TOKENS.Provider, defaultProvider)
        bindConstantSingleton(container, TOKENS.Review.ExternalContextProvider, defaultProvider)
    }
}

/**
 * Resolves default context provider.
 *
 * @param options Context module options.
 * @returns Resolved default provider when available.
 */
function resolveDefaultProvider(
    options: IRegisterContextModuleOptions,
): IExternalContextProvider | undefined {
    if (options.defaultProvider !== undefined) {
        return options.defaultProvider
    }

    const firstProvider = options.providers[0]
    if (firstProvider !== undefined) {
        return firstProvider
    }

    return undefined
}

