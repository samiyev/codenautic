import {describe, expect, it, vi} from "vitest"

import {createApiConfig} from "@/lib/api/config"
import {SystemApi} from "@/lib/api/endpoints/system.endpoint"
import {ApiHttpError, FetchHttpClient} from "@/lib/api/http-client"

describe("UI API contract", (): void => {
    it("использует дефолтный API URL в dev режиме", (): void => {
        const config = createApiConfig({MODE: "development"})

        expect(config.baseUrl).toBe("http://localhost:3000")
        expect(config.defaultHeaders["Content-Type"]).toBe("application/json")
    })

    it("бросает ошибку при пустом VITE_API_URL", (): void => {
        expect((): void => {
            createApiConfig({VITE_API_URL: "   "})
        }).toThrowError("VITE_API_URL не должен быть пустым")
    })

    it("бросает ошибку при отсутствии VITE_API_URL в production", (): void => {
        expect((): void => {
            createApiConfig({MODE: "production"})
        }).toThrowError("VITE_API_URL обязателен в production режиме")
    })

    it("бросает ошибку при PROD=true и отсутствии VITE_API_URL", (): void => {
        expect((): void => {
            createApiConfig({MODE: "development", PROD: true})
        }).toThrowError("VITE_API_URL обязателен в production режиме")
    })

    it("бросает ошибку при невалидном абсолютном URL", (): void => {
        expect((): void => {
            createApiConfig({VITE_API_URL: "localhost:3000"})
        }).toThrowError("VITE_API_URL должен использовать http или https")
    })

    it("бросает ошибку при синтаксически невалидном URL", (): void => {
        expect((): void => {
            createApiConfig({VITE_API_URL: "http://[::1"})
        }).toThrowError("VITE_API_URL должен быть абсолютным URL")
    })

    it("нормализует VITE_API_URL без завершающего слеша", (): void => {
        const config = createApiConfig({VITE_API_URL: "http://localhost:3000/"})

        expect(config.baseUrl).toBe("http://localhost:3000")
    })

    it("сохраняет VITE_API_URL без завершающего слеша без изменений", (): void => {
        const config = createApiConfig({VITE_API_URL: "http://localhost:3001"})

        expect(config.baseUrl).toBe("http://localhost:3001")
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
                ),
            )
        }) as unknown as typeof fetch

        const httpClient = new FetchHttpClient(createApiConfig({MODE: "development"}))
        const api = new SystemApi(httpClient)

        const response = await api.getHealth()
        expect(response.status).toBe("ok")
        expect(response.service).toBe("api")
    })

    it("прокидывает ApiHttpError для неуспешного ответа", async (): Promise<void> => {
        globalThis.fetch = vi.fn((): Promise<Response> => {
            return Promise.resolve(
                new Response(JSON.stringify({message: "unavailable"}), {
                    status: 503,
                }),
            )
        }) as unknown as typeof fetch

        const httpClient = new FetchHttpClient(createApiConfig({MODE: "development"}))

        await expect(
            httpClient.request({
                method: "GET",
                path: "/api/v1/health",
            }),
        ).rejects.toBeInstanceOf(ApiHttpError)
    })

    it("формирует query string и пропускает undefined query значения", async (): Promise<void> => {
        globalThis.fetch = vi.fn((input: RequestInfo | URL): Promise<Response> => {
            const requestedUrl =
                typeof input === "string"
                    ? input
                    : input instanceof URL
                      ? input.toString()
                      : input.url

            const parsed = new URL(requestedUrl)
            expect(parsed.searchParams.get("page")).toBe("2")
            expect(parsed.searchParams.get("withDetails")).toBe("true")
            expect(parsed.searchParams.has("ignored")).toBe(false)

            return Promise.resolve(
                new Response(JSON.stringify({status: "ok"}), {
                    status: 200,
                }),
            )
        }) as unknown as typeof fetch

        const httpClient = new FetchHttpClient(createApiConfig({MODE: "development"}))
        await httpClient.request({
            method: "GET",
            path: "/api/v1/health",
            query: {
                page: 2,
                withDetails: true,
                ignored: undefined,
            },
        })
    })

    it("сериализует body в JSON для non-GET запроса", async (): Promise<void> => {
        globalThis.fetch = vi.fn(
            (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
                expect(init?.body).toBe(JSON.stringify({name: "rule"}))
                return Promise.resolve(
                    new Response(JSON.stringify({status: "ok"}), {
                        status: 200,
                    }),
                )
            },
        ) as unknown as typeof fetch

        const httpClient = new FetchHttpClient(createApiConfig({MODE: "development"}))
        await httpClient.request({
            method: "POST",
            path: "/api/v1/rules",
            body: {
                name: "rule",
            },
        })
    })

    it("блокирует абсолютный URL в path", async (): Promise<void> => {
        const httpClient = new FetchHttpClient(createApiConfig({MODE: "development"}))

        await expect(
            httpClient.request({
                method: "GET",
                path: "https://evil.example/steal",
            }),
        ).rejects.toThrowError("Request path не должен быть абсолютным URL")
    })

    it("блокирует traversal сегменты в path", async (): Promise<void> => {
        const httpClient = new FetchHttpClient(createApiConfig({MODE: "development"}))

        await expect(
            httpClient.request({
                method: "GET",
                path: "../api/v1/health",
            }),
        ).rejects.toThrowError("Request path не должен содержать '..'")
    })

    it("блокирует пустой path", async (): Promise<void> => {
        const httpClient = new FetchHttpClient(createApiConfig({MODE: "development"}))

        await expect(
            httpClient.request({
                method: "GET",
                path: "   ",
            }),
        ).rejects.toThrowError("Request path не должен быть пустым")
    })

    it("блокирует path, начинающийся с //", async (): Promise<void> => {
        const httpClient = new FetchHttpClient(createApiConfig({MODE: "development"}))

        await expect(
            httpClient.request({
                method: "GET",
                path: "//evil.local/path",
            }),
        ).rejects.toThrowError("Request path не должен начинаться с //")
    })

    it("блокирует path с пробелами", async (): Promise<void> => {
        const httpClient = new FetchHttpClient(createApiConfig({MODE: "development"}))

        await expect(
            httpClient.request({
                method: "GET",
                path: "/api v1/health",
            }),
        ).rejects.toThrowError("Request path не должен содержать пробелы")
    })
})
