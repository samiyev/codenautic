import type { RequestHandler } from "msw"

import { authHandlers } from "./auth.handlers"
import { codeCityHandlers } from "./code-city.handlers"
import { contractValidationHandlers } from "./contract-validation.handlers"
import { dashboardHandlers } from "./dashboard.handlers"
import { providersHandlers } from "./providers.handlers"
import { repoConfigHandlers } from "./repo-config.handlers"
import { repositoriesHandlers } from "./repositories.handlers"
import { reviewsHandlers } from "./reviews.handlers"
import { rulesHandlers } from "./rules.handlers"
import { settingsHandlers } from "./settings.handlers"
import { systemHandlers } from "./system.handlers"
import { workspaceHandlers } from "./workspace.handlers"

/**
 * Все MSW handlers для dev-режима.
 *
 * Каждый домен — отдельный файл с массивом handlers.
 */
export const handlers: ReadonlyArray<RequestHandler> = [
    ...authHandlers,
    ...contractValidationHandlers,
    ...dashboardHandlers,
    ...systemHandlers,
    ...settingsHandlers,
    ...repoConfigHandlers,
    ...rulesHandlers,
    ...providersHandlers,
    ...workspaceHandlers,
    ...reviewsHandlers,
    ...repositoriesHandlers,
    ...codeCityHandlers,
]
