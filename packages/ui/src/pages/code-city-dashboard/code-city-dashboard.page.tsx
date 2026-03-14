import type { ReactElement } from "react"
import { useTranslation } from "react-i18next"

import { PageShell } from "@/components/layout/page-shell"

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
    const state = useCodeCityDashboardState(props.initialRepositoryId)

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
            <VisualizationSection state={state} />
        </PageShell>
    )
}
