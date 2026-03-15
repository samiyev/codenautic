import { http, HttpResponse, delay } from "msw"

import { getMockStore } from "../store/create-mock-store"
import { api } from "./handler-utils"

/**
 * MSW handlers для CodeCity API.
 *
 * Обрабатывают операции CodeCity: list profiles, get dependency graph.
 * Используют CodeCityCollection из mock store для хранения состояния.
 */
export const codeCityHandlers = [
    /**
     * GET /code-city/profiles — возвращает список профилей CodeCity.
     */
    http.get(api("/code-city/profiles"), async () => {
        await delay(100)
        const store = getMockStore()
        const profiles = store.codeCity.listProfiles()

        return HttpResponse.json({ profiles })
    }),

    /**
     * GET /code-city/profiles/:repoId/dependency-graph — возвращает граф зависимостей.
     */
    http.get(api("/code-city/profiles/:repoId/dependency-graph"), async ({ params }) => {
        await delay(150)
        const store = getMockStore()
        const repoId = params["repoId"] as string

        const profile = store.codeCity.getProfileById(repoId)

        if (profile === undefined) {
            return HttpResponse.json(
                { error: "CodeCity profile not found", repoId },
                { status: 404 },
            )
        }

        const nodes = store.codeCity.getDependencyNodes()
        const relations = store.codeCity.getDependencyRelations()

        return HttpResponse.json({ nodes, relations })
    }),
]
