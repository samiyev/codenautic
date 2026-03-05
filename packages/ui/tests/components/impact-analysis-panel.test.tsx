import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import {
    ImpactAnalysisPanel,
    type IImpactAnalysisSeed,
} from "@/components/graphs/impact-analysis-panel"
import { renderWithProviders } from "../utils/render"

const TEST_SEEDS: ReadonlyArray<IImpactAnalysisSeed> = [
    {
        affectedConsumers: ["review-worker"],
        affectedFiles: ["src/services/retry.ts", "src/queue/worker.ts"],
        affectedTests: ["tests/retry.test.ts"],
        fileId: "src/services/retry.ts",
        id: "impact-1",
        label: "src/services/retry.ts",
        riskScore: 81,
    },
    {
        affectedConsumers: ["scheduler", "notification-worker"],
        affectedFiles: ["src/jobs/sync.ts"],
        affectedTests: ["tests/sync.test.ts"],
        fileId: "src/jobs/sync.ts",
        id: "impact-2",
        label: "src/jobs/sync.ts",
        riskScore: 67,
    },
]

describe("ImpactAnalysisPanel", (): void => {
    it("показывает blast radius и агрегированный risk score для выбранных файлов", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<ImpactAnalysisPanel seeds={TEST_SEEDS} />)

        expect(screen.getByText("Impact analysis panel")).not.toBeNull()
        expect(screen.getByText("Aggregated risk score")).not.toBeNull()

        await user.click(
            screen.getByRole("checkbox", { name: "Select impact file src/services/retry.ts" }),
        )
        expect(screen.getByText("Selected files: 1")).not.toBeNull()
        expect(screen.getByText("src/services/retry.ts, src/queue/worker.ts")).not.toBeNull()
        expect(screen.getByText("tests/retry.test.ts")).not.toBeNull()
        expect(screen.getByText("review-worker")).not.toBeNull()
    })

    it("передаёт выбранный сценарий в callback", async (): Promise<void> => {
        const user = userEvent.setup()
        const onApplyImpact = vi.fn()
        renderWithProviders(<ImpactAnalysisPanel onApplyImpact={onApplyImpact} seeds={TEST_SEEDS} />)

        await user.click(
            screen.getByRole("checkbox", { name: "Select impact file src/services/retry.ts" }),
        )
        await user.click(screen.getByRole("button", { name: "Apply impact focus" }))

        expect(onApplyImpact).toHaveBeenCalledTimes(1)
        expect(onApplyImpact).toHaveBeenCalledWith(
            expect.objectContaining({
                fileId: "src/services/retry.ts",
                label: "src/services/retry.ts",
                riskScore: 81,
            }),
        )
    })
})
