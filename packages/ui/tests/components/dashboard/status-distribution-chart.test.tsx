import { screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { StatusDistributionChart } from "@/components/dashboard/status-distribution-chart"
import { renderWithProviders } from "../../utils/render"

vi.mock("recharts", () => ({
    Cell: (): React.ReactElement => <div data-testid="recharts-cell" />,
    Pie: ({ children }: { readonly children?: React.ReactNode }): React.ReactElement => (
        <div data-testid="recharts-pie">{children}</div>
    ),
    PieChart: ({ children }: { readonly children?: React.ReactNode }): React.ReactElement => (
        <div data-testid="recharts-pie-chart">{children}</div>
    ),
    ResponsiveContainer: ({
        children,
    }: {
        readonly children?: React.ReactNode
    }): React.ReactElement => <div data-testid="responsive-container">{children}</div>,
    Tooltip: (): React.ReactElement => <div data-testid="recharts-tooltip" />,
}))

vi.mock("@/lib/motion", () => ({
    CHART_DATA_TRANSITION: {},
    CHART_DATA_TRANSITION_NONE: {},
    DURATION: { normal: 0 },
    EASING: { move: [0, 0, 1, 1] },
    useReducedMotion: (): boolean => true,
}))

const TEST_DATA = [
    { status: "Open", count: 10, color: "#22c55e" },
    { status: "Merged", count: 25, color: "#3b82f6" },
    { status: "Closed", count: 5, color: "#ef4444" },
]

describe("StatusDistributionChart", (): void => {
    it("when rendered with data, then shows default title", (): void => {
        renderWithProviders(<StatusDistributionChart data={TEST_DATA} />)

        expect(screen.getByText("CCR status distribution")).not.toBeNull()
    })

    it("when custom title is provided, then shows custom title", (): void => {
        renderWithProviders(
            <StatusDistributionChart data={TEST_DATA} title="Custom distribution" />,
        )

        expect(screen.getByText("Custom distribution")).not.toBeNull()
    })

    it("when rendered with data, then shows status legend chips", (): void => {
        renderWithProviders(<StatusDistributionChart data={TEST_DATA} />)

        expect(screen.getByText(/Open: 10/)).not.toBeNull()
        expect(screen.getByText(/Merged: 25/)).not.toBeNull()
        expect(screen.getByText(/Closed: 5/)).not.toBeNull()
    })
})
