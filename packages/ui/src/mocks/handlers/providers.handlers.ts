import { http, HttpResponse, delay } from "msw"

import { getMockStore } from "../store/create-mock-store"
import type { IUpdateContextSourceData } from "../store/collections/providers-collection"
import { api } from "./handler-utils"

/**
 * MSW handlers для Git providers и context sources API.
 *
 * Обрабатывают операции над Git provider соединениями
 * и внешними источниками контекста (JIRA, Sentry и т.д.).
 * Используют ProvidersCollection из mock store для хранения состояния.
 */
export const providersHandlers = [
    /**
     * GET /git/providers — возвращает список Git provider соединений.
     */
    http.get(api("/git/providers"), async () => {
        await delay(80)
        const store = getMockStore()
        const providers = store.providers.listGitProviders()

        return HttpResponse.json({ providers })
    }),

    /**
     * PUT /git/providers/:providerId/connection — обновляет соединение провайдера.
     */
    http.put(api("/git/providers/:providerId/connection"), async ({ params, request }) => {
        await delay(150)
        const store = getMockStore()
        const providerId = params["providerId"] as string
        const body = (await request.json()) as { readonly connected?: boolean }

        const updated = store.providers.updateGitProvider(providerId, {
            connected: body.connected,
        })

        if (updated === undefined) {
            return HttpResponse.json(
                { error: "Provider not found", providerId },
                { status: 404 },
            )
        }

        return HttpResponse.json({ provider: updated })
    }),

    /**
     * POST /git/providers/:providerId/test — тестирует соединение провайдера.
     */
    http.post(api("/git/providers/:providerId/test"), async ({ params }) => {
        await delay(300)
        const store = getMockStore()
        const providerId = params["providerId"] as string

        const result = store.providers.testGitProviderConnection(providerId)

        if (result === undefined) {
            return HttpResponse.json(
                { error: "Provider not found", providerId },
                { status: 404 },
            )
        }

        return HttpResponse.json({
            providerId,
            ok: result.ok,
            message: result.message,
        })
    }),

    /**
     * GET /context/sources — возвращает список context sources.
     */
    http.get(api("/context/sources"), async () => {
        await delay(80)
        const store = getMockStore()
        const sources = store.providers.listContextSources()

        return HttpResponse.json({
            sources,
            total: sources.length,
        })
    }),

    /**
     * GET /context/sources/:sourceId/preview — возвращает preview для source.
     */
    http.get(api("/context/sources/:sourceId/preview"), async ({ params }) => {
        await delay(120)
        const store = getMockStore()
        const sourceId = params["sourceId"] as string

        const source = store.providers.getContextSourceById(sourceId)
        if (source === undefined) {
            return HttpResponse.json(
                { error: "Source not found", sourceId },
                { status: 404 },
            )
        }

        const items = store.providers.getContextSourcePreview(sourceId) ?? []

        return HttpResponse.json({
            sourceId,
            items,
            total: source.itemCount,
        })
    }),

    /**
     * PUT /context/sources/:sourceId — обновляет параметры source.
     */
    http.put(api("/context/sources/:sourceId"), async ({ params, request }) => {
        await delay(100)
        const store = getMockStore()
        const sourceId = params["sourceId"] as string
        const body = (await request.json()) as IUpdateContextSourceData

        const updated = store.providers.updateContextSource(sourceId, body)

        if (updated === undefined) {
            return HttpResponse.json(
                { error: "Source not found", sourceId },
                { status: 404 },
            )
        }

        return HttpResponse.json({ source: updated })
    }),

    /**
     * POST /context/sources/:sourceId/refresh — запускает refresh/sync для source.
     */
    http.post(api("/context/sources/:sourceId/refresh"), async ({ params }) => {
        await delay(200)
        const store = getMockStore()
        const sourceId = params["sourceId"] as string

        const result = store.providers.refreshContextSource(sourceId)

        if (result === undefined) {
            return HttpResponse.json(
                { error: "Source not found", sourceId },
                { status: 404 },
            )
        }

        return HttpResponse.json({
            sourceId,
            accepted: result.accepted,
            status: result.status,
        })
    }),
]
