import { http, HttpResponse, delay } from "msw"

import { getMockStore } from "../store/create-mock-store"
import type { TPlanName, TBillingStatus } from "@/lib/api/endpoints/billing.endpoint"
import { api } from "./handler-utils"

/**
 * MSW handlers для Billing API.
 *
 * Обрабатывают операции над billing snapshot и историей изменений.
 * Используют BillingCollection из mock store для хранения состояния.
 */
export const billingHandlers = [
    /**
     * GET /billing — возвращает текущий snapshot биллинга и историю.
     */
    http.get(api("/billing"), async () => {
        await delay(80)
        const store = getMockStore()
        const snapshot = store.billing.getSnapshot()
        const history = store.billing.getHistory()

        return HttpResponse.json({ snapshot, history })
    }),

    /**
     * PUT /billing/plan — обновляет план и/или статус.
     */
    http.put(api("/billing/plan"), async ({ request }) => {
        await delay(100)
        const store = getMockStore()
        const body = (await request.json()) as {
            readonly plan?: TPlanName
            readonly status?: TBillingStatus
        }

        store.billing.updatePlan(body.plan, body.status)
        const snapshot = store.billing.getSnapshot()
        const history = store.billing.getHistory()

        return HttpResponse.json({ snapshot, history })
    }),

    /**
     * GET /billing/history — возвращает историю изменений.
     */
    http.get(api("/billing/history"), async () => {
        await delay(60)
        const store = getMockStore()
        const history = store.billing.getHistory()

        return HttpResponse.json(history)
    }),
]
