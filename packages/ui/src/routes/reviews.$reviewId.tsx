import type { ReactElement } from "react"
import { Suspense, lazy } from "react"

import { Link, createFileRoute } from "@tanstack/react-router"

import { RouteSuspenseFallback } from "@/app/route-suspense-fallback"
import { AuthBoundary } from "@/lib/auth/auth-boundary"
import { DashboardLayout } from "@/components/layout"
import { getCcrById, type ICcrRowData } from "@/pages/ccr-data"

const LazyCcrReviewDetailPage = lazy(
    async (): Promise<{
        default: (props: { ccr: ICcrRowData }) => ReactElement
    }> => {
        const pageModule = await import("@/pages/ccr-review-detail.page")

        return {
            default: (props): ReactElement => (
                <pageModule.CcrReviewDetailPage ccr={props.ccr} />
            ),
        }
    },
)

function ReviewRouteFallback(): ReactElement {
    return (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
            <p className="text-sm font-semibold text-rose-900">CCR not found</p>
            <p className="mt-1 text-sm text-rose-800">
                Review not found. Open available CCR list to pick active review.
            </p>
            <Link
                className="mt-3 inline-block text-sm underline underline-offset-4"
                to="/reviews"
            >
                Back to reviews
            </Link>
        </div>
    )
}

function ReviewsDetailRouteComponent(): ReactElement {
    const params = Route.useParams()
    const ccr = getCcrById(params.reviewId)

    if (ccr === undefined) {
        return (
            <AuthBoundary loginPath="/login">
                {(context): ReactElement => (
                    <DashboardLayout
                        onSignOut={context.onSignOut}
                        title="CCR Review"
                        userEmail={context.userEmail}
                        userName={context.userName}
                    >
                        <ReviewRouteFallback />
                    </DashboardLayout>
                )}
            </AuthBoundary>
        )
    }

    return (
        <AuthBoundary loginPath="/login">
            {(context): ReactElement => (
                <DashboardLayout
                    onSignOut={context.onSignOut}
                    title={`CCR Review · ${ccr.id}`}
                    userEmail={context.userEmail}
                    userName={context.userName}
                >
                    <Suspense fallback={<RouteSuspenseFallback />}>
                        <LazyCcrReviewDetailPage ccr={ccr} />
                    </Suspense>
                </DashboardLayout>
            )}
        </AuthBoundary>
    )
}

export const Route = createFileRoute("/reviews/$reviewId")({
    component: ReviewsDetailRouteComponent,
})
