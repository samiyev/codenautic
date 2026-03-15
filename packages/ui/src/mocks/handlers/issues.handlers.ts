import { http, HttpResponse, delay } from "msw"

import { getMockStore } from "../store/create-mock-store"
import type {
    TIssueAction,
    TIssueSeverity,
    TIssueStatus,
} from "@/lib/api/endpoints/issues.endpoint"
import { api } from "./handler-utils"

/** Допустимые значения статуса для валидации query params. */
const VALID_STATUSES = new Set<string>(["dismissed", "fixed", "in_progress", "open"])

/** Допустимые значения severity для валидации query params. */
const VALID_SEVERITIES = new Set<string>(["critical", "high", "medium", "low"])

/**
 * MSW handlers для issues API.
 *
 * Обрабатывают чтение и действия над проблемами.
 * Используют IssuesCollection из mock store для хранения состояния.
 */
export const issuesHandlers = [
    /**
     * GET /issues — возвращает отфильтрованный список issues.
     */
    http.get(api("/issues"), async ({ request }) => {
        await delay(80)
        const store = getMockStore()
        const url = new URL(request.url)
        const rawStatus = url.searchParams.get("status") ?? undefined
        const rawSeverity = url.searchParams.get("severity") ?? undefined
        const search = url.searchParams.get("search") ?? undefined

        const status =
            rawStatus !== undefined && VALID_STATUSES.has(rawStatus)
                ? (rawStatus as TIssueStatus)
                : undefined
        const severity =
            rawSeverity !== undefined && VALID_SEVERITIES.has(rawSeverity)
                ? (rawSeverity as TIssueSeverity)
                : undefined

        const issues = store.issues.listIssues({
            status,
            severity,
            search,
        })

        return HttpResponse.json({
            issues,
            total: issues.length,
        })
    }),

    /**
     * GET /issues/:issueId — возвращает issue по ID.
     */
    http.get(api("/issues/:issueId"), async ({ params }) => {
        await delay(60)
        const store = getMockStore()
        const issueId = params["issueId"] as string
        const issue = store.issues.getIssueById(issueId)

        if (issue === undefined) {
            return HttpResponse.json(
                { error: "Issue not found", issueId },
                { status: 404 },
            )
        }

        return HttpResponse.json(issue)
    }),

    /**
     * PATCH /issues/:issueId/action — выполняет действие над issue.
     */
    http.patch(api("/issues/:issueId/action"), async ({ params, request }) => {
        await delay(100)
        const store = getMockStore()
        const issueId = params["issueId"] as string
        const body = (await request.json()) as { readonly action: TIssueAction }

        const updated = store.issues.performAction(issueId, body.action)

        if (updated === undefined) {
            return HttpResponse.json(
                { error: "Issue not found", issueId },
                { status: 404 },
            )
        }

        return HttpResponse.json({ issue: updated })
    }),
]
