import { Suspense, lazy, type ReactElement } from "react"
import { AuthBoundary } from "@/lib/auth/auth-boundary"
import { DashboardLayout } from "@/components/layout"
import { RouteSuspenseFallback } from "@/app/route-suspense-fallback"
import { RouteErrorFallback } from "@/app/error-fallback"
import { useNavigate } from "@tanstack/react-router"
import { createFileRoute } from "@tanstack/react-router"

const LazyOnboardingWizardPage = lazy(
    async (): Promise<{
        default: (props: {
            onScanStart: (payload: {
                readonly targetRepositories: ReadonlyArray<string>
            }) => void
        }) => ReactElement
    }> => {
    const pageModule = await import("@/pages/onboarding-wizard.page")
    return {
        default: pageModule.OnboardingWizardPage,
    }
})

function mapRepositoryUrlToRouteId(repositoryUrl: string): string {
    const normalizedUrl = repositoryUrl.trim()
    if (normalizedUrl.length === 0) {
        return "platform-team/api-gateway"
    }

    try {
        const parsed = new URL(normalizedUrl)
        const pathParts = parsed.pathname
            .split("/")
            .map((part): string => part.trim())
            .filter((part): boolean => part.length > 0)
        if (pathParts.length >= 2) {
            const owner = pathParts[0]
            const repository = pathParts[1]?.replace(/\.git$/i, "") ?? "repository"
            return `${owner}/${repository}`
        }
    } catch {
        return "platform-team/api-gateway"
    }

    return "platform-team/api-gateway"
}

/**
 * Маршрут мастера онбординга репозитория.
 *
 * @returns Рендер с защищенным доступом и dashboard layout.
 */
function OnboardingRouteComponent(): ReactElement {
    const navigate = useNavigate()

    return (
        <AuthBoundary loginPath="/login">
            {(context): ReactElement => (
                <DashboardLayout
                    onSignOut={context.onSignOut}
                    title="Onboarding"
                    userEmail={context.userEmail}
                    userName={context.userName}
                >
                    <Suspense fallback={<RouteSuspenseFallback />}>
                        <LazyOnboardingWizardPage
                            onScanStart={(payload): void => {
                                const primaryRepository = payload.targetRepositories[0] ?? ""
                                const repositoryId = mapRepositoryUrlToRouteId(primaryRepository)

                                void navigate({
                                    to: "/scan-progress",
                                    search: {
                                        jobId: `scan-${String(Date.now())}`,
                                        repositoryId,
                                        source: "onboarding",
                                    },
                                })
                            }}
                        />
                    </Suspense>
                </DashboardLayout>
            )}
        </AuthBoundary>
    )
}

export const Route = createFileRoute("/onboarding")({
    component: OnboardingRouteComponent,
    errorComponent: RouteErrorFallback,
})
