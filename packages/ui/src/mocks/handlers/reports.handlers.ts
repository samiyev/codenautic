import { http, HttpResponse, delay } from "msw"

import type {
    ICreateReportRequest,
    IReport,
    TReportStatus,
    TReportType,
} from "@/lib/api/endpoints/reports.endpoint"

import { getMockStore } from "../store/create-mock-store"
import { api, generateId } from "./handler-utils"

/**
 * MSW handlers для Reports API.
 *
 * Обрабатывают CRUD-операции отчётов: list, get, create, delete.
 * Используют ReportsCollection из mock store для хранения состояния.
 */
export const reportsHandlers = [
    /**
     * GET /reports — возвращает список отчётов с опциональными фильтрами.
     */
    http.get(api("/reports"), async ({ request }) => {
        await delay(100)
        const store = getMockStore()
        const url = new URL(request.url)
        const typeFilter = url.searchParams.get("type") as TReportType | null
        const statusFilter = url.searchParams.get("status") as TReportStatus | null

        let reports = store.reports.listReports()

        if (typeFilter !== null) {
            reports = reports.filter(
                (report): boolean => report.type === typeFilter,
            )
        }

        if (statusFilter !== null) {
            reports = reports.filter(
                (report): boolean => report.status === statusFilter,
            )
        }

        return HttpResponse.json({
            reports,
            total: reports.length,
        })
    }),

    /**
     * GET /reports/:id — возвращает полные данные отчёта.
     */
    http.get(api("/reports/:id"), async ({ params }) => {
        await delay(150)
        const store = getMockStore()
        const id = params["id"] as string

        const report = store.reports.getReportById(id)

        if (report === undefined) {
            return HttpResponse.json(
                { error: "Report not found", id },
                { status: 404 },
            )
        }

        const trends = store.reports.getTrends()
        const distribution = store.reports.getDistribution()

        return HttpResponse.json({ report, trends, distribution })
    }),

    /**
     * POST /reports — создаёт новый отчёт.
     */
    http.post(api("/reports"), async ({ request }) => {
        await delay(200)
        const store = getMockStore()
        const body = (await request.json()) as ICreateReportRequest

        const newReport: IReport = {
            id: generateId("report"),
            title: body.title,
            type: body.type,
            format: body.format,
            status: "queued",
            createdAt: new Date().toISOString().slice(0, 10),
            sections: body.sections,
        }

        store.reports.addReport(newReport)

        return HttpResponse.json(newReport, { status: 201 })
    }),

    /**
     * DELETE /reports/:id — удаляет отчёт.
     */
    http.delete(api("/reports/:id"), async ({ params }) => {
        await delay(100)
        const store = getMockStore()
        const id = params["id"] as string

        const deleted = store.reports.deleteReport(id)

        return HttpResponse.json({ deleted })
    }),
]
