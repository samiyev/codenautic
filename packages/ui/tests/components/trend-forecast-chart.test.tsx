import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import {
    TrendForecastChart,
    type ITrendForecastChartPoint,
} from "@/components/graphs/trend-forecast-chart"
import { renderWithProviders } from "../utils/render"

const TEST_POINTS: ReadonlyArray<ITrendForecastChartPoint> = [
    {
        confidenceHigh: 80,
        confidenceLow: 66,
        fileId: "src/api/auth.ts",
        forecastScore: 73,
        historicalScore: 77,
        id: "f-1",
        timestamp: "Jan 03",
    },
    {
        confidenceHigh: 77,
        confidenceLow: 61,
        fileId: "src/api/auth.ts",
        forecastScore: 69,
        historicalScore: 74,
        id: "f-2",
        timestamp: "Jan 10",
    },
]

describe("TrendForecastChart", (): void => {
    it("рендерит forecast chart и confidence bands", (): void => {
        renderWithProviders(<TrendForecastChart points={TEST_POINTS} />)

        expect(screen.getByText("Trend forecast chart")).not.toBeNull()
        expect(screen.getByLabelText("Trend forecast visualization")).not.toBeNull()
        expect(
            screen.getByText(
                "Forecast zone shaded in slate, confidence interval shown in cyan band.",
            ),
        ).not.toBeNull()
        expect(screen.getByLabelText("Trend forecast points")).not.toBeNull()
        expect(screen.getByText("Jan 03: 77 to 73 (CI 66-80)")).not.toBeNull()
    })

    it("вызывает onSelectPoint при выборе точки", async (): Promise<void> => {
        const user = userEvent.setup()
        const onSelectPoint = vi.fn()
        renderWithProviders(
            <TrendForecastChart onSelectPoint={onSelectPoint} points={TEST_POINTS} />,
        )

        await user.click(
            screen.getByRole("button", {
                name: "Inspect trend forecast point Jan 10",
            }),
        )

        expect(onSelectPoint).toHaveBeenCalledTimes(1)
        expect(onSelectPoint).toHaveBeenCalledWith(
            expect.objectContaining({
                fileId: "src/api/auth.ts",
                forecastScore: 69,
                id: "f-2",
            }),
        )
    })
})
