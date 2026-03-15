import { http, HttpResponse, delay } from "msw"

import { getMockStore } from "../store/create-mock-store"
import type { TTriageAction, TTriageScope } from "@/lib/api/endpoints/triage.endpoint"
import { api } from "./handler-utils"

/**
 * MSW handlers для triage API.
 *
 * Обрабатывают чтение и действия над triage items.
 * Используют TriageCollection из mock store для хранения состояния.
 */
export const triageHandlers = [
    /**
     * GET /triage — возвращает отфильтрованный список triage items.
     */
    http.get(api("/triage"), async ({ request }) => {
        await delay(80)
        const store = getMockStore()
        const url = new URL(request.url)
        const scope = (url.searchParams.get("scope") ?? undefined) as
            | TTriageScope
            | undefined

        const items = store.triage.listItems({ scope })

        return HttpResponse.json({
            items,
            total: items.length,
        })
    }),

    /**
     * PATCH /triage/:itemId/action — выполняет действие над triage item.
     */
    http.patch(api("/triage/:itemId/action"), async ({ params, request }) => {
        await delay(100)
        const store = getMockStore()
        const itemId = params["itemId"] as string
        const body = (await request.json()) as { readonly action: TTriageAction }

        const updated = store.triage.performAction(itemId, body.action)

        if (updated === undefined) {
            return HttpResponse.json(
                { error: "Triage item not found", itemId },
                { status: 404 },
            )
        }

        return HttpResponse.json({ item: updated })
    }),
]
