import { screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { TeamActivityWidget } from "@/components/dashboard/team-activity-widget"
import { renderWithProviders } from "../../utils/render"

vi.mock("recharts", () => ({
    Bar: (): React.ReactElement => <div data-testid="recharts-bar" />,
    BarChart: ({ children }: { readonly children?: React.ReactNode }): React.ReactElement => (
        <div data-testid="recharts-bar-chart">{children}</div>
    ),
    CartesianGrid: (): React.ReactElement => <div data-testid="recharts-grid" />,
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
    { developer: "Alice", ccrMerged: 12 },
    { developer: "Bob", ccrMerged: 8 },
]

describe("TeamActivityWidget", (): void => {
    it("when rendered with data, then shows title", (): void => {
        renderWithProviders(<TeamActivityWidget points={TEST_POINTS} />)

        expect(screen.getByText("Team activity")).not.toBeNull()
    })

    it("when rendered with data, then shows description text", (): void => {
        renderWithProviders(<TeamActivityWidget points={TEST_POINTS} />)

        expect(screen.getByText(/CCRs merged by developer/)).not.toBeNull()
    })

    it("when points are empty, then shows empty state", (): void => {
        renderWithProviders(<TeamActivityWidget points={[]} />)

        expect(screen.getByText("No data")).not.toBeNull()
        expect(screen.getByText(/No team activity data available/)).not.toBeNull()
    })

    it("when points have data, then renders bar chart", (): void => {
        renderWithProviders(<TeamActivityWidget points={TEST_POINTS} />)

        expect(screen.getByTestId("recharts-bar-chart")).not.toBeNull()
    })
})
