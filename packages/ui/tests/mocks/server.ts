function ensureBrowserStorageAvailability(): void {
    if (canReadStorage("localStorage") === true && canReadStorage("sessionStorage") === true) {
        return
    }

    const localStorage = createInMemoryStorage()
    const sessionStorage = createInMemoryStorage()

    Object.defineProperty(globalThis, "localStorage", {
        value: localStorage,
        configurable: true,
        writable: true,
    })
    Object.defineProperty(globalThis, "sessionStorage", {
        value: sessionStorage,
        configurable: true,
        writable: true,
    })
}

function canReadStorage(storageKey: "localStorage" | "sessionStorage"): boolean {
    try {
        const targetStorage = globalThis[storageKey]
        return targetStorage !== undefined
    } catch {
        return false
    }
}

function createInMemoryStorage(): Storage {
    const data = new Map<string, string>()

    return {
        get length(): number {
            return data.size
        },
        clear(): void {
            data.clear()
        },
        getItem(key: string): string | null {
            return data.get(key) ?? null
        },
        key(index: number): string | null {
            const keys = Array.from(data.keys())
            return keys[index] ?? null
        },
        removeItem(key: string): void {
            data.delete(key)
        },
        setItem(key: string, value: string): void {
            data.set(key, value)
        },
    }
}

ensureBrowserStorageAvailability()

const { http, HttpResponse } = await import("msw")
const { setupServer } = await import("msw/node")

/**
 * Дефолтный мок health endpoint для UI-интеграционных тестов.
 */
