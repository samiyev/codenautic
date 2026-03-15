import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import {
    CityBusFactorOverlay,
    type ICityBusFactorOverlayEntry,
} from "@/components/codecity/overlays/city-bus-factor-overlay"
import { renderWithProviders } from "../utils/render"

const TEST_DISTRICTS: ReadonlyArray<ICityBusFactorOverlayEntry> = [
    {
        busFactor: 1,
        districtId: "src/api",
        districtLabel: "src/api",
        fileCount: 2,
        fileIds: ["src/api/auth.ts", "src/api/repository.ts"],
        primaryFileId: "src/api/auth.ts",
    },
    {
        busFactor: 3,
        districtId: "src/worker",
        districtLabel: "src/worker",
        fileCount: 3,
        fileIds: ["src/worker/main.ts", "src/worker/jobs.ts", "src/worker/retry.ts"],
        primaryFileId: "src/worker/main.ts",
    },
]

describe("CityBusFactorOverlay", (): void => {
    it("рендерит districts с bus factor risk label", (): void => {
        renderWithProviders(<CityBusFactorOverlay entries={TEST_DISTRICTS} />)

        expect(screen.getByText("Bus factor overlay")).not.toBeNull()
        expect(screen.getByLabelText("Bus factor districts")).not.toBeNull()
        expect(screen.getByText("src/api")).not.toBeNull()
        expect(screen.getByText("Files: 2 · Bus factor: 1")).not.toBeNull()
        expect(screen.getByText("Critical")).not.toBeNull()
        expect(screen.getByText("Healthy")).not.toBeNull()
    })

    it("вызывает onSelectEntry при выборе district", async (): Promise<void> => {
        const user = userEvent.setup()
        const onSelectEntry = vi.fn()

        renderWithProviders(
            <CityBusFactorOverlay entries={TEST_DISTRICTS} onSelectEntry={onSelectEntry} />,
        )

        await user.click(
            screen.getByRole("button", { name: "Inspect bus factor district src/api" }),
        )

        expect(onSelectEntry).toHaveBeenCalledTimes(1)
        expect(onSelectEntry).toHaveBeenCalledWith(
            expect.objectContaining({
                busFactor: 1,
                districtId: "src/api",
            }),
        )
    })
})
