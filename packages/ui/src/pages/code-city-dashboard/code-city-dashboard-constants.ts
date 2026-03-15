import type { IGuidedTourStep } from "@/components/codecity/guided-tour-overlay"

import type {
    ICodeCityDashboardMetricOption,
    ICodeCityDashboardOnboardingAreaDescriptor,
    ICodeCityDashboardRepositoryProfile,
} from "./code-city-dashboard-types"

/**
 * Набор доступных метрик для dashboard селектора.
 */
export const CODE_CITY_DASHBOARD_METRICS: ReadonlyArray<ICodeCityDashboardMetricOption> = [
    {
        label: "Complexity",
        value: "complexity",
    },
    {
        label: "Coverage",
        value: "coverage",
    },
    {
        label: "Churn",
        value: "churn",
    },
] as const

/**
 * Пустой профиль-заглушка, используемый пока данные загружаются из API.
 */
export const EMPTY_DASHBOARD_PROFILE: ICodeCityDashboardRepositoryProfile = {
    id: "",
    label: "",
    description: "",
    files: [],
    impactedFiles: [],
    compareFiles: [],
    temporalCouplings: [],
    healthTrend: [],
    contributors: [],
    ownership: [],
    contributorCollaborations: [],
}

/**
 * Шаги guided tour для CodeCity dashboard.
 */
export const CODE_CITY_GUIDED_TOUR_STEPS: ReadonlyArray<IGuidedTourStep> = [
    {
        description:
            "Start from repository and metric filters to align the city view with your current investigation context.",
        id: "controls",
        title: "Configure dashboard scope",
    },
    {
        description:
            "Use 3D preview to inspect topology, causal overlays, and local hotspots before drilling into specific files.",
        id: "city-3d",
        title: "Inspect 3D city",
    },
    {
        description:
            "Open root cause chains to follow issue propagation and jump directly into affected files and neighborhoods.",
        id: "root-cause",
        title: "Trace root causes",
    },
] as const

/**
 * Описания областей onboarding для dashboard.
 */
export const CODE_CITY_DASHBOARD_ONBOARDING_AREAS: ReadonlyArray<ICodeCityDashboardOnboardingAreaDescriptor> =
    [
        {
            description:
                "Repository, metric and overlay filters were adjusted for current analysis.",
            id: "controls",
            title: "Dashboard controls",
        },
        {
            description: "Role-aware exploration paths were executed from sidebar recommendations.",
            id: "explore",
            title: "Explore mode paths",
        },
        {
            description: "Critical hotspots were opened and focused inside the city context.",
            id: "hot-areas",
            title: "Hot area diagnostics",
        },
        {
            description: "Root-cause chains were reviewed for propagation details.",
            id: "root-cause",
            title: "Root cause analysis",
        },
        {
            description: "3D camera navigation was used to inspect selected file neighborhoods.",
            id: "city-3d",
            title: "3D city navigation",
        },
    ] as const
