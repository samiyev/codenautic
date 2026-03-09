import { Suspense, lazy, type ReactElement } from "react"
import { AuthBoundary } from "@/lib/auth/auth-boundary"
import { DashboardLayout } from "@/components/layout"
import { RouteSuspenseFallback } from "@/app/route-suspense-fallback"
import { RouteErrorFallback } from "@/app/error-fallback"
import { useNavigate } from "@tanstack/react-router"
import { createFileRoute } from "@tanstack/react-router"

interface IOnboardingScanStartPayload {
    readonly targetRepositories: ReadonlyArray<string>
}

interface IOnboardingScanSearch {
    readonly jobId: string
    readonly repositoryId?: string
    readonly source: "onboarding"
    readonly targetRepositories?: ReadonlyArray<string>
}

const DEFAULT_ONBOARDING_REPOSITORY_ID = "platform-team/api-gateway"

const LazyOnboardingWizardPage = lazy(
    async (): Promise<{
        default: (props: {
            onScanStart: (payload: IOnboardingScanStartPayload) => void
        }) => ReactElement
    }> => {
        const pageModule = await import("@/pages/onboarding-wizard")
        return {
            default: pageModule.OnboardingWizardPage,
        }
    },
)

function extractRepositoryPathSegments(repositoryUrl: string): ReadonlyArray<string> {
    const normalizedUrl = repositoryUrl.trim()
    if (normalizedUrl.length === 0) {
        return []
    }

    const sshMatch = /^[^@]+@[^:]+:(.+)$/u.exec(normalizedUrl)
    const rawPath = sshMatch?.[1] ?? normalizedUrl

    let pathname = rawPath
    try {
        pathname = new URL(normalizedUrl).pathname
    } catch {
        pathname = rawPath
    }

    const withoutQuery = pathname.split("?").at(0)?.split("#").at(0)?.trim() ?? ""

    if (withoutQuery.length === 0) {
        return []
    }

    return withoutQuery
        .split("/")
        .map((part): string => part.trim())
        .filter((part): boolean => part.length > 0)
}

export function mapRepositoryUrlToRouteId(repositoryUrl: string): string {
    const pathParts = extractRepositoryPathSegments(repositoryUrl)
    if (pathParts.length < 2) {
        return DEFAULT_ONBOARDING_REPOSITORY_ID
    }

    const owner = pathParts.at(-2) ?? ""
    const repository = pathParts.at(-1)?.replace(/\.git$/iu, "") ?? ""
    if (owner.length === 0 || repository.length === 0) {
        return DEFAULT_ONBOARDING_REPOSITORY_ID
    }

    return `${owner}/${repository}`
}

export function resolveOnboardingScanSearch(
    payload: IOnboardingScanStartPayload,
): IOnboardingScanSearch {
    const normalizedTargets = payload.targetRepositories
        .map((value): string => value.trim())
        .filter((value): boolean => value.length > 0)
    const jobId = `scan-${String(Date.now())}`

    if (normalizedTargets.length > 1) {
        return {
            jobId,
            source: "onboarding",
            targetRepositories: normalizedTargets,
        }
    }

    const singleTarget = normalizedTargets.at(0) ?? ""
    return {
        jobId,
        repositoryId: mapRepositoryUrlToRouteId(singleTarget),
        source: "onboarding",
    }
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
                                void navigate({
                                    to: "/scan-progress",
                                    search: resolveOnboardingScanSearch(payload),
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
