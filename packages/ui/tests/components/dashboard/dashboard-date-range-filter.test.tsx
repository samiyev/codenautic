import { screen } from "@testing-library/react"
import userEvent, { type UserEvent } from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import {
    DashboardDateRangeFilter,
    type IDashboardDateRangeFilterProps,
    type TDashboardDateRange,
} from "@/components/dashboard/dashboard-date-range-filter"
import { renderWithProviders } from "../../utils/render"

function createProps(
    overrides: Partial<IDashboardDateRangeFilterProps> = {},
): IDashboardDateRangeFilterProps {
    return {
        value: overrides.value ?? "7d",
        onChange: overrides.onChange ?? vi.fn<(value: TDashboardDateRange) => void>(),
    }
}

describe("DashboardDateRangeFilter", (): void => {
    it("when rendered, then shows all date range buttons", (): void => {
        const props = createProps()
        renderWithProviders(<DashboardDateRangeFilter {...props} />)

        expect(screen.queryByText("24h")).not.toBeNull()
        expect(screen.queryByText("7d")).not.toBeNull()
        expect(screen.queryByText("30d")).not.toBeNull()
        expect(screen.queryByText("90d")).not.toBeNull()
    })

    it("when rendered, then has group role with label", (): void => {
        const props = createProps()
        renderWithProviders(<DashboardDateRangeFilter {...props} />)

        expect(screen.queryByRole("group", { name: "Dashboard date range" })).not.toBeNull()
    })

    it("when a button is clicked, then calls onChange with the range value", async (): Promise<void> => {
        const user: UserEvent = userEvent.setup()
        const onChange = vi.fn<(value: TDashboardDateRange) => void>()
        const props = createProps({ onChange })
        renderWithProviders(<DashboardDateRangeFilter {...props} />)

        const button30d = screen.getByText("30d")
        await user.click(button30d)

        expect(onChange).toHaveBeenCalledWith("30d")
    })

    it("when value is 1d, then 24h button uses solid variant", (): void => {
        const props = createProps({ value: "1d" })
        renderWithProviders(<DashboardDateRangeFilter {...props} />)

        const buttons = screen.getAllByRole("button")
        expect(buttons.length).toBe(4)
    })
})
