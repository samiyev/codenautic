import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { UserMenu } from "@/components/layout"
import { renderWithProviders } from "../utils/render"

describe("UserMenu", (): void => {
    it("открывает меню по pressable trigger и вызывает callbacks действий", async (): Promise<void> => {
        const user = userEvent.setup()
        const onOpenSettings = vi.fn()
        const onOpenBilling = vi.fn()
        const onOpenHelp = vi.fn()
        const onSignOut = vi.fn()

        renderWithProviders(
            <UserMenu
                onOpenBilling={onOpenBilling}
                onOpenHelp={onOpenHelp}
                onOpenSettings={onOpenSettings}
                onSignOut={onSignOut}
                userEmail="neo@metacortex.com"
                userName="Neo"
            />,
        )

        expect(screen.getAllByRole("button", { name: /neo/i })).toHaveLength(1)

        await user.click(screen.getByRole("button", { name: /neo/i }))

        expect(screen.getByRole("menu")).not.toBeNull()

        await user.click(screen.getByRole("menuitem", { name: "Open settings" }))
        expect(onOpenSettings).toHaveBeenCalledTimes(1)

        await user.click(screen.getByRole("button", { name: /neo/i }))
        await user.click(screen.getByRole("menuitem", { name: "Open billing" }))
        expect(onOpenBilling).toHaveBeenCalledTimes(1)

        await user.click(screen.getByRole("button", { name: /neo/i }))
        await user.click(screen.getByRole("menuitem", { name: "Help & diagnostics" }))
        expect(onOpenHelp).toHaveBeenCalledTimes(1)

        await user.click(screen.getByRole("button", { name: /neo/i }))
        await user.click(screen.getByRole("menuitem", { name: "Sign out" }))
        expect(onSignOut).toHaveBeenCalledTimes(1)
    })
})
