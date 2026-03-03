import { Suspense, lazy, type ReactElement } from "react"

import { RouteErrorFallback } from "@/app/error-fallback"
import { RouteSuspenseFallback } from "@/app/route-suspense-fallback"
import { DashboardLayout, SettingsLayout } from "@/components/layout"
import { AuthBoundary } from "@/lib/auth/auth-boundary"
import { createFileRoute } from "@tanstack/react-router"

const LazySettingsTokenUsagePage = lazy(async (): Promise<{ default: () => ReactElement }> => {
    const pageModule = await import("@/pages/settings-token-usage.page")
    return {
        default: pageModule.SettingsTokenUsagePage,
    }
})

function SettingsTokenUsageRouteComponent(): ReactElement {
    return (
        <AuthBoundary loginPath="/login">
            {(context): ReactElement => (
                <DashboardLayout
                    onSignOut={context.onSignOut}
                    title="Settings · Token Usage"
                    userEmail={context.userEmail}
                    userName={context.userName}
                >
                    <SettingsLayout>
                        <Suspense fallback={<RouteSuspenseFallback />}>
                            <LazySettingsTokenUsagePage />
                        </Suspense>
                    </SettingsLayout>
                </DashboardLayout>
            )}
        </AuthBoundary>
    )
}

export const Route = createFileRoute("/settings-token-usage")({
    component: SettingsTokenUsageRouteComponent,
    errorComponent: RouteErrorFallback,
})
