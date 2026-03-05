import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { SimulationPanel } from "@/components/graphs/simulation-panel"
import type { IRefactoringTargetDescriptor } from "@/components/graphs/refactoring-dashboard"
import { renderWithProviders } from "../utils/render"

const TEST_TARGETS: ReadonlyArray<IRefactoringTargetDescriptor> = [
    {
        description: "API retry stabilization",
        effortScore: 7,
        fileId: "src/api/retry.ts",
        id: "target-retry",
        module: "api",
        riskScore: 82,
        roiScore: 94,
        title: "src/api/retry.ts",
    },
    {
        description: "Queue backpressure cleanup",
        effortScore: 5,
        fileId: "src/queue/worker.ts",
        id: "target-queue",
        module: "worker",
        riskScore: 74,
        roiScore: 87,
        title: "src/queue/worker.ts",
    },
]

describe("SimulationPanel", (): void => {
    it("переключает режим before/after и показывает сравнение метрик", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SimulationPanel targets={TEST_TARGETS} />)

        expect(screen.getByText("Simulation panel")).not.toBeNull()
        expect(screen.getByText("Simulation mode: before")).not.toBeNull()
        expect(screen.getByText("Complexity")).not.toBeNull()
        expect(screen.getByText("Risk")).not.toBeNull()
        expect(screen.getByText("Maintainability")).not.toBeNull()

        await user.click(screen.getByRole("button", { name: "After" }))
        expect(screen.getByText("Simulation mode: after")).not.toBeNull()
    })

    it("отправляет выбранный сценарий через callback", async (): Promise<void> => {
        const user = userEvent.setup()
        const onPreviewScenario = vi.fn()
        renderWithProviders(
            <SimulationPanel onPreviewScenario={onPreviewScenario} targets={TEST_TARGETS} />,
        )

        await user.click(screen.getByRole("button", { name: "After" }))
        await user.click(screen.getByRole("button", { name: "Preview refactoring simulation" }))

        expect(onPreviewScenario).toHaveBeenCalledTimes(1)
        expect(onPreviewScenario).toHaveBeenCalledWith(
            expect.objectContaining({
                fileIds: ["src/api/retry.ts", "src/queue/worker.ts"],
                mode: "after",
            }),
        )
    })
})
