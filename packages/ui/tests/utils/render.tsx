import type { ReactElement, ReactNode } from "react"
import { render, type RenderResult } from "@testing-library/react"
import { RouterContextProvider, createMemoryHistory, createRouter } from "@tanstack/react-router"
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query"

import { createQueryClient } from "@/lib/query/query-client"
import type { TThemeMode } from "@/lib/theme/use-theme"

import { testRouteTree } from "./test-route-tree"

/**
 * Расширенный результат рендера с доступом к QueryClient.
 */
export interface IRenderWithProvidersResult extends RenderResult {
    readonly queryClient: QueryClient
}

/**
 * Конфигурация helper-функции `renderWithProviders`.
 */
export interface IRenderWithProvidersOptions {
    readonly queryClient?: QueryClient
    readonly themeMode?: TThemeMode
}

/**
 * Рендерит React-элемент с базовыми тестовыми провайдерами UI.
 *
 * @param element Тестируемый React-элемент.
 * @param options Дополнительная конфигурация тестового рендера.
 * @returns Результат рендера и активный QueryClient.
 */
export function renderWithProviders(
    element: ReactElement,
    options: IRenderWithProvidersOptions = {},
): IRenderWithProvidersResult {
    const queryClient = options.queryClient ?? createQueryClient()
    const router = createRouter({
        routeTree: testRouteTree,
        history: createMemoryHistory({
            initialEntries: [window.location.pathname],
        }),
        defaultPreload: "intent",
        defaultPreloadStaleTime: 0,
    })

    if (typeof window !== "undefined" && options.themeMode !== undefined) {
        window.localStorage.setItem("codenautic:ui:theme-mode", options.themeMode)
    }

    const wrapWithProviders = (content: ReactElement): ReactElement => (
        <RouterContextProvider router={router}>
            <QueryClientProvider client={queryClient}>{content}</QueryClientProvider>
        </RouterContextProvider>
    )

    const renderResult = render(wrapWithProviders(element))
    const rerenderWithProviders = (nextElement: ReactNode): void => {
        renderResult.rerender(wrapWithProviders(<>{nextElement}</>))
    }

    return {
        ...renderResult,
        rerender: rerenderWithProviders,
        queryClient,
    }
}
