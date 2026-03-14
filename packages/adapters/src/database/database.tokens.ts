import {createToken} from "@codenautic/core"

import type {IDatabaseConnectionManager} from "./database.types"

/**
 * DI tokens for database adapter domain.
 */
export const DATABASE_TOKENS = {
    ConnectionManager: createToken<IDatabaseConnectionManager>(
        "adapters.database.connection-manager",
    ),
} as const

