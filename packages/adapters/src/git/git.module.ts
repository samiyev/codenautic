import {Container, type IGitProvider} from "@codenautic/core"

import {bindConstantSingleton} from "../shared/bind-constant-singleton"
import {GIT_TOKENS} from "./git.tokens"

/**
 * Registration options for git adapter module.
 */
export interface IRegisterGitModuleOptions {
    /**
     * Git provider implementation.
     */
    readonly provider: IGitProvider
}

/**
 * Registers git adapters in DI container.
 *
 * @param container Target container.
 * @param options Module options.
 */
export function registerGitModule(container: Container, options: IRegisterGitModuleOptions): void {
    bindConstantSingleton(container, GIT_TOKENS.Provider, options.provider)
}
