import type {ReactElement} from "react"
import {QueryClientProvider} from "@tanstack/react-query"
import {RouterProvider} from "@tanstack/react-router"

import {createQueryClient} from "@/lib/query/query-client"
import {router} from "./router"

const queryClient = createQueryClient()

/**
 * Корневой UI-компонент с глобальными providers.
 *
 * @returns Приложение с Router и React Query контекстом.
 */
export function App(): ReactElement {
    return (
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>
    )
}
