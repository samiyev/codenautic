import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { SidebarActions } from "@/components/layout/sidebar-actions"
import { renderWithProviders } from "../../utils/render"

describe("SidebarActions", (): void => {
    it("when rendered in expanded mode, then shows search input with keyboard shortcut", (): void => {
        renderWithProviders(<SidebarActions />)

        expect(screen.getByText("Search...")).not.toBeNull()
    })

    it("when rendered in expanded mode, then shows bell notification button", (): void => {
        renderWithProviders(<SidebarActions />)

        const bellButton = screen.getByLabelText("Notifications (0)")
        expect(bellButton).not.toBeNull()
    })

    it("when notificationCount is greater than 0, then shows notification badge", (): void => {
        renderWithProviders(<SidebarActions notificationCount={5} />)

        expect(screen.getByText("5")).not.toBeNull()
    })

    it("when notificationCount is 0, then does not show notification badge number", (): void => {
        const { container } = renderWithProviders(<SidebarActions notificationCount={0} />)

        const badge = container.querySelector("[aria-hidden='true'].rounded-full.bg-danger")
        expect(badge).toBeNull()
    })

    it("when search bar is clicked, then calls onOpenCommandPalette", async (): Promise<void> => {
        const user = userEvent.setup()
        const onOpenCommandPalette = vi.fn()

        renderWithProviders(<SidebarActions onOpenCommandPalette={onOpenCommandPalette} />)

        const searchButton = screen.getByLabelText("Open command palette (\u2318K)")
        await user.click(searchButton)

        expect(onOpenCommandPalette).toHaveBeenCalledOnce()
    })

    it("when isCollapsed is true, then renders compact column layout without search text", (): void => {
        renderWithProviders(<SidebarActions isCollapsed />)

        const searchButton = screen.getByLabelText("Open command palette (\u2318K)")
        expect(searchButton).not.toBeNull()
        expect(screen.queryByText("Search...")).toBeNull()
    })

    it("when isCollapsed is true and search icon is clicked, then calls onOpenCommandPalette", async (): Promise<void> => {
        const user = userEvent.setup()
        const onOpenCommandPalette = vi.fn()

        renderWithProviders(
            <SidebarActions isCollapsed onOpenCommandPalette={onOpenCommandPalette} />,
        )

        const searchButton = screen.getByLabelText("Open command palette (\u2318K)")
        await user.click(searchButton)

        expect(onOpenCommandPalette).toHaveBeenCalledOnce()
    })
})
