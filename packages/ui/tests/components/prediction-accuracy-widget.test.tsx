import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import {
    PredictionAccuracyWidget,
    type IPredictionAccuracyCase,
    type IPredictionAccuracyPoint,
    type IPredictionConfusionMatrix,
} from "@/components/predictions/prediction-accuracy-widget"
import { renderWithProviders } from "../utils/render"

const TEST_POINTS: ReadonlyArray<IPredictionAccuracyPoint> = [
    {
        accuracyScore: 81,
        actualIncidents: 4,
        predictedIncidents: 5,
        timestamp: "Jan 03",
    },
    {
        accuracyScore: 86,
        actualIncidents: 3,
        predictedIncidents: 3,
        timestamp: "Jan 10",
    },
]

const TEST_MATRIX: IPredictionConfusionMatrix = {
    falseNegative: 2,
    falsePositive: 1,
    trueNegative: 8,
    truePositive: 6,
}

const TEST_CASES: ReadonlyArray<IPredictionAccuracyCase> = [
    {
        actualOutcome: "incident",
        fileId: "src/api/auth.ts",
        id: "accuracy-auth",
        label: "src/api/auth.ts",
        predictedRiskLevel: "high",
    },
    {
        actualOutcome: "stable",
        fileId: "src/worker/retry.ts",
        id: "accuracy-retry",
        label: "src/worker/retry.ts",
        predictedRiskLevel: "medium",
    },
]

describe("PredictionAccuracyWidget", (): void => {
    it("рендерит accuracy trend, confusion matrix и case list", (): void => {
        renderWithProviders(
            <PredictionAccuracyWidget
                cases={TEST_CASES}
                matrix={TEST_MATRIX}
                points={TEST_POINTS}
            />,
        )

        expect(screen.getByText("Prediction accuracy widget")).not.toBeNull()
        expect(screen.getByLabelText("Prediction accuracy trend")).not.toBeNull()
        expect(screen.getByText("Jan 03: predicted 5 / actual 4 / accuracy 81%")).not.toBeNull()
        expect(screen.getByLabelText("Prediction confusion matrix")).not.toBeNull()
        expect(screen.getByText("TP 6")).not.toBeNull()
        expect(screen.getByText("TN 8")).not.toBeNull()
        expect(screen.getByLabelText("Prediction accuracy cases")).not.toBeNull()
        expect(
            screen.getByText("We predicted incident on src/api/auth.ts, actual result: incident."),
        ).not.toBeNull()
    })

    it("вызывает onSelectCase при выборе кейса", async (): Promise<void> => {
        const user = userEvent.setup()
        const onSelectCase = vi.fn()
        renderWithProviders(
            <PredictionAccuracyWidget
                cases={TEST_CASES}
                matrix={TEST_MATRIX}
                onSelectCase={onSelectCase}
                points={TEST_POINTS}
            />,
        )

        await user.click(
            screen.getByRole("button", {
                name: "Inspect prediction accuracy case src/worker/retry.ts",
            }),
        )

        expect(onSelectCase).toHaveBeenCalledTimes(1)
        expect(onSelectCase).toHaveBeenCalledWith(
            expect.objectContaining({
                actualOutcome: "stable",
                fileId: "src/worker/retry.ts",
                predictedRiskLevel: "medium",
            }),
        )
    })
})
