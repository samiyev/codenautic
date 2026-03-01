import {describe, expect, it, vi} from "vitest"

import {createApiConfig} from "@/lib/api/config"
import {SystemApi} from "@/lib/api/endpoints/system.endpoint"
import {ApiHttpError, FetchHttpClient} from "@/lib/api/http-client"

describe("UI API contract", (): void => {
    it("использует дефолтный API URL, если переменная окружения не задана", (): void => {
        const config = createApiConfig({})

        expect(config.baseUrl).toBe("http://localhost:3000")
        expect(config.defaultHeaders["Content-Type"]).toBe("application/json")
    })

    it("бросает ошибку при пустом VITE_API_URL", (): void => {
        expect((): void => {
            createApiConfig({VITE_API_URL: "   "})
        }).toThrowError("VITE_API_URL не должен быть пустым")
    })

    it("делает GET /api/v1/health и возвращает типизированный ответ", async (): Promise<void> => {
        globalThis.fetch = vi.fn((input: RequestInfo | URL): Promise<Response> => {
            const requestedUrl =
                typeof input === "string"
                    ? input
                    : input instanceof URL
                      ? input.toString()
                      : input.url
            expect(requestedUrl).toBe("http://localhost:3000/api/v1/health")
            return Promise.resolve(
                new Response(
                JSON.stringify({
                    status: "ok",
                    service: "api",
                    timestamp: "2026-03-01T00:00:00.000Z",
                }),
                {
                    status: 200,
                },
            )
            )
        }) as unknown as typeof fetch

        const httpClient = new FetchHttpClient(createApiConfig({}))
        const api = new SystemApi(httpClient)

        const response = await api.getHealth()
        expect(response.status).toBe("ok")
        expect(response.service).toBe("api")
    })

    it("прокидывает ApiHttpError для неуспешного ответа", async (): Promise<void> => {
        globalThis.fetch = vi.fn((): Promise<Response> => {
            return Promise.resolve(new Response(JSON.stringify({message: "unavailable"}), {
                status: 503,
            }))
        }) as unknown as typeof fetch

        const httpClient = new FetchHttpClient(createApiConfig({}))

        await expect(
            httpClient.request({
                method: "GET",
                path: "/api/v1/health",
            }),
        ).rejects.toBeInstanceOf(ApiHttpError)
    })
})
