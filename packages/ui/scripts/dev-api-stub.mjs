import { Buffer } from "node:buffer"
import { createServer } from "node:http"
import process from "node:process"
import { URL } from "node:url"

const DEV_UI_ORIGIN = "http://localhost:7110"
const DEV_API_PORT = 7120

const defaultSession = {
    provider: "github",
    expiresAt: "2030-01-01T00:00:00.000Z",
    user: {
        id: "u-default",
        email: "default@example.com",
        displayName: "Default User",
        role: "admin",
        tenantId: "platform-team",
    },
}

const featureFlags = {
    premium_dashboard: true,
}

const permissions = ["review:read", "settings:read"]

const contextSources = [
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
]

const themePreferencesState = {
    updatedAtMs: new Date().toISOString(),
}

const rulesState = new Map()

function createCorsHeaders(origin) {
    return {
        Vary: "Origin",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Trace-Id, X-Requested-With",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Expose-Headers": "Content-Type",
        "Access-Control-Allow-Origin": origin === DEV_UI_ORIGIN ? origin : DEV_UI_ORIGIN,
    }
}

function writeJson(response, origin, payload, statusCode = 200) {
    const body = JSON.stringify(payload)

    response.writeHead(statusCode, {
        ...createCorsHeaders(origin),
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
    })
    response.end(body)
}

function writeEmpty(response, origin, statusCode = 204) {
    response.writeHead(statusCode, createCorsHeaders(origin))
    response.end()
}

function writeNotFound(response, origin, path) {
    writeJson(
        response,
        origin,
        {
            error: "not_found",
            path,
        },
        404,
    )
}

function readRequestBody(request) {
    return new Promise((resolve) => {
        const chunks = []

        request.on("data", (chunk) => {
            chunks.push(Buffer.from(chunk))
        })

        request.on("end", () => {
            if (chunks.length === 0) {
                resolve({})
                return
            }

            try {
                const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"))
                if (isObject(parsed) === true) {
                    resolve(parsed)
                    return
                }
            } catch {
                resolve({})
                return
            }

            resolve({})
        })

        request.on("error", () => {
            resolve({})
        })
    })
}

function isObject(value) {
    return typeof value === "object" && value !== null && Array.isArray(value) === false
}

function asString(value) {
    return typeof value === "string" ? value : undefined
}

function asArray(value) {
    return Array.isArray(value) ? value : []
}

function parseRulePayload(payload, ruleId) {
    return {
        id: ruleId,
        title: asString(payload.title) ?? "Default rule",
        rule: asString(payload.rule) ?? "",
        type: asString(payload.type) ?? "REGEX",
        scope: asString(payload.scope) ?? "FILE",
        severity: asString(payload.severity) ?? "LOW",
        status: asString(payload.status) ?? "ACTIVE",
        examples: asArray(payload.examples),
    }
}

function themePayloadFromState() {
    if (themePreferencesState.mode !== undefined || themePreferencesState.preset !== undefined) {
        return {
            mode: themePreferencesState.mode,
            preset: themePreferencesState.preset,
        }
    }

    return {}
}

async function handleThemePreferencesMutation(request, response, origin) {
    const payload = await readRequestBody(request)
    const themePayload = isObject(payload.theme)
        ? payload.theme
        : isObject(payload.preferences)
          ? payload.preferences
          : isObject(payload.settings)
            ? payload.settings
            : payload

    const mode = asString(themePayload.mode) ?? asString(themePayload.themeMode)
    const preset = asString(themePayload.preset) ?? asString(themePayload.themePreset)

    if (mode !== undefined) {
        themePreferencesState.mode = mode
    }

    if (preset !== undefined) {
        themePreferencesState.preset = preset
    }

    themePreferencesState.updatedAtMs = new Date().toISOString()

    writeJson(response, origin, {
        updated: true,
        updatedAtMs: themePreferencesState.updatedAtMs,
    })
}

function handleThemePreferencesRead(response, origin) {
    writeJson(response, origin, {
        ...themePreferencesState,
        theme: themePayloadFromState(),
    })
}

function handleRulesList(response, origin) {
    writeJson(response, origin, {
        rules: Array.from(rulesState.values()),
        total: rulesState.size,
    })
}

async function handleRuleCreate(request, response, origin) {
    const payload = await readRequestBody(request)
    const ruleId = `rule-${rulesState.size + 1}`
    const nextRule = parseRulePayload(payload, ruleId)
    rulesState.set(ruleId, nextRule)

    writeJson(response, origin, nextRule, 201)
}

function handleRuleRead(response, origin, ruleId) {
    const existingRule = rulesState.get(ruleId)
    if (existingRule !== undefined) {
        writeJson(response, origin, existingRule)
        return
    }

    writeJson(response, origin, {
        id: ruleId,
        title: "Default rule",
        rule: "title !== ''",
        type: "REGEX",
        scope: "FILE",
        severity: "LOW",
        status: "ACTIVE",
        examples: [],
    })
}

async function handleRuleUpdate(request, response, origin, ruleId) {
    const payload = await readRequestBody(request)
    const nextRule = parseRulePayload(payload, ruleId)
    rulesState.set(ruleId, nextRule)

    writeJson(response, origin, nextRule)
}

function handleRuleDelete(response, origin, ruleId) {
    rulesState.delete(ruleId)
    writeJson(response, origin, {
        id: ruleId,
        removed: true,
    })
}