export const server = setupServer(
    http.get("http://localhost:7120/api/v1/auth/session", () => {
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
    http.post("http://localhost:7120/api/v1/auth/session/refresh", () => {
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
    http.post("http://localhost:7120/api/v1/auth/logout", () => {
        return HttpResponse.json({
            loggedOut: true,
        })
    }),
    http.post("http://localhost:7120/api/v1/auth/oauth/start", async ({ request }) => {
        const payload = (await request.json()) as {
            readonly provider?: string
        }

        return HttpResponse.json({
            provider: payload.provider ?? "github",
            authorizationUrl: "https://auth.example/default",
            state: "msw-state",
        })
    }),
    http.get("http://localhost:7120/api/v1/health", () => {
        return HttpResponse.json({
            status: "ok",
            service: "api",
            timestamp: "2026-03-02T00:00:00.000Z",
        })
    }),
    http.get("http://localhost:7120/api/v1/feature-flags", () => {
        return HttpResponse.json({
            flags: {
                premium_dashboard: true,
            },
        })
    }),
    http.get("http://localhost:7120/api/v1/permissions", () => {
        return HttpResponse.json({
            permissions: ["review:read", "settings:read"],
        })
    }),
    http.get("http://localhost:7120/api/v1/context/sources", () => {
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
    http.get("http://localhost:7120/api/v1/context/sources/:sourceId/preview", ({ params }) => {
        return HttpResponse.json({
            sourceId: String(params.sourceId),
            status: "ok",
            items: [],
        })
    }),
    http.put("http://localhost:7120/api/v1/context/sources/:sourceId", ({ params }) => {
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
    http.post("http://localhost:7120/api/v1/context/sources/:sourceId/refresh", ({ params }) => {
        return HttpResponse.json({
            sourceId: String(params.sourceId),
            status: "SYNCING",
        })
    }),
    http.get("http://localhost:7120/api/v1/user/settings", () => {
        return HttpResponse.json({
            updatedAtMs: "2026-03-02T00:00:00.000Z",
        })
    }),
    http.get("http://localhost:7120/api/v1/user/preferences", () => {
        return HttpResponse.json({
            updatedAtMs: "2026-03-02T00:00:00.000Z",
        })
    }),
    http.get("http://localhost:7120/api/v1/rules", () => {
        return HttpResponse.json({
            rules: [],
            total: 0,
        })
    }),
    http.post("http://localhost:7120/api/v1/rules", async ({ request }) => {
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
    http.get("http://localhost:7120/api/v1/rules/:ruleId", ({ params }) => {
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
    http.put("http://localhost:7120/api/v1/rules/:ruleId", ({ params }) => {
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
    http.delete("http://localhost:7120/api/v1/rules/:ruleId", ({ params }) => {
        return HttpResponse.json({
            id: String(params.ruleId),
            removed: true,
        })
    }),
    http.post("http://localhost:7120/api/v1/user/settings", () => {
        return HttpResponse.json({
            updated: true,
        })
    }),
    http.post("http://localhost:7120/api/v1/user/preferences", () => {
        return HttpResponse.json({
            updated: true,
        })
    }),
    http.patch("http://localhost:7120/api/v1/user/settings", () => {
        return HttpResponse.json({
            updated: true,
        })
    }),
    http.patch("http://localhost:7120/api/v1/user/preferences", () => {
        return HttpResponse.json({
            updated: true,
        })
    }),
    http.put("http://localhost:7120/api/v1/user/settings", () => {
        return HttpResponse.json({
            updated: true,
        })
    }),
    http.put("http://localhost:7120/api/v1/user/preferences", () => {
        return HttpResponse.json({
            updated: true,
        })
    }),
    http.get("http://localhost:7120/api/v1/reviews/:reviewId", ({ params }) => {
        const reviewId = String(params.reviewId)

        return HttpResponse.json({
            reviewId,
            repositoryId: "repo-1",
            mergeRequestId: "mr-1",
            status: "completed",
            issues: [],
            metrics: {
                duration: 1000,
            },
        })
    }),
    http.post("http://localhost:7120/api/v1/reviews", () => {
        return HttpResponse.json({
            reviewId: "review-default",
            status: "queued",
        })
    }),
    http.post("http://localhost:7120/api/v1/reviews/:reviewId/feedback", ({ params }) => {
        return HttpResponse.json({
            reviewId: String(params.reviewId),
            acceptedCount: 0,
        })
    }),
    http.get("http://localhost:7120/api/v1/code-city/profiles", () => {
        return HttpResponse.json({
            profiles: [
                {
                    id: "platform-team/api-gateway",
                    label: "platform-team/api-gateway",
                    description:
                        "Backend сервис с активной CCR-маршрутизацией и API слоями.",
                    files: [
                        {
                            id: "src/api/auth.ts",
                            path: "src/api/auth.ts",
                            loc: 96,
                            complexity: 28,
                            coverage: 82,
                            churn: 4,
                            issueCount: 3,
                            bugIntroductions: { "7d": 1, "30d": 3, "90d": 6 },
                            lastReviewAt: "2026-01-05T08:20:00Z",
                        },
                        {
                            id: "src/api/repository.ts",
                            path: "src/api/repository.ts",
                            loc: 126,
                            complexity: 16,
                            coverage: 71,
                            churn: 2,
                            issueCount: 2,
                            bugIntroductions: { "7d": 2, "30d": 4, "90d": 7 },
                            lastReviewAt: "2026-02-01T11:30:00Z",
                        },
                        {
                            id: "src/worker/index.ts",
                            path: "src/worker/index.ts",
                            loc: 138,
                            complexity: 34,
                            coverage: 60,
                            churn: 6,
                            issueCount: 0,
                            bugIntroductions: { "7d": 0, "30d": 2, "90d": 5 },
                            lastReviewAt: "2026-02-10T10:15:00Z",
                        },
                    ],
                    impactedFiles: [
                        { fileId: "src/api/repository.ts", impactType: "changed" },
                        { fileId: "src/api/router.ts", impactType: "impacted" },
                        { fileId: "src/services/metrics.ts", impactType: "ripple" },
                    ],
                    compareFiles: [
                        {
                            complexity: 24,
                            id: "src/api/auth.ts",
                            issueCount: 4,
                            loc: 86,
                            path: "src/api/auth.ts",
                        },
                        {
                            complexity: 14,
                            id: "src/api/repository.ts",
                            issueCount: 3,
                            loc: 108,
                            path: "src/api/repository.ts",
                        },
                        {
                            complexity: 12,
                            id: "src/services/metrics.ts",
                            issueCount: 1,
                            loc: 60,
                            path: "src/services/metrics.ts",
                        },
                    ],
                    temporalCouplings: [
                        {
                            sourceFileId: "src/api/auth.ts",
                            targetFileId: "src/api/repository.ts",
                            strength: 0.82,
                        },
                        {
                            sourceFileId: "src/api/repository.ts",
                            targetFileId: "src/worker/index.ts",
                            strength: 0.56,
                        },
                    ],
                    healthTrend: [
                        {
                            timestamp: "2025-10-20T00:00:00.000Z",
                            healthScore: 61,
                            annotation: "Incident",
                        },
                        { timestamp: "2025-11-15T00:00:00.000Z", healthScore: 66 },
                        {
                            timestamp: "2025-12-20T00:00:00.000Z",
                            healthScore: 72,
                            annotation: "Cache tuning",
                        },
                        { timestamp: "2026-01-18T00:00:00.000Z", healthScore: 78 },
                        {
                            timestamp: "2026-02-01T00:00:00.000Z",
                            healthScore: 82,
                            annotation: "Retry refactor",
                        },
                    ],
                    contributors: [
                        {
                            ownerId: "neo",
                            ownerName: "Neo",
                            color: "#0f766e",
                            commitCount: 42,
                        },
                        {
                            ownerId: "trinity",
                            ownerName: "Trinity",
                            color: "#2563eb",
                            commitCount: 26,
                        },
                        {
                            ownerId: "morpheus",
                            ownerName: "Morpheus",
                            color: "#be123c",
                            commitCount: 13,
                        },
                    ],
                    contributorCollaborations: [
                        {
                            sourceOwnerId: "neo",
                            targetOwnerId: "trinity",
                            coAuthorCount: 9,
                        },
                        {
                            sourceOwnerId: "neo",
                            targetOwnerId: "morpheus",
                            coAuthorCount: 4,
                        },
                        {
                            sourceOwnerId: "trinity",
                            targetOwnerId: "morpheus",
                            coAuthorCount: 3,
                        },
                    ],
                    ownership: [
                        { fileId: "src/api/auth.ts", ownerId: "neo" },
                        { fileId: "src/api/repository.ts", ownerId: "neo" },
                        { fileId: "src/worker/index.ts", ownerId: "trinity" },
                    ],
                },
                {
                    id: "frontend-team/ui-dashboard",
                    label: "frontend-team/ui-dashboard",
                    description:
                        "Frontend SPA для управления pipeline и наблюдаемостью.",
                    files: [
                        {
                            id: "src/pages/ccr-management.page.tsx",
                            path: "src/pages/ccr-management.page.tsx",
                            loc: 112,
                            complexity: 14,
                            coverage: 88,
                            churn: 5,
                            issueCount: 1,
                            bugIntroductions: { "7d": 1, "30d": 2, "90d": 3 },
                            lastReviewAt: "2026-01-12T16:40:00Z",
                        },
                        {
                            id: "src/components/codecity/codecity-treemap.tsx",
                            path: "src/components/codecity/codecity-treemap.tsx",
                            loc: 142,
                            complexity: 18,
                            coverage: 90,
                            churn: 1,
                            issueCount: 0,
                            bugIntroductions: { "7d": 0, "30d": 1, "90d": 2 },
                            lastReviewAt: "2026-02-07T09:00:00Z",
                        },
                        {
                            id: "src/components/layout/sidebar.tsx",
                            path: "src/components/layout/sidebar.tsx",
                            loc: 64,
                            complexity: 11,
                            coverage: 94,
                            churn: 3,
                            issueCount: 2,
                            bugIntroductions: { "7d": 1, "30d": 3, "90d": 4 },
                            lastReviewAt: "2026-02-09T13:55:00Z",
                        },
                        {
                            id: "src/pages/repositories-list.page.tsx",
                            path: "src/pages/repositories-list.page.tsx",
                            loc: 188,
                            complexity: 22,
                            coverage: 81,
                            churn: 0,
                            issueCount: 1,
                            bugIntroductions: { "7d": 1, "30d": 2, "90d": 5 },
                            lastReviewAt: "2026-02-10T14:10:00Z",
                        },
                    ],
                    impactedFiles: [
                        {
                            fileId: "src/pages/ccr-management.page.tsx",
                            impactType: "changed",
                        },
                        {
                            fileId: "src/components/layout/sidebar.tsx",
                            impactType: "changed",
                        },
                        {
                            fileId: "src/components/codecity/codecity-treemap.tsx",
                            impactType: "impacted",
                        },
                    ],
                    compareFiles: [
                        {
                            complexity: 10,
                            id: "src/pages/ccr-management.page.tsx",
                            issueCount: 1,
                            loc: 98,
                            path: "src/pages/ccr-management.page.tsx",
                        },
                        {
                            complexity: 16,
                            id: "src/components/layout/sidebar.tsx",
                            issueCount: 0,
                            loc: 56,
                            path: "src/components/layout/sidebar.tsx",
                        },
                    ],
                    temporalCouplings: [
                        {
                            sourceFileId: "src/pages/ccr-management.page.tsx",
                            targetFileId: "src/components/codecity/codecity-treemap.tsx",
                            strength: 0.74,
                        },
                        {
                            sourceFileId: "src/components/layout/sidebar.tsx",
                            targetFileId: "src/pages/repositories-list.page.tsx",
                            strength: 0.48,
                        },
                    ],
                    healthTrend: [
                        { timestamp: "2025-10-20T00:00:00.000Z", healthScore: 70 },
                        {
                            timestamp: "2025-11-15T00:00:00.000Z",
                            healthScore: 73,
                            annotation: "UI migration",
                        },
                        { timestamp: "2025-12-20T00:00:00.000Z", healthScore: 76 },
                        { timestamp: "2026-01-18T00:00:00.000Z", healthScore: 81 },
                        {
                            timestamp: "2026-02-01T00:00:00.000Z",
                            healthScore: 85,
                            annotation: "HeroUI rollout",
                        },
                    ],
                    contributors: [
                        {
                            ownerId: "niobe",
                            ownerName: "Niobe",
                            color: "#0f766e",
                            commitCount: 51,
                        },
                        {
                            ownerId: "tank",
                            ownerName: "Tank",
                            color: "#2563eb",
                            commitCount: 37,
                        },
                        {
                            ownerId: "switch",
                            ownerName: "Switch",
                            color: "#ca8a04",
                            commitCount: 23,
                        },
                    ],
                    contributorCollaborations: [
                        {
                            sourceOwnerId: "niobe",
                            targetOwnerId: "tank",
                            coAuthorCount: 11,
                        },
                        {
                            sourceOwnerId: "tank",
                            targetOwnerId: "switch",
                            coAuthorCount: 6,
                        },
                        {
                            sourceOwnerId: "niobe",
                            targetOwnerId: "switch",
                            coAuthorCount: 5,
                        },
                    ],
                    ownership: [
                        {
                            fileId: "src/pages/ccr-management.page.tsx",
                            ownerId: "niobe",
                        },
                        {
                            fileId: "src/components/codecity/codecity-treemap.tsx",
                            ownerId: "tank",
                        },
                        {
                            fileId: "src/components/layout/sidebar.tsx",
                            ownerId: "switch",
                        },
                        {
                            fileId: "src/pages/repositories-list.page.tsx",
                            ownerId: "niobe",
                        },
                    ],
                },
                {
                    id: "backend-core/payment-worker",
                    label: "backend-core/payment-worker",
                    description:
                        "Worker-пайплайн с повышенными очередями и задачами background-обработки.",
                    files: [
                        {
                            id: "src/adapters/queue.ts",
                            path: "src/adapters/queue.ts",
                            loc: 210,
                            complexity: 38,
                            coverage: 67,
                            churn: 8,
                            issueCount: 4,
                            bugIntroductions: { "7d": 3, "30d": 6, "90d": 10 },
                            lastReviewAt: "2026-01-03T19:30:00Z",
                        },
                        {
                            id: "src/services/retry.ts",
                            path: "src/services/retry.ts",
                            loc: 112,
                            complexity: 20,
                            coverage: 73,
                            churn: 7,
                            issueCount: 2,
                            bugIntroductions: { "7d": 2, "30d": 5, "90d": 8 },
                            lastReviewAt: "2026-01-17T07:48:00Z",
                        },
                        {
                            id: "src/worker/main.ts",
                            path: "src/worker/main.ts",
                            loc: 76,
                            complexity: 15,
                            coverage: 79,
                            churn: 1,
                            issueCount: 0,
                            bugIntroductions: { "7d": 0, "30d": 1, "90d": 2 },
                            lastReviewAt: "2026-01-20T15:16:00Z",
                        },
                    ],
                    impactedFiles: [
                        { fileId: "src/adapters/queue.ts", impactType: "changed" },
                        { fileId: "src/services/retry.ts", impactType: "impacted" },
                    ],
                    compareFiles: [
                        {
                            complexity: 34,
                            id: "src/services/retry.ts",
                            issueCount: 3,
                            loc: 95,
                            path: "src/services/retry.ts",
                        },
                        {
                            complexity: 40,
                            id: "src/adapters/queue.ts",
                            issueCount: 2,
                            loc: 182,
                            path: "src/adapters/queue.ts",
                        },
                    ],
                    temporalCouplings: [
                        {
                            sourceFileId: "src/adapters/queue.ts",
                            targetFileId: "src/services/retry.ts",
                            strength: 0.91,
                        },
                        {
                            sourceFileId: "src/services/retry.ts",
                            targetFileId: "src/worker/main.ts",
                            strength: 0.42,
                        },
                    ],
                    healthTrend: [
                        {
                            timestamp: "2025-10-20T00:00:00.000Z",
                            healthScore: 57,
                            annotation: "Queue spike",
                        },
                        { timestamp: "2025-11-15T00:00:00.000Z", healthScore: 60 },
                        { timestamp: "2025-12-20T00:00:00.000Z", healthScore: 65 },
                        {
                            timestamp: "2026-01-18T00:00:00.000Z",
                            healthScore: 69,
                            annotation: "Backpressure patch",
                        },
                        { timestamp: "2026-02-01T00:00:00.000Z", healthScore: 74 },
                    ],
                    contributors: [
                        {
                            ownerId: "cypher",
                            ownerName: "Cypher",
                            color: "#be123c",
                            commitCount: 46,
                        },
                        {
                            ownerId: "apoc",
                            ownerName: "Apoc",
                            color: "#2563eb",
                            commitCount: 31,
                        },
                        {
                            ownerId: "mouse",
                            ownerName: "Mouse",
                            color: "#0f766e",
                            commitCount: 18,
                        },
                    ],
                    contributorCollaborations: [
                        {
                            sourceOwnerId: "cypher",
                            targetOwnerId: "apoc",
                            coAuthorCount: 12,
                        },
                        {
                            sourceOwnerId: "apoc",
                            targetOwnerId: "mouse",
                            coAuthorCount: 5,
                        },
                        {
                            sourceOwnerId: "cypher",
                            targetOwnerId: "mouse",
                            coAuthorCount: 3,
                        },
                    ],
                    ownership: [
                        { fileId: "src/adapters/queue.ts", ownerId: "cypher" },
                        { fileId: "src/services/retry.ts", ownerId: "apoc" },
                        { fileId: "src/worker/main.ts", ownerId: "mouse" },
                    ],
                },
            ],
        })
    }),
    http.get("http://localhost:7120/api/v1/token-usage", () => {
        return HttpResponse.json({
            rows: [],
            records: [],
        })
    }),
    http.get("http://localhost:7120/api/v1/audit-logs", () => {
        return HttpResponse.json({
            items: [],
            total: 0,
            page: 1,
            limit: 20,
            totalPages: 0,
        })
    }),
    http.get(
        "http://localhost:7120/api/v1/code-city/profiles/:repoId/dependency-graph",
        () => {
            return HttpResponse.json({
                nodes: [
                    {
                        id: "platform-team/api-gateway",
                        name: "platform-team/api-gateway",
                        layer: "api",
                        size: 22,
                    },
                    {
                        id: "frontend-team/ui-dashboard",
                        name: "frontend-team/ui-dashboard",
                        layer: "ui",
                        size: 18,
                    },
                    {
                        id: "backend-core/payment-worker",
                        name: "backend-core/payment-worker",
                        layer: "worker",
                        size: 20,
                    },
                ],
                relations: [
                    {
                        source: "frontend-team/ui-dashboard",
                        target: "platform-team/api-gateway",
                        relationType: "runtime",
                    },
                    {
                        source: "platform-team/api-gateway",
                        target: "backend-core/payment-worker",
                        relationType: "runtime",
                    },
                    {
                        source: "frontend-team/ui-dashboard",
                        target: "backend-core/payment-worker",
                        relationType: "peer",
                    },
                    {
                        source: "backend-core/payment-worker",
                        target: "platform-team/api-gateway",
                        relationType: "build",
                    },
                ],
            })
        },
    ),
)
