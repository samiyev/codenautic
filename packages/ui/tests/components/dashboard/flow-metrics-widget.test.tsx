import { screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { FlowMetricsWidget } from "@/components/dashboard/flow-metrics-widget"
import { renderWithProviders } from "../../utils/render"

vi.mock("recharts", () => ({
    Area: (): React.ReactElement => <div data-testid="recharts-area" />,
    Bar: (): React.ReactElement => <div data-testid="recharts-bar" />,
    CartesianGrid: (): React.ReactElement => <div data-testid="recharts-grid" />,
    ComposedChart: ({ children }: { readonly children?: React.ReactNode }): React.ReactElement => (
        <div data-testid="recharts-composed-chart">{children}</div>
    ),
    Legend: (): React.ReactElement => <div data-testid="recharts-legend" />,
    Line: (): React.ReactElement => <div data-testid="recharts-line" />,
    LineChart: ({ children }: { readonly children?: React.ReactNode }): React.ReactElement => (
        <div data-testid="recharts-line-chart">{children}</div>
    ),
    ResponsiveContainer: ({
        children,
    }: {
        readonly children?: React.ReactNode
    }): React.ReactElement => <div data-testid="responsive-container">{children}</div>,
    Tooltip: (): React.ReactElement => <div data-testid="recharts-tooltip" />,
    XAxis: (): React.ReactElement => <div data-testid="recharts-x-axis" />,
    YAxis: (): React.ReactElement => <div data-testid="recharts-y-axis" />,
}))

vi.mock("@/lib/motion", () => ({
    CHART_DATA_TRANSITION: {},
    CHART_DATA_TRANSITION_NONE: {},
    DURATION: { normal: 0 },
    EASING: { move: [0, 0, 1, 1] },
    useReducedMotion: (): boolean => true,
}))

const TEST_POINTS = [
    { window: "Week 1", flowEfficiency: 75, deliveryCapacity: 20 },
    { window: "Week 2", flowEfficiency: 80, deliveryCapacity: 22 },
]

describe("FlowMetricsWidget", (): void => {
    it("when rendered, then shows title", (): void => {
        renderWithProviders(
            <FlowMetricsWidget
                points={TEST_POINTS}
                flowTrendLabel="+5%"
                capacityTrendLabel="+10%"
            />,
        )

        expect(screen.getByText("Flow metrics")).not.toBeNull()
    })

    it("when rendered with trend labels, then shows efficiency and capacity chips", (): void => {
        renderWithProviders(
            <FlowMetricsWidget
                points={TEST_POINTS}
                flowTrendLabel="+5%"
                capacityTrendLabel="+10%"
            />,
        )

        expect(screen.getByText("Flow efficiency +5%")).not.toBeNull()
        expect(screen.getByText("Delivery capacity +10%")).not.toBeNull()
    })

    it("when points are empty, then shows empty state", (): void => {
        renderWithProviders(
            <FlowMetricsWidget points={[]} flowTrendLabel="N/A" capacityTrendLabel="N/A" />,
        )

        expect(screen.getByText("No data")).not.toBeNull()
    })

    it("when points have data, then renders line chart", (): void => {
        renderWithProviders(
            <FlowMetricsWidget
                points={TEST_POINTS}
                flowTrendLabel="+5%"
                capacityTrendLabel="+10%"
            />,
        )

        expect(screen.getByTestId("recharts-line-chart")).not.toBeNull()
    })
})
