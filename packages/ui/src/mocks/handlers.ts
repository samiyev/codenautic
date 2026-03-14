import { http, HttpResponse } from "msw"

const API = "http://localhost:7120/api/v1"

/**
 * MSW request handlers для dev-режима.
 * Переиспользуют те же ответы, что и тестовый server.ts.
 */
export const handlers = [
    http.get(`${API}/auth/session`, () => {
        return HttpResponse.json({
            session: {
                provider: "github",
                expiresAt: "2030-01-01T00:00:00.000Z",
                user: {
                    id: "u-default",
                    email: "neo@metacortex.com",
                    displayName: "Neo",
                    role: "admin",
                    tenantId: "platform-team",
                },
            },
        })
    }),
    http.post(`${API}/auth/session/refresh`, () => {
        return HttpResponse.json({
            session: {
                provider: "github",
                expiresAt: "2030-01-01T00:00:00.000Z",
                user: {
                    id: "u-default",
                    email: "neo@metacortex.com",
                    displayName: "Neo",
                    role: "admin",
                    tenantId: "platform-team",
                },
            },
        })
    }),
    http.post(`${API}/auth/logout`, () => {
        return HttpResponse.json({ loggedOut: true })
    }),
    http.post(`${API}/auth/oauth/start`, async ({ request }) => {
        const payload = (await request.json()) as { readonly provider?: string }
        return HttpResponse.json({
            provider: payload.provider ?? "github",
            authorizationUrl: "https://auth.example/default",
            state: "msw-state",
        })
    }),
    http.get(`${API}/health`, () => {
        return HttpResponse.json({
            status: "ok",
            service: "api",
            timestamp: new Date().toISOString(),
        })
    }),
    http.get(`${API}/feature-flags`, () => {
        return HttpResponse.json({
            flags: { premium_dashboard: true },
        })
    }),
    http.get(`${API}/permissions`, () => {
        return HttpResponse.json({
            permissions: ["review:read", "settings:read", "settings:write", "admin:read"],
        })
    }),
    http.get(`${API}/context/sources`, () => {
        return HttpResponse.json({
            total: 2,
            sources: [
                {
                    id: "source-jira",
                    provider: "JIRA",
                    status: "CONNECTED",
                    enabled: true,
                    lastSyncedAt: "2026-03-01T09:30:00.000Z",
                    itemCount: 38,
                },
                {
                    id: "source-sentry",
                    provider: "SENTRY",
                    status: "DEGRADED",
                    enabled: true,
                    lastSyncedAt: "2026-03-01T08:00:00.000Z",
                    itemCount: 12,
                },
            ],
        })
    }),
    http.get(`${API}/context/sources/:sourceId/preview`, ({ params }) => {
        return HttpResponse.json({
            sourceId: String(params.sourceId),
            status: "ok",
            items: [],
        })
    }),
    http.put(`${API}/context/sources/:sourceId`, ({ params }) => {
        return HttpResponse.json({
            source: {
                id: String(params.sourceId),
                provider: "JIRA",
                status: "CONNECTED",
                enabled: true,
                lastSyncedAt: "2026-03-01T09:30:00.000Z",
                itemCount: 38,
            },
        })
    }),
    http.post(`${API}/context/sources/:sourceId/refresh`, ({ params }) => {
        return HttpResponse.json({
            sourceId: String(params.sourceId),
            status: "SYNCING",
        })
    }),
    http.get(`${API}/user/settings`, () => {
        return HttpResponse.json({ updatedAtMs: "2026-03-02T00:00:00.000Z" })
    }),
    http.get(`${API}/user/preferences`, () => {
        return HttpResponse.json({ updatedAtMs: "2026-03-02T00:00:00.000Z" })
    }),
    http.get(`${API}/rules`, () => {
        return HttpResponse.json({ rules: [], total: 0 })
    }),
    http.post(`${API}/rules`, async ({ request }) => {
        const payload = (await request.json()) as {
            readonly title?: string
            readonly rule?: string
            readonly type?: string
            readonly scope?: string
            readonly severity?: string
            readonly status?: string
            readonly examples?: readonly unknown[]
        }
        return HttpResponse.json({
            id: "rule-default",
            title: payload.title ?? "Default rule",
            rule: payload.rule ?? "",
            type: payload.type ?? "REGEX",
            scope: payload.scope ?? "FILE",
            severity: payload.severity ?? "LOW",
            status: payload.status ?? "ACTIVE",
            examples: payload.examples ?? [],
        })
    }),
    http.get(`${API}/rules/:ruleId`, ({ params }) => {
        return HttpResponse.json({
            id: String(params.ruleId),
            title: "Default rule",
            rule: "title !== ''",
            type: "REGEX",
            scope: "FILE",
            severity: "LOW",
            status: "ACTIVE",
            examples: [],
        })
    }),
    http.put(`${API}/rules/:ruleId`, ({ params }) => {
        return HttpResponse.json({
            id: String(params.ruleId),
            title: "Updated rule",
            rule: "title !== ''",
            type: "REGEX",
            scope: "FILE",
            severity: "LOW",
            status: "ACTIVE",
            examples: [],
        })
    }),
    http.delete(`${API}/rules/:ruleId`, ({ params }) => {
        return HttpResponse.json({ id: String(params.ruleId), removed: true })
    }),
    http.post(`${API}/user/settings`, () => {
        return HttpResponse.json({ updated: true })
    }),
    http.post(`${API}/user/preferences`, () => {
        return HttpResponse.json({ updated: true })
    }),
    http.patch(`${API}/user/settings`, () => {
        return HttpResponse.json({ updated: true })
    }),
    http.patch(`${API}/user/preferences`, () => {
        return HttpResponse.json({ updated: true })
    }),
    http.put(`${API}/user/settings`, () => {
        return HttpResponse.json({ updated: true })
    }),
    http.put(`${API}/user/preferences`, () => {
        return HttpResponse.json({ updated: true })
    }),
    http.get(`${API}/reviews/:reviewId`, ({ params }) => {
        return HttpResponse.json({
            reviewId: String(params.reviewId),
            repositoryId: "repo-1",
            mergeRequestId: "mr-1",
            status: "completed",
            issues: [],
            metrics: { duration: 1000 },
        })
    }),
    http.post(`${API}/reviews`, () => {
        return HttpResponse.json({ reviewId: "review-default", status: "queued" })
    }),
    http.post(`${API}/reviews/:reviewId/feedback`, ({ params }) => {
        return HttpResponse.json({
            reviewId: String(params.reviewId),
            acceptedCount: 0,
        })
    }),
]
