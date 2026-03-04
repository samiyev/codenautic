import { Suspense, lazy, type ReactElement } from "react"

import { RouteErrorFallback } from "@/app/error-fallback"
import { RouteSuspenseFallback } from "@/app/route-suspense-fallback"
import { DashboardLayout, SettingsLayout } from "@/components/layout"
import { AuthBoundary } from "@/lib/auth/auth-boundary"
import { createFileRoute } from "@tanstack/react-router"

const LazySettingsAppearancePage = lazy(async (): Promise<{ default: () => ReactElement }> => {
    const pageModule = await import("@/pages/settings-appearance.page")
    return {
        default: pageModule.SettingsAppearancePage,
    }
})

function SettingsAppearanceRouteComponent(): ReactElement {
    return (
        <AuthBoundary loginPath="/login">
            {(context): ReactElement => (
                <DashboardLayout
                    onSignOut={context.onSignOut}
                    title="Settings · Appearance"
                    userEmail={context.userEmail}
                    userName={context.userName}
                >
                    <SettingsLayout>
                        <Suspense fallback={<RouteSuspenseFallback />}>
                            <LazySettingsAppearancePage />
                        </Suspense>
                    </SettingsLayout>
                </DashboardLayout>
            )}
        </AuthBoundary>
    )
}

export const Route = createFileRoute("/settings-appearance")({
    component: SettingsAppearanceRouteComponent,
    errorComponent: RouteErrorFallback,
})
