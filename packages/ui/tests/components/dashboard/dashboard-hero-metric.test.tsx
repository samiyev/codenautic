import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { DashboardHeroMetric } from "@/components/dashboard/dashboard-hero-metric"
import { renderWithProviders } from "../../utils/render"

describe("DashboardHeroMetric", (): void => {
    it("when rendered, then shows label and value", (): void => {
        renderWithProviders(<DashboardHeroMetric label="Code quality" value={85} />)

        expect(screen.getByText("Code quality")).not.toBeNull()
        expect(screen.getByText("85")).not.toBeNull()
    })

    it("when subtitle is provided, then renders subtitle text", (): void => {
        renderWithProviders(<DashboardHeroMetric label="Score" value={92} subtitle="Last 7 days" />)

        expect(screen.getByText("Last 7 days")).not.toBeNull()
    })

    it("when subtitle is not provided, then does not render subtitle", (): void => {
        renderWithProviders(<DashboardHeroMetric label="Score" value={92} />)

        expect(screen.queryByText("Last 7 days")).toBeNull()
    })

    it("when rendered, then contains SVG gauge with aria-label", (): void => {
        const { container } = renderWithProviders(<DashboardHeroMetric label="Health" value={70} />)

        const svg = container.querySelector("svg")
        expect(svg).not.toBeNull()
        expect(svg?.getAttribute("aria-label")).toBe("Health: 70")
    })

    it("when value exceeds max, then clamps percentage to 1", (): void => {
        const { container } = renderWithProviders(
            <DashboardHeroMetric label="Score" value={150} max={100} />,
        )

        const svg = container.querySelector("svg")
        expect(svg).not.toBeNull()
        expect(screen.getByText("150")).not.toBeNull()
    })
})
