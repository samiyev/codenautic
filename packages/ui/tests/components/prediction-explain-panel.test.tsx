import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import {
    PredictionExplainPanel,
    type IPredictionExplainPanelEntry,
} from "@/components/predictions/prediction-explain-panel"
import { renderWithProviders } from "../utils/render"

const TEST_ENTRIES: ReadonlyArray<IPredictionExplainPanelEntry> = [
    {
        confidenceScore: 92,
        explanation:
            "LLM forecast highlights repeated churn around auth boundary and rising complexity in adjacent modules.",
        fileId: "src/api/auth.ts",
        label: "src/api/auth.ts",
        reason: "High churn and bug introduction density",
        riskLevel: "high",
    },
    {
        confidenceScore: 75,
        explanation:
            "LLM forecast sees unstable temporal couplings with retry worker and queue bridge.",
        fileId: "src/worker/retry.ts",
        label: "src/worker/retry.ts",
        reason: "Medium volatility in temporal coupling window",
        riskLevel: "medium",
    },
]

describe("PredictionExplainPanel", (): void => {
    it("рендерит entries и explanation details", (): void => {
        renderWithProviders(<PredictionExplainPanel entries={TEST_ENTRIES} />)

        expect(screen.getByText("Prediction explain panel")).not.toBeNull()
        expect(screen.getByLabelText("Prediction explain entries")).not.toBeNull()
        expect(screen.getByText("Risk High · Confidence 92%")).not.toBeNull()
        expect(screen.getByLabelText("Prediction explanation details")).not.toBeNull()
        expect(
            screen.getByText(
                "High churn and bug introduction density. LLM forecast highlights repeated churn around auth boundary and rising complexity in adjacent modules.",
            ),
        ).not.toBeNull()
    })

    it("вызывает onSelectEntry при выборе prediction entry", async (): Promise<void> => {
        const user = userEvent.setup()
        const onSelectEntry = vi.fn()
        renderWithProviders(
            <PredictionExplainPanel entries={TEST_ENTRIES} onSelectEntry={onSelectEntry} />,
        )

        await user.click(
            screen.getByRole("button", {
                name: "Inspect prediction explanation for src/worker/retry.ts",
            }),
        )

        expect(onSelectEntry).toHaveBeenCalledTimes(1)
        expect(onSelectEntry).toHaveBeenCalledWith(
            expect.objectContaining({
                fileId: "src/worker/retry.ts",
                riskLevel: "medium",
            }),
        )
    })
})
