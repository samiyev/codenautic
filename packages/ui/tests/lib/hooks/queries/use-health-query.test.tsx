import { http, HttpResponse } from "msw"
import { screen, waitFor } from "@testing-library/react"
import { QueryClient } from "@tanstack/react-query"
import type { ReactElement } from "react"
import { describe, expect, it } from "vitest"

import { useHealthQuery, type IUseHealthQueryResult } from "@/lib/hooks/queries/use-health-query"
import { renderWithProviders } from "../../../utils/render"
import { server } from "../../../mocks/server"

/**
 * Probe-компонент для тестирования useHealthQuery хука.
 */
function HealthQueryProbe(props: { readonly enabled?: boolean }): ReactElement {
    const hook = useHealthQuery({ enabled: props.enabled })

    return (
        <div>
            <HealthQueryState {...hook} />
        </div>
    )
}

/**
 * Отображает состояние health query.
 */
function HealthQueryState(hook: IUseHealthQueryResult): ReactElement {
    if (hook.healthQuery.isPending) {
        return <p data-testid="health-state">pending</p>
    }

    if (hook.healthQuery.error !== null) {
        return <p data-testid="health-state">error</p>
    }

    const data = hook.healthQuery.data
    return (
        <div>
            <p data-testid="health-state">loaded</p>
            <p data-testid="health-status">
                {String((data as Record<string, unknown>)?.status ?? "unknown")}
            </p>
            <p data-testid="health-service">
                {String((data as Record<string, unknown>)?.service ?? "unknown")}
            </p>
        </div>
    )
}

describe("useHealthQuery", (): void => {
    it("загружает health status при монтировании", async (): Promise<void> => {
        server.use(
            http.get("http://localhost:7120/api/v1/health", () => {
                return HttpResponse.json({
                    status: "ok",
                    service: "api",
                    timestamp: "2026-03-10T00:00:00.000Z",
                })
            }),
        )

        renderWithProviders(<HealthQueryProbe />)
        expect(screen.getByTestId("health-state").textContent).toBe("pending")

        await waitFor((): void => {
            expect(screen.getByTestId("health-state")).toHaveTextContent("loaded")
        })
        expect(screen.getByTestId("health-status")).toHaveTextContent("ok")
        expect(screen.getByTestId("health-service")).toHaveTextContent("api")
    })

    it("не загружает health когда enabled=false", async (): Promise<void> => {
        let requestCount = 0
        server.use(
            http.get("http://localhost:7120/api/v1/health", () => {
                requestCount += 1
                return HttpResponse.json({
                    status: "ok",
                    service: "api",
                    timestamp: "2026-03-10T00:00:00.000Z",
                })
            }),
        )

        renderWithProviders(<HealthQueryProbe enabled={false} />)
        expect(screen.getByTestId("health-state")).toHaveTextContent("pending")

        await new Promise((resolve): void => {
            setTimeout(resolve, 50)
        })
        expect(requestCount).toBe(0)
    })

    it("показывает состояние degraded из backend", async (): Promise<void> => {
        server.use(
            http.get("http://localhost:7120/api/v1/health", () => {
                return HttpResponse.json({
                    status: "degraded",
                    service: "api",
                    timestamp: "2026-03-10T12:00:00.000Z",
                })
            }),
        )

        renderWithProviders(<HealthQueryProbe />)

        await waitFor((): void => {
            expect(screen.getByTestId("health-state")).toHaveTextContent("loaded")
        })
        expect(screen.getByTestId("health-status")).toHaveTextContent("degraded")
    })

    it("показывает ошибку при недоступности health endpoint", async (): Promise<void> => {
        server.use(
            http.get("http://localhost:7120/api/v1/health", () => {
                return HttpResponse.json({ error: "Service unavailable" }, { status: 503 })
            }),
        )

        const queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        })

        renderWithProviders(<HealthQueryProbe />, { queryClient })

        await waitFor((): void => {
            expect(screen.getByTestId("health-state")).toHaveTextContent("error")
        })
    })

    it("по умолчанию enabled=true, загружает данные автоматически", async (): Promise<void> => {
        let requestCount = 0
        server.use(
            http.get("http://localhost:7120/api/v1/health", () => {
                requestCount += 1
                return HttpResponse.json({
                    status: "ok",
                    service: "api",
                    timestamp: "2026-03-10T00:00:00.000Z",
                })
            }),
        )

        renderWithProviders(<HealthQueryProbe />)

        await waitFor((): void => {
            expect(screen.getByTestId("health-state")).toHaveTextContent("loaded")
        })
        expect(requestCount).toBe(1)
    })
})
