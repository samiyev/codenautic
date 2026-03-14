import { screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { SettingsLayout } from "@/components/layout/settings-layout"
import { renderWithProviders } from "../../utils/render"

vi.mock("@tanstack/react-router", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@tanstack/react-router")>()
    return {
        ...actual,
        useLocation: () => ({ pathname: "/settings" }),
        useNavigate: () => vi.fn(),
        Outlet: () => <div data-testid="outlet">Nested outlet</div>,
    }
})

describe("SettingsLayout", (): void => {
    it("when rendered without children, then renders outlet", (): void => {
        renderWithProviders(<SettingsLayout />)

        expect(screen.getByTestId("outlet")).not.toBeNull()
    })

    it("when children are provided, then renders children instead of outlet", (): void => {
        renderWithProviders(
            <SettingsLayout>
                <p>Custom settings content</p>
            </SettingsLayout>,
        )

        expect(screen.getByText("Custom settings content")).not.toBeNull()
        expect(screen.queryByTestId("outlet")).toBeNull()
    })

    it("when title is provided, then shows custom title", (): void => {
        renderWithProviders(
            <SettingsLayout title="Custom Title">
                <p>Content</p>
            </SettingsLayout>,
        )

        expect(screen.getByText("Custom Title")).not.toBeNull()
    })

    it("when rendered, then contains aside navigation and main content area", (): void => {
        const { container } = renderWithProviders(
            <SettingsLayout>
                <p>Content</p>
            </SettingsLayout>,
        )

        const aside = container.querySelector("aside")
        const main = container.querySelector("main")
        expect(aside).not.toBeNull()
        expect(main).not.toBeNull()
    })
})
