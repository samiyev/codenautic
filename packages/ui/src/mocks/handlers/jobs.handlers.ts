import { http, HttpResponse, delay } from "msw"

import { getMockStore } from "../store/create-mock-store"
import type { TJobAction, TScheduleTarget, IJobSchedule } from "@/lib/api/endpoints/jobs.endpoint"
import { api } from "./handler-utils"

/**
 * MSW handlers для Jobs API.
 *
 * Обрабатывают операции над operations jobs, audit trail и расписаниями.
 * Используют JobsCollection из mock store для хранения состояния.
 */
export const jobsHandlers = [
    /**
     * GET /jobs — возвращает список jobs и audit trail.
     */
    http.get(api("/jobs"), async () => {
        await delay(80)
        const store = getMockStore()
        const jobs = store.jobs.listJobs()
        const audit = store.jobs.listAudit()

        return HttpResponse.json({ jobs, audit })
    }),

    /**
     * PATCH /jobs/:jobId/action — выполняет действие над job.
     */
    http.patch(api("/jobs/:jobId/action"), async ({ params, request }) => {
        await delay(100)
        const store = getMockStore()
        const jobId = params["jobId"] as string
        const body = (await request.json()) as { readonly action: TJobAction }

        const result = store.jobs.performAction(jobId, body.action)

        if (result === undefined) {
            return HttpResponse.json(
                { error: "Job not found", jobId },
                { status: 404 },
            )
        }

        return HttpResponse.json(result)
    }),

    /**
     * GET /jobs/schedules — возвращает расписания scheduler targets.
     */
    http.get(api("/jobs/schedules"), async () => {
        await delay(60)
        const store = getMockStore()
        const schedules = store.jobs.getSchedules()

        return HttpResponse.json({ schedules })
    }),

    /**
     * PUT /jobs/schedules — обновляет расписание scheduler target.
     */
    http.put(api("/jobs/schedules"), async ({ request }) => {
        await delay(100)
        const store = getMockStore()
        const body = (await request.json()) as {
            readonly target: TScheduleTarget
            readonly schedule: IJobSchedule
        }

        store.jobs.updateSchedule(body.target, body.schedule)
        const schedules = store.jobs.getSchedules()

        return HttpResponse.json({ schedules })
    }),
]
