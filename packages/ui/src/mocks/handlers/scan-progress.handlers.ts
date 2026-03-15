import { http, HttpResponse, delay } from "msw"

import { getMockStore } from "../store/create-mock-store"
import { api } from "./handler-utils"

/**
 * MSW handlers для Scan Progress API.
 *
 * Обрабатывают запросы прогресса сканирования по jobId.
 */
export const scanProgressHandlers = [
    /**
     * GET /scans/:jobId/progress — возвращает события прогресса.
     */
    http.get(api("/scans/:jobId/progress"), async ({ params }) => {
        await delay(80)
        const store = getMockStore()
        const jobId = typeof params.jobId === "string" ? params.jobId : "unknown"

        const data = store.scanProgress.getProgress(jobId)
        return HttpResponse.json(data)
    }),
]