function handleReviewRead(response, origin, reviewId) {
    writeJson(response, origin, {
        reviewId,
        repositoryId: "repo-1",
        mergeRequestId: "mr-1",
        status: "completed",
        issues: [],
        metrics: {
            duration: 1000,
        },
    })
}

const server = createServer(async (request, response) => {
    const origin = request.headers.origin
    const requestUrl = new URL(
        request.url ?? "/",
        `http://${request.headers.host ?? `localhost:${String(DEV_API_PORT)}`}`,
    )
    const pathname = requestUrl.pathname
    const method = request.method ?? "GET"

    if (method === "OPTIONS") {
        writeEmpty(response, origin)
        return
    }

    if (pathname === "/api/v1/auth/session" && method === "GET") {
        writeJson(response, origin, { session: defaultSession })
        return
    }

    if (pathname === "/api/v1/auth/session/refresh" && method === "POST") {
        writeJson(response, origin, { session: defaultSession })
        return
    }

    if (pathname === "/api/v1/auth/logout" && method === "POST") {
        writeJson(response, origin, { loggedOut: true })
        return
    }

    if (pathname === "/api/v1/auth/oauth/start" && method === "POST") {
        const payload = await readRequestBody(request)

        writeJson(response, origin, {
            provider: asString(payload.provider) ?? "github",
            authorizationUrl: "https://auth.example/default",
            state: "dev-stub-state",
        })
        return
    }

    if (pathname === "/api/v1/health" && method === "GET") {
        writeJson(response, origin, {
            status: "ok",
            service: "api",
            timestamp: new Date().toISOString(),
        })
        return
    }

    if (pathname === "/api/v1/feature-flags" && method === "GET") {
        writeJson(response, origin, { flags: featureFlags })
        return
    }

    if (pathname === "/api/v1/permissions" && method === "GET") {
        writeJson(response, origin, { permissions })
        return
    }

    if (pathname === "/api/v1/context/sources" && method === "GET") {
        writeJson(response, origin, {
            total: contextSources.length,
            sources: contextSources,
        })
        return
    }

    const previewMatch = pathname.match(/^\/api\/v1\/context\/sources\/([^/]+)\/preview$/)
    if (previewMatch !== null && method === "GET") {
        writeJson(response, origin, {
            sourceId: previewMatch[1] ?? "",
            status: "ok",
            items: [],
        })
        return
    }

    const sourceUpdateMatch = pathname.match(/^\/api\/v1\/context\/sources\/([^/]+)$/)
    if (sourceUpdateMatch !== null && method === "PUT") {
        writeJson(response, origin, {
            source: {
                id: sourceUpdateMatch[1] ?? "",
                provider: "JIRA",
                status: "CONNECTED",
                enabled: true,
                lastSyncedAt: new Date().toISOString(),
                itemCount: 38,
            },
        })
        return
    }

    const sourceRefreshMatch = pathname.match(/^\/api\/v1\/context\/sources\/([^/]+)\/refresh$/)
    if (sourceRefreshMatch !== null && method === "POST") {
        writeJson(response, origin, {
            sourceId: sourceRefreshMatch[1] ?? "",
            status: "SYNCING",
        })
        return
    }

    if (pathname === "/api/v1/user/settings" && method === "GET") {
        handleThemePreferencesRead(response, origin)
        return
    }

    if (pathname === "/api/v1/user/preferences" && method === "GET") {
        handleThemePreferencesRead(response, origin)
        return
    }

    if (
        (pathname === "/api/v1/user/settings" || pathname === "/api/v1/user/preferences")
        && (method === "PUT" || method === "PATCH" || method === "POST")
    ) {
        await handleThemePreferencesMutation(request, response, origin)
        return
    }

    if (pathname === "/api/v1/rules" && method === "GET") {
        handleRulesList(response, origin)
        return
    }

    if (pathname === "/api/v1/rules" && method === "POST") {
        await handleRuleCreate(request, response, origin)
        return
    }

    const ruleMatch = pathname.match(/^\/api\/v1\/rules\/([^/]+)$/)
    if (ruleMatch !== null && method === "GET") {
        handleRuleRead(response, origin, ruleMatch[1] ?? "")
        return
    }

    if (ruleMatch !== null && method === "PUT") {
        await handleRuleUpdate(request, response, origin, ruleMatch[1] ?? "")
        return
    }

    if (ruleMatch !== null && method === "DELETE") {
        handleRuleDelete(response, origin, ruleMatch[1] ?? "")
        return
    }

    const reviewMatch = pathname.match(/^\/api\/v1\/reviews\/([^/]+)$/)
    if (reviewMatch !== null && method === "GET") {
        handleReviewRead(response, origin, reviewMatch[1] ?? "")
        return
    }

    if (pathname === "/api/v1/reviews" && method === "POST") {
        writeJson(response, origin, {
            reviewId: "review-default",
            status: "queued",
        })
        return
    }

    const reviewFeedbackMatch = pathname.match(/^\/api\/v1\/reviews\/([^/]+)\/feedback$/)
    if (reviewFeedbackMatch !== null && method === "POST") {
        writeJson(response, origin, {
            reviewId: reviewFeedbackMatch[1] ?? "",
            acceptedCount: 0,
        })
        return
    }

    writeNotFound(response, origin, pathname)
})

server.listen(DEV_API_PORT, () => {
    process.stdout.write(
        `CodeNautic UI dev API stub listening on http://localhost:${String(DEV_API_PORT)}\n`,
    )
})

function shutdown() {
    server.close(() => {
        process.exit(0)
    })
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
