import { fireEvent, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { RechartsChartWrapper } from "@/components/charts/recharts-chart-wrapper"
import { renderWithProviders } from "../utils/render"

describe("recharts chart wrapper", (): void => {
    it("рендерит loading состояние", (): void => {
        renderWithProviders(
            <RechartsChartWrapper isLoading={true} title="Chart">
                <p>chart content</p>
            </RechartsChartWrapper>,
        )

        expect(screen.queryByText("Loading chart...")).not.toBeNull()
        expect(screen.queryByText("chart content")).toBeNull()
    })

    it("рендерит контент после снятия loading", (): void => {
        renderWithProviders(
            <RechartsChartWrapper title="Chart">
                <p>chart content</p>
            </RechartsChartWrapper>,
        )

        expect(screen.queryByText("chart content")).not.toBeNull()
    })

    it("сжимает большие наборы данных согласно policy", (): void => {
        const rows = Array.from({ length: 1000 }, (_: unknown, index: number) => ({
            label: `point-${index}`,
            value: index + 1,
        }))

        let rendered: number | null = null
        let isAggregated = false
        renderWithProviders(
            <RechartsChartWrapper
                data={rows}
                title="Chart"
                scalePolicy={{
                    hardThreshold: 100,
                    maxPoints: 20,
                    aggregatorKeys: ["value"],
                    aggregator: "sum",
                }}
            >
                {({ displayData, isAggregated: aggregated }) => {
                    rendered = displayData.length
                    isAggregated = aggregated
                    return <p>count {displayData.length}</p>
                }}
            </RechartsChartWrapper>,
        )

        expect(isAggregated).toBe(true)
        expect(rendered).not.toBeNull()
        expect(rendered).not.toBe(1000)
    })

    it("вызывает экспорт raw данных", (): void => {
        const rows = [
            { label: "first", value: 1 },
            { label: "second", value: 2 },
        ]
        const onExportRawData = vi.fn()

        renderWithProviders(
            <RechartsChartWrapper
                data={rows}
                title="Chart"
                isLoading={false}
                onExportRawData={onExportRawData}
                scalePolicy={{
                    hardThreshold: 1,
                    maxPoints: 1,
                }}
            >
                {({ displayData }) => <p>count {displayData.length}</p>}
            </RechartsChartWrapper>,
        )

        const exportButton = screen.getByRole("button", { name: "Export raw CSV" })
        fireEvent.click(exportButton)
        expect(onExportRawData).toHaveBeenCalledTimes(1)
        expect(onExportRawData).toHaveBeenCalledWith(rows)
    })
})
