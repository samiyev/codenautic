import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import {
    PredictionDashboard,
    type IPredictionDashboardBugProneFile,
    type IPredictionDashboardHotspotEntry,
    type IPredictionDashboardQualityTrendPoint,
} from "@/components/graphs/prediction-dashboard"
import { renderWithProviders } from "../utils/render"

const TEST_HOTSPOTS: ReadonlyArray<IPredictionDashboardHotspotEntry> = [
    {
        confidenceScore: 88,
        fileId: "src/api/auth.ts",
        id: "pred-auth",
        label: "src/api/auth.ts",
        predictedIssueIncrease: 4,
        riskLevel: "high",
    },
    {
        confidenceScore: 74,
        fileId: "src/worker/retry.ts",
        id: "pred-retry",
        label: "src/worker/retry.ts",
        predictedIssueIncrease: 2,
        riskLevel: "medium",
    },
]

const TEST_TREND: ReadonlyArray<IPredictionDashboardQualityTrendPoint> = [
    {
        forecastQualityScore: 70,
        qualityScore: 76,
        timestamp: "W-2",
    },
    {
        forecastQualityScore: 66,
        qualityScore: 72,
        timestamp: "W-1",
    },
]

const TEST_BUG_PRONE: ReadonlyArray<IPredictionDashboardBugProneFile> = [
    {
        bugIntroductions30d: 5,
        confidenceScore: 87,
        fileId: "src/api/auth.ts",
        label: "src/api/auth.ts",
    },
]

describe("PredictionDashboard", (): void => {
    it("рендерит predicted hotspots, quality trend и bug-prone files", (): void => {
        renderWithProviders(
            <PredictionDashboard
                bugProneFiles={TEST_BUG_PRONE}
                hotspots={TEST_HOTSPOTS}
                qualityTrendPoints={TEST_TREND}
            />,
        )

        expect(screen.getByText("Prediction dashboard")).not.toBeNull()
        expect(screen.getByLabelText("Prediction hotspots list")).not.toBeNull()
        expect(screen.getByText("Risk High · Confidence 88% · Forecast +4 issues")).not.toBeNull()
        expect(screen.getByLabelText("Prediction quality trend")).not.toBeNull()
        expect(screen.getByText("W-2: 76 → 70")).not.toBeNull()
        expect(screen.getByLabelText("Prediction bug-prone files")).not.toBeNull()
        expect(screen.getByText("src/api/auth.ts · bugs 30d 5 · confidence 87%")).not.toBeNull()
    })

    it("вызывает onSelectHotspot при выборе hotspot", async (): Promise<void> => {
        const user = userEvent.setup()
        const onSelectHotspot = vi.fn()
        renderWithProviders(
            <PredictionDashboard
                bugProneFiles={TEST_BUG_PRONE}
                hotspots={TEST_HOTSPOTS}
                onSelectHotspot={onSelectHotspot}
                qualityTrendPoints={TEST_TREND}
            />,
        )

        await user.click(
            screen.getByRole("button", {
                name: "Inspect prediction dashboard hotspot src/api/auth.ts",
            }),
        )

        expect(onSelectHotspot).toHaveBeenCalledTimes(1)
        expect(onSelectHotspot).toHaveBeenCalledWith(
            expect.objectContaining({
                fileId: "src/api/auth.ts",
                predictedIssueIncrease: 4,
                riskLevel: "high",
            }),
        )
    })
})
