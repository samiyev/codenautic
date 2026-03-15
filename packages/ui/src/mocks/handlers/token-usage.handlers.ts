import { http, HttpResponse, delay } from "msw"

import { getMockStore } from "../store/create-mock-store"
import type {
    TTokenUsageGroupBy,
    TTokenUsageRange,
} from "@/lib/api/endpoints/token-usage.endpoint"
import { api } from "./handler-utils"

/**
 * Допустимые значения диапазона дат.
 */
const VALID_RANGES = new Set<string>(["1d", "7d", "30d", "90d"])

/**
 * Допустимые значения группировки.
 */
const VALID_GROUP_BY = new Set<string>(["model", "developer", "ccr"])

/**
 * MSW handlers для Token Usage API.
 *
 * Обрабатывают запросы token usage с масштабированием по диапазону
 * и агрегацией по выбранной группировке.
 */
export const tokenUsageHandlers = [
    /**
     * GET /token-usage — возвращает агрегированные данные и сырые записи.
     */
    http.get(api("/token-usage"), async ({ request }) => {
        await delay(80)
        const store = getMockStore()
        const url = new URL(request.url)

        const rangeParam = url.searchParams.get("range") ?? "7d"
        const groupByParam = url.searchParams.get("groupBy") ?? "model"

        const range: TTokenUsageRange = VALID_RANGES.has(rangeParam)
            ? (rangeParam as TTokenUsageRange)
            : "7d"
        const groupBy: TTokenUsageGroupBy = VALID_GROUP_BY.has(groupByParam)
            ? (groupByParam as TTokenUsageGroupBy)
            : "model"

        const rows = store.tokenUsage.getAggregated(range, groupBy)
        const records = store.tokenUsage.getScaledRecords(range)

        return HttpResponse.json({ rows, records })
    }),
]
