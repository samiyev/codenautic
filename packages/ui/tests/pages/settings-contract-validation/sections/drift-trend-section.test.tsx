import { screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { DriftTrendSection } from "@/pages/settings-contract-validation/sections/drift-trend-section"
import { renderWithProviders } from "../../../utils/render"
import { createMockContractState } from "./mock-contract-state"

vi.mock("recharts", () => ({
    CartesianGrid: (): React.JSX.Element => <div data-testid="cartesian-grid" />,
    Line: (): React.JSX.Element => <div data-testid="line" />,
    LineChart: ({ children }: { readonly children: React.ReactNode }): React.JSX.Element => (
        <div data-testid="line-chart">{children}</div>
    ),
    ReferenceDot: (): React.JSX.Element => <div data-testid="reference-dot" />,
    ResponsiveContainer: ({
        children,
    }: {
        readonly children: React.ReactNode
    }): React.JSX.Element => <div data-testid="responsive-container">{children}</div>,
    Tooltip: (): React.JSX.Element => <div data-testid="tooltip" />,
    XAxis: (): React.JSX.Element => <div data-testid="x-axis" />,
    YAxis: (): React.JSX.Element => <div data-testid="y-axis" />,
}))

describe("DriftTrendSection", (): void => {
    it("when rendered, then shows blueprint vs reality comparison view", (): void => {
        const state = createMockContractState()
        renderWithProviders(<DriftTrendSection state={state} />)

        expect(screen.getByText("Blueprint vs reality view")).not.toBeNull()
        expect(screen.getByLabelText("Blueprint intended architecture list")).not.toBeNull()
        expect(screen.getByLabelText("Reality architecture list")).not.toBeNull()
    })

    it("when rendered, then shows architecture difference summary and list", (): void => {
        const state = createMockContractState()
        renderWithProviders(<DriftTrendSection state={state} />)

        expect(screen.getByText("Difference summary")).not.toBeNull()
        expect(screen.getByText("2 differences found")).not.toBeNull()
        expect(screen.getByLabelText("Architecture differences list")).not.toBeNull()
    })

    it("when rendered, then shows drift trend chart and annotations", (): void => {
        const state = createMockContractState()
        renderWithProviders(<DriftTrendSection state={state} />)

        expect(screen.getByText("Drift trend chart")).not.toBeNull()
        expect(screen.getByText("Trend summary")).not.toBeNull()
        expect(screen.getByText("Drift score trending upward")).not.toBeNull()
        expect(screen.getByLabelText("Architecture change annotations list")).not.toBeNull()
        expect(screen.getByText(/Added cache layer/)).not.toBeNull()
    })
})
