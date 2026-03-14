import {Container} from "@codenautic/core"

import {bindConstantSingleton} from "../shared/bind-constant-singleton"
import {DATABASE_TOKENS} from "./database.tokens"
import type {IDatabaseConnectionManager} from "./database.types"

/**
 * Registration options for database adapter module.
 */
export interface IRegisterDatabaseModuleOptions {
    /**
     * Database connection manager implementation.
     */
    readonly connectionManager: IDatabaseConnectionManager
}

/**
 * Registers database adapters in DI container.
 *
 * @param container Target container.
 * @param options Module options.
 */
export function registerDatabaseModule(
    container: Container,
    options: IRegisterDatabaseModuleOptions,
): void {
    bindConstantSingleton(container, DATABASE_TOKENS.ConnectionManager, options.connectionManager)
}

