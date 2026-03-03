import { Suspense, lazy, type ReactElement } from "react"

import { RouteErrorFallback } from "@/app/error-fallback"
import { RouteSuspenseFallback } from "@/app/route-suspense-fallback"
import { AuthBoundary } from "@/lib/auth/auth-boundary"
import { DashboardLayout } from "@/components/layout"
import { createFileRoute } from "@tanstack/react-router"

const LazyIssuesTrackingPage = lazy(
    async (): Promise<{
        default: () => ReactElement
    }> => {
        const pageModule = await import("@/pages/issues-tracking.page")
        return {
            default: pageModule.IssuesTrackingPage,
        }
    },
)

/**
 * Маршрут страницы issues tracking.
 *
 * @returns Экран списков issues с фильтрами и виртуальным скроллом.
 */
function IssuesTrackingRouteComponent(): ReactElement {
    return (
        <AuthBoundary loginPath="/login">
            {(context): ReactElement => (
                <DashboardLayout
                    onSignOut={context.onSignOut}
                    title="Issues"
                    userEmail={context.userEmail}
                    userName={context.userName}
                >
                    <Suspense fallback={<RouteSuspenseFallback />}>
                        <LazyIssuesTrackingPage />
                    </Suspense>
                </DashboardLayout>
            )}
        </AuthBoundary>
    )
}

export const Route = createFileRoute("/issues")({
    component: IssuesTrackingRouteComponent,
    errorComponent: RouteErrorFallback,
})
