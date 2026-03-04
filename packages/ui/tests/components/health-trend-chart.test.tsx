import { fireEvent, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { HealthTrendChart, type IHealthTrendPoint } from "@/components/graphs/health-trend-chart"
import { renderWithProviders } from "../utils/render"

const SAMPLE_POINTS: ReadonlyArray<IHealthTrendPoint> = [
    {
        timestamp: "2025-11-15T00:00:00.000Z",
        healthScore: 61,
        annotation: "Launch",
    },
    {
        timestamp: "2025-12-20T00:00:00.000Z",
        healthScore: 70,
    },
    {
        timestamp: "2026-01-18T00:00:00.000Z",
        healthScore: 78,
    },
    {
        timestamp: "2026-02-01T00:00:00.000Z",
        healthScore: 84,
        annotation: "Refactor",
    },
]

describe("health trend chart", (): void => {
    it("рендерит line chart, annotations и stats", (): void => {
        renderWithProviders(<HealthTrendChart points={SAMPLE_POINTS} />)

        expect(screen.getByLabelText("Health trend line chart")).not.toBeNull()
        expect(screen.getByLabelText("Health event Refactor")).not.toBeNull()
        expect(screen.getByLabelText("Health trend stats")).toHaveTextContent("Avg")
    })

    it("фильтрует данные по периоду", (): void => {
        renderWithProviders(<HealthTrendChart points={SAMPLE_POINTS} />)

        const periodSelector = screen.getByLabelText("Health trend period")
        fireEvent.change(periodSelector, { target: { value: "30d" } })

        expect(screen.queryByLabelText("Health event Launch")).toBeNull()
        expect(screen.getByLabelText("Health event Refactor")).not.toBeNull()
    })

    it("показывает empty state без валидных точек", (): void => {
        renderWithProviders(
            <HealthTrendChart
                points={[
                    {
                        timestamp: "broken-date",
                        healthScore: Number.NaN,
                    },
                ]}
            />,
        )

        expect(screen.getByText("No health trend data.")).not.toBeNull()
    })
})
