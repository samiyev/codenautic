import { Suspense, lazy, type ReactElement } from "react"

import { RouteErrorFallback } from "@/app/error-fallback"
import { RouteSuspenseFallback } from "@/app/route-suspense-fallback"
import { DashboardLayout, SettingsLayout } from "@/components/layout"
import { AuthBoundary } from "@/lib/auth/auth-boundary"
import { createFileRoute } from "@tanstack/react-router"

const LazySettingsSecurityPage = lazy(async (): Promise<{ default: () => ReactElement }> => {
    const pageModule = await import("@/pages/settings-security.page")
    return {
        default: pageModule.SettingsSecurityPage,
    }
})

function SettingsSecurityRouteComponent(): ReactElement {
    return (
        <AuthBoundary loginPath="/login">
            {(context): ReactElement => (
                <DashboardLayout
                    onSignOut={context.onSignOut}
                    title="Settings · Security"
                    userEmail={context.userEmail}
                    userName={context.userName}
                >
                    <SettingsLayout>
                        <Suspense fallback={<RouteSuspenseFallback />}>
                            <LazySettingsSecurityPage />
                        </Suspense>
                    </SettingsLayout>
                </DashboardLayout>
            )}
        </AuthBoundary>
    )
}

export const Route = createFileRoute("/settings-security")({
    component: SettingsSecurityRouteComponent,
    errorComponent: RouteErrorFallback,
})
