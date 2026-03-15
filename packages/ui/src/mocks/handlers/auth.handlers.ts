import { http, HttpResponse, delay } from "msw"

import { getMockStore } from "../store/create-mock-store"
import { api } from "./handler-utils"

/**
 * MSW handlers для авторизации: сессии, OAuth, logout.
 *
 * Используют AuthCollection из mock store для хранения состояния.
 */
export const authHandlers = [
    /**
     * GET /auth/session — возвращает активную сессию.
     */
    http.get(api("/auth/session"), async () => {
        await delay(50)
        const store = getMockStore()
        const session = store.auth.getActiveSession()
        return HttpResponse.json({ session: session ?? null })
    }),

    /**
     * POST /auth/session/refresh — обновляет текущую сессию.
     */
    http.post(api("/auth/session/refresh"), async () => {
        await delay(100)
        const store = getMockStore()
        const session = store.auth.getActiveSession()
        if (session === undefined) {
            return HttpResponse.json({ session: null }, { status: 401 })
        }
        const newSession = store.auth.createSession(session.provider, session.user.id)
        return HttpResponse.json({ session: newSession })
    }),

    /**
     * POST /auth/logout — удаляет текущую сессию.
     */
    http.post(api("/auth/logout"), async () => {
        await delay(50)
        const store = getMockStore()
        store.auth.deleteSession()
        return HttpResponse.json({ loggedOut: true })
    }),

    /**
     * POST /auth/oauth/start — начинает OAuth flow.
     */
    http.post(api("/auth/oauth/start"), async ({ request }) => {
        await delay(200)
        const payload = (await request.json()) as { readonly provider?: string }
        const provider = payload.provider ?? "github"
        return HttpResponse.json({
            provider,
            authorizationUrl: `https://auth.example/${provider}/authorize?state=msw-state`,
            state: "msw-state",
        })
    }),

    /**
     * GET /auth/oauth/callback — симулирует OAuth callback (auto-login).
     */
    http.get(api("/auth/oauth/callback"), async ({ request }) => {
        await delay(300)
        const store = getMockStore()
        const url = new URL(request.url)
        const provider = url.searchParams.get("provider") ?? "github"
        const session = store.auth.createSession(provider as "github", "u-neo")
        return HttpResponse.json({ session })
    }),
]
