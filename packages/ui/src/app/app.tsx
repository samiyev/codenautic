import { type ReactElement, useState } from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider } from "@tanstack/react-router"
import { ThemeProvider } from "next-themes"
import { Toast } from "@heroui/react"

import { AnalyticsProvider } from "@/lib/analytics/analytics-context"
import { createQueryClient } from "@/lib/query/query-client"
import { router } from "./router"

/**
 * Корневой UI-компонент с глобальными providers.
 *
 * @returns Приложение с Router и React Query контекстом.
 */
export function App(): ReactElement {
    const [queryClient] = useState(createQueryClient)

    return (
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            storageKey="cn:theme-mode"
        >
            <QueryClientProvider client={queryClient}>
                <AnalyticsProvider>
                    <Toast.Provider />
                    <RouterProvider router={router} />
                </AnalyticsProvider>
            </QueryClientProvider>
        </ThemeProvider>
    )
}
