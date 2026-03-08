import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import {
    CityPredictionOverlay,
    type ICityPredictionOverlayEntry,
} from "@/components/graphs/city-prediction-overlay"
import { renderWithProviders } from "../utils/render"

const TEST_ENTRIES: ReadonlyArray<ICityPredictionOverlayEntry> = [
    {
        confidenceScore: 89,
        fileId: "src/api/auth.ts",
        label: "src/api/auth.ts",
        reason: "Rising churn with recurrent bug introductions.",
        riskLevel: "high",
    },
    {
        confidenceScore: 72,
        fileId: "src/worker/retry.ts",
        label: "src/worker/retry.ts",
        reason: "Ownership rotation and volatility in test flakiness.",
        riskLevel: "medium",
    },
]

describe("CityPredictionOverlay", (): void => {
    it("рендерит prediction hotspots и риск-лейблы", (): void => {
        renderWithProviders(<CityPredictionOverlay entries={TEST_ENTRIES} />)

        expect(screen.getByText("Prediction overlay")).not.toBeNull()
        expect(screen.getByLabelText("Prediction hotspots")).not.toBeNull()
        expect(screen.getByText("High risk forecast")).not.toBeNull()
        expect(screen.getByText("Medium risk forecast")).not.toBeNull()
        expect(
            screen.getByText("Confidence 89% · Rising churn with recurrent bug introductions."),
        ).not.toBeNull()
    })

    it("вызывает onSelectEntry при выборе hotspot", async (): Promise<void> => {
        const user = userEvent.setup()
        const onSelectEntry = vi.fn()
        renderWithProviders(
            <CityPredictionOverlay entries={TEST_ENTRIES} onSelectEntry={onSelectEntry} />,
        )

        await user.click(
            screen.getByRole("button", { name: "Inspect prediction hotspot src/api/auth.ts" }),
        )

        expect(onSelectEntry).toHaveBeenCalledTimes(1)
        expect(onSelectEntry).toHaveBeenCalledWith(
            expect.objectContaining({
                confidenceScore: 89,
                fileId: "src/api/auth.ts",
                riskLevel: "high",
            }),
        )
    })
})
