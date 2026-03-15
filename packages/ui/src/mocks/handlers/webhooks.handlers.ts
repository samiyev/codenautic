import { http, HttpResponse, delay } from "msw"

import { getMockStore } from "../store/create-mock-store"
import type {
    ICreateWebhookData,
    IUpdateWebhookData,
} from "../store/collections/webhooks-collection"
import { api } from "./handler-utils"

/**
 * MSW handlers для Webhooks API.
 *
 * Обрабатывают CRUD-операции над webhook endpoints и delivery logs.
 * Используют WebhooksCollection из mock store для хранения состояния.
 */
export const webhooksHandlers = [
    /**
     * GET /webhooks — возвращает список webhook endpoints и delivery logs.
     */
    http.get(api("/webhooks"), async () => {
        await delay(80)
        const store = getMockStore()
        const webhooks = store.webhooks.listWebhooks()
        const deliveryLogs = store.webhooks.listDeliveryLogs()

        return HttpResponse.json({ webhooks, deliveryLogs })
    }),

    /**
     * POST /webhooks — создаёт новый webhook endpoint.
     */
    http.post(api("/webhooks"), async ({ request }) => {
        await delay(120)
        const store = getMockStore()
        const body = (await request.json()) as ICreateWebhookData

        const created = store.webhooks.createWebhook(body)
        return HttpResponse.json(created, { status: 201 })
    }),

    /**
     * PUT /webhooks/:webhookId — обновляет webhook endpoint.
     */
    http.put(api("/webhooks/:webhookId"), async ({ params, request }) => {
        await delay(100)
        const store = getMockStore()
        const webhookId = params["webhookId"] as string
        const body = (await request.json()) as IUpdateWebhookData

        const updated = store.webhooks.updateWebhook(webhookId, body)

        if (updated === undefined) {
            return HttpResponse.json(
                { error: "Webhook not found", webhookId },
                { status: 404 },
            )
        }

        return HttpResponse.json(updated)
    }),

    /**
     * DELETE /webhooks/:webhookId — удаляет webhook endpoint.
     */
    http.delete(api("/webhooks/:webhookId"), async ({ params }) => {
        await delay(80)
        const store = getMockStore()
        const webhookId = params["webhookId"] as string
        const removed = store.webhooks.deleteWebhook(webhookId)

        if (!removed) {
            return HttpResponse.json(
                { error: "Webhook not found", webhookId },
                { status: 404 },
            )
        }

        return HttpResponse.json({ id: webhookId, removed: true })
    }),

    /**
     * GET /webhooks/:webhookId/deliveries — возвращает delivery logs для endpoint.
     */
    http.get(api("/webhooks/:webhookId/deliveries"), async ({ params }) => {
        await delay(60)
        const store = getMockStore()
        const webhookId = params["webhookId"] as string
        const deliveries = store.webhooks.getDeliveriesForEndpoint(webhookId)

        return HttpResponse.json(deliveries)
    }),
]
