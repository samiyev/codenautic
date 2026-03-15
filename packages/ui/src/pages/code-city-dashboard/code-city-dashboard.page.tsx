import type { ReactElement } from "react"
import { useTranslation } from "react-i18next"

import { PageShell } from "@/components/layout/page-shell"
import { useCodeCityDependencyGraph, useCodeCityProfiles } from "@/lib/hooks/queries/use-code-city"
import { Spinner } from "@heroui/react"

import type { ICodeCityDashboardPageProps } from "./code-city-dashboard-types"
import {
    AnalysisSection,
    ComparisonSection,
    ControlsSection,
    GamificationSection,
    OverviewSection,
    OwnershipSection,
    PredictionSection,
    RefactoringSection,
    TourSection,
    VisualizationSection,
} from "./sections"
import { useCodeCityDashboardState } from "./use-code-city-dashboard-state"

/**
 * Страница CodeCity для кросс-репозитория с выбором метрики и репозитория.
 *
 * @param props Конфигурация страницы.
 * @returns Страница CodeCity dashboard.
 */
export function CodeCityDashboardPage(props: ICodeCityDashboardPageProps = {}): ReactElement {
    const { t } = useTranslation(["code-city"])
    const { profilesQuery } = useCodeCityProfiles()

    const repositories = profilesQuery.data?.profiles ?? []
    const hasProfiles = repositories.length > 0

    const state = useCodeCityDashboardState({
        repositories,
        initialRepositoryId: props.initialRepositoryId,
    })

    const { graphQuery } = useCodeCityDependencyGraph({
        repoId: state.repositoryId,
        enabled: hasProfiles,
    })

    const dependencyNodes = graphQuery.data?.nodes ?? []
    const dependencyRelations = graphQuery.data?.relations ?? []

    if (profilesQuery.isPending) {
        return (
            <PageShell layout="spacious" title={t("code-city:controls.dashboardTitle")}>
                <div className="flex items-center justify-center py-20">
                    <Spinner size="lg" />
                </div>
            </PageShell>
        )
    }

    if (hasProfiles === false) {
        return (
            <PageShell layout="spacious" title={t("code-city:controls.dashboardTitle")}>
                <div className="flex items-center justify-center py-20">
                    <p className="text-sm text-muted">
                        {t("code-city:controls.noProfilesAvailable")}
                    </p>
                </div>
            </PageShell>
        )
    }

    return (
        <PageShell layout="spacious" title={t("code-city:controls.dashboardTitle")}>
            <TourSection state={state} />
            <ControlsSection state={state} />
            <OverviewSection state={state} />
            <RefactoringSection state={state} />
            <PredictionSection state={state} />
            <ComparisonSection state={state} />
            <GamificationSection state={state} />
            <OwnershipSection state={state} />
            <AnalysisSection state={state} />
            <VisualizationSection
                dependencyNodes={dependencyNodes}
                dependencyRelations={dependencyRelations}
                state={state}
            />
        </PageShell>
    )
}
