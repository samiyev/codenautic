import { Suspense, lazy, type ReactElement } from "react"

import { RouteErrorFallback } from "@/app/error-fallback"
import { RouteSuspenseFallback } from "@/app/route-suspense-fallback"
import { DashboardLayout } from "@/components/layout"
import { AuthBoundary } from "@/lib/auth/auth-boundary"
import { createFileRoute } from "@tanstack/react-router"

const LazySettingsAdoptionAnalyticsPage = lazy(
    async (): Promise<{ default: () => ReactElement }> => {
        const pageModule = await import("@/pages/settings-adoption-analytics.page")
        return {
            default: pageModule.SettingsAdoptionAnalyticsPage,
        }
    },
)

function AdoptionAnalyticsRouteComponent(): ReactElement {
    return (
        <AuthBoundary loginPath="/login">
            {(context): ReactElement => (
                <DashboardLayout
                    onSignOut={context.onSignOut}
                    title="Adoption Analytics"
                    userEmail={context.userEmail}
                    userName={context.userName}
                >
                    <Suspense fallback={<RouteSuspenseFallback />}>
                        <LazySettingsAdoptionAnalyticsPage />
                    </Suspense>
                </DashboardLayout>
            )}
        </AuthBoundary>
    )
}

export const Route = createFileRoute("/adoption-analytics")({
    component: AdoptionAnalyticsRouteComponent,
    errorComponent: RouteErrorFallback,
})
