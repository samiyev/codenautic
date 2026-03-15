import { http, HttpResponse, delay } from "msw"

import { getMockStore } from "../store/create-mock-store"
import type { TAnalyticsRange } from "@/lib/api/endpoints/adoption-analytics.endpoint"
import { api } from "./handler-utils"

/**
 * Допустимые значения диапазона дат.
 */
const VALID_RANGES = new Set<string>(["7d", "30d", "90d"])

/**
 * MSW handlers для Adoption Analytics API.
 *
 * Обрабатывают запросы adoption analytics с фильтрацией по диапазону.
 */
export const adoptionAnalyticsHandlers = [
    /**
     * GET /analytics/adoption — возвращает funnel, workflow health, KPI.
     */
    http.get(api("/analytics/adoption"), async ({ request }) => {
        await delay(80)
        const store = getMockStore()
        const url = new URL(request.url)

        const rangeParam = url.searchParams.get("range") ?? "30d"
        const range: TAnalyticsRange = VALID_RANGES.has(rangeParam)
            ? (rangeParam as TAnalyticsRange)
            : "30d"

        const data = store.adoptionAnalytics.getByRange(range)
        return HttpResponse.json(data)
    }),
]
