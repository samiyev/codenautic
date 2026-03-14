import { screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import {
    DashboardScopeFilters,
    type IDashboardScopeFiltersProps,
    type TOrgScope,
    type TRepositoryScope,
    type TTeamScope,
} from "@/components/dashboard/dashboard-scope-filters"
import type { TDashboardDateRange } from "@/components/dashboard/dashboard-date-range-filter"
import { renderWithProviders } from "../../utils/render"

function createProps(
    overrides: Partial<IDashboardScopeFiltersProps> = {},
): IDashboardScopeFiltersProps {
    return {
        orgScope: overrides.orgScope ?? "all-orgs",
        repositoryScope: overrides.repositoryScope ?? "all-repos",
        teamScope: overrides.teamScope ?? "all-teams",
        dateRange: overrides.dateRange ?? "7d",
        onOrgScopeChange: overrides.onOrgScopeChange ?? vi.fn<(scope: TOrgScope) => void>(),
        onRepositoryScopeChange:
            overrides.onRepositoryScopeChange ?? vi.fn<(scope: TRepositoryScope) => void>(),
        onTeamScopeChange: overrides.onTeamScopeChange ?? vi.fn<(scope: TTeamScope) => void>(),
        onDateRangeChange:
            overrides.onDateRangeChange ?? vi.fn<(range: TDashboardDateRange) => void>(),
    }
}

describe("DashboardScopeFilters", (): void => {
    it("when rendered, then shows all three scope selects", (): void => {
        const props = createProps()
        renderWithProviders(<DashboardScopeFilters {...props} />)

        expect(screen.queryByLabelText("Organization scope")).not.toBeNull()
        expect(screen.queryByLabelText("Repository scope")).not.toBeNull()
        expect(screen.queryByLabelText("Team scope")).not.toBeNull()
    })

    it("when rendered, then shows date range filter with all buttons", (): void => {
        const props = createProps()
        renderWithProviders(<DashboardScopeFilters {...props} />)

        expect(screen.queryByText("24h")).not.toBeNull()
        expect(screen.queryByText("7d")).not.toBeNull()
        expect(screen.queryByText("30d")).not.toBeNull()
        expect(screen.queryByText("90d")).not.toBeNull()
    })

    it("when rendered, then has date range group role", (): void => {
        const props = createProps()
        renderWithProviders(<DashboardScopeFilters {...props} />)

        expect(screen.queryByRole("group", { name: "Dashboard date range" })).not.toBeNull()
    })
})
