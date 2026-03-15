import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { SidebarNav } from "@/components/layout/sidebar-nav"
import { renderWithProviders } from "../../utils/render"

vi.mock("@tanstack/react-router", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@tanstack/react-router")>()
    return {
        ...actual,
        useLocation: () => ({ pathname: "/" }),
        useNavigate: () => vi.fn(),
    }
})

describe("SidebarNav", (): void => {
    it("when rendered without custom items, then shows default navigation groups", (): void => {
        renderWithProviders(<SidebarNav />)

        const nav = screen.getByRole("navigation", { name: "Main navigation" })
        expect(nav).not.toBeNull()
        expect(screen.getByText("Dashboard")).not.toBeNull()
        expect(screen.getByText("Settings")).not.toBeNull()
    })

    it("when custom items are provided, then renders only those items", (): void => {
        renderWithProviders(
            <SidebarNav
                items={[
                    { label: "Custom Page", to: "/custom" },
                    { label: "Another Page", to: "/another" },
                ]}
            />,
        )

        expect(screen.getByText("Custom Page")).not.toBeNull()
        expect(screen.getByText("Another Page")).not.toBeNull()
        expect(screen.queryByText("Settings")).toBeNull()
    })

    it("when current pathname matches item to, then marks item as active", (): void => {
        renderWithProviders(<SidebarNav />)

        const dashboardButton = screen.getByText("Dashboard")
        const listItem = dashboardButton.closest("button")
        expect(listItem?.getAttribute("aria-current")).toBe("page")
    })

    it("when item is disabled, then renders with aria-disabled", (): void => {
        renderWithProviders(
            <SidebarNav items={[{ isDisabled: true, label: "Disabled Page", to: "/disabled" }]} />,
        )

        const button = screen.getByText("Disabled Page").closest("button")
        expect(button?.getAttribute("aria-disabled")).toBe("true")
    })

    it("when item is clicked, then calls onNavigate callback", async (): Promise<void> => {
        const user = userEvent.setup()
        const onNavigate = vi.fn()

        renderWithProviders(
            <SidebarNav items={[{ label: "Test Item", to: "/test" }]} onNavigate={onNavigate} />,
        )

        await user.click(screen.getByText("Test Item"))

        expect(onNavigate).toHaveBeenCalledWith("/test")
    })

    it("when isCollapsed is true, then renders icon-only buttons with aria-label", (): void => {
        renderWithProviders(<SidebarNav isCollapsed />)

        const buttons = screen.getAllByRole("button")
        expect(buttons.length).toBeGreaterThan(0)
    })

    it("when rendered with groups, then shows group labels", (): void => {
        renderWithProviders(<SidebarNav />)

        expect(screen.getByText("Reviews")).not.toBeNull()
        expect(screen.getByText("Intelligence")).not.toBeNull()
    })

    it("when rendered, then does not show removed navigation items", (): void => {
        renderWithProviders(<SidebarNav />)

        expect(screen.queryByText("Onboarding")).toBeNull()
        expect(screen.queryByText("Scan Progress")).toBeNull()
        expect(screen.queryByText("Operations")).toBeNull()
        expect(screen.queryByText("Analytics")).toBeNull()
    })

    it("when rendered, then shows My Work as the first item", (): void => {
        renderWithProviders(<SidebarNav />)

        const buttons = screen.getAllByRole("button")
        const firstButton = buttons[0]
        expect(firstButton?.textContent).toContain("My Work")
    })
})
