import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { WhatIfPanel, type IWhatIfOption } from "@/components/predictions/what-if-panel"
import { renderWithProviders } from "../utils/render"

const TEST_OPTIONS: ReadonlyArray<IWhatIfOption> = [
    {
        affectedCount: 3,
        fileId: "src/services/retry.ts",
        id: "what-if-1",
        impactScore: 81,
        label: "src/services/retry.ts",
    },
    {
        affectedCount: 2,
        fileId: "src/jobs/sync.ts",
        id: "what-if-2",
        impactScore: 67,
        label: "src/jobs/sync.ts",
    },
]

describe("WhatIfPanel", (): void => {
    it("собирает multi-file сценарий и показывает aggregated impact", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<WhatIfPanel options={TEST_OPTIONS} />)

        expect(screen.getByText("What-if panel")).not.toBeNull()
        await user.click(
            screen.getByRole("checkbox", {
                name: "Select what-if option src/services/retry.ts",
            }),
        )
        await user.click(
            screen.getByRole("checkbox", {
                name: "Select what-if option src/jobs/sync.ts",
            }),
        )

        expect(screen.getByText("Files: 2 · Impact score: 74 · Total affected: 5")).not.toBeNull()
    })

    it("вызывает callback при запуске what-if сценария", async (): Promise<void> => {
        const user = userEvent.setup()
        const onRunScenario = vi.fn()
        renderWithProviders(<WhatIfPanel onRunScenario={onRunScenario} options={TEST_OPTIONS} />)

        await user.click(
            screen.getByRole("checkbox", {
                name: "Select what-if option src/services/retry.ts",
            }),
        )
        await user.click(screen.getByRole("button", { name: "Run what-if scenario" }))

        expect(onRunScenario).toHaveBeenCalledTimes(1)
        expect(onRunScenario).toHaveBeenCalledWith(
            expect.objectContaining({
                aggregatedScore: 81,
                fileIds: ["src/services/retry.ts"],
                totalAffectedCount: 3,
            }),
        )
    })
})
