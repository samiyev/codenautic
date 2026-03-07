import {Container, TOKENS, type IRuleRepository} from "@codenautic/core"

import {bindConstantSingleton} from "../shared/bind-constant-singleton"

/**
 * Registration options for rule adapter module.
 */
export interface IRegisterRuleModuleOptions {
    /**
     * Rule repository implementation.
     */
    readonly repository: IRuleRepository
}

/**
 * Registers rule adapters in DI container.
 *
 * @param container Target container.
 * @param options Module options.
 */
export function registerRuleModule(container: Container, options: IRegisterRuleModuleOptions): void {
    bindConstantSingleton(container, TOKENS.Rule.Repository, options.repository)
}
