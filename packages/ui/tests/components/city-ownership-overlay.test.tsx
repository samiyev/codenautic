import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import {
    CityOwnershipOverlay,
    type ICityOwnershipOverlayOwnerEntry,
} from "@/components/graphs/city-ownership-overlay"
import { renderWithProviders } from "../utils/render"

const TEST_OWNERS: ReadonlyArray<ICityOwnershipOverlayOwnerEntry> = [
    {
        color: "#0f766e",
        fileIds: ["src/api/auth.ts", "src/api/repository.ts"],
        ownerId: "alice",
        ownerName: "Alice Rivera",
        primaryFileId: "src/api/auth.ts",
    },
    {
        color: "#2563eb",
        fileIds: ["src/worker/index.ts"],
        ownerId: "max",
        ownerName: "Max H.",
        primaryFileId: "src/worker/index.ts",
    },
]

describe("CityOwnershipOverlay", (): void => {
    it("рендерит ownership legend с владельцами", (): void => {
        renderWithProviders(<CityOwnershipOverlay isEnabled={true} owners={TEST_OWNERS} />)

        expect(screen.getByText("Ownership overlay")).not.toBeNull()
        expect(screen.getByLabelText("Ownership legend")).not.toBeNull()
        expect(screen.getByText("Alice Rivera")).not.toBeNull()
        expect(screen.getByText("Files: 2")).not.toBeNull()
        expect(screen.getByRole("button", { name: "Disable ownership colors" })).not.toBeNull()
    })

    it("вызывает onToggleEnabled при переключении ownership colors", async (): Promise<void> => {
        const user = userEvent.setup()
        const onToggleEnabled = vi.fn()
        renderWithProviders(
            <CityOwnershipOverlay
                isEnabled={true}
                onToggleEnabled={onToggleEnabled}
                owners={TEST_OWNERS}
            />,
        )

        await user.click(screen.getByRole("button", { name: "Disable ownership colors" }))

        expect(onToggleEnabled).toHaveBeenCalledTimes(1)
        expect(onToggleEnabled).toHaveBeenCalledWith(false)
    })

    it("вызывает onSelectOwner при выборе владельца", async (): Promise<void> => {
        const user = userEvent.setup()
        const onSelectOwner = vi.fn()
        renderWithProviders(
            <CityOwnershipOverlay
                activeOwnerId="alice"
                isEnabled={true}
                onSelectOwner={onSelectOwner}
                owners={TEST_OWNERS}
            />,
        )

        await user.click(screen.getByRole("button", { name: "Focus ownership Alice Rivera" }))

        expect(onSelectOwner).toHaveBeenCalledTimes(1)
        expect(onSelectOwner).toHaveBeenCalledWith(
            expect.objectContaining({
                ownerId: "alice",
                primaryFileId: "src/api/auth.ts",
            }),
        )
    })
})
