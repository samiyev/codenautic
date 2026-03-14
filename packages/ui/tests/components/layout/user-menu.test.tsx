import { screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { UserMenu } from "@/components/layout/user-menu"
import { renderWithProviders } from "../../utils/render"

vi.mock("@tanstack/react-router", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@tanstack/react-router")>()
    return {
        ...actual,
        useLocation: () => ({ pathname: "/" }),
        useNavigate: () => vi.fn(),
    }
})

describe("UserMenu", (): void => {
    it("when rendered with userName, then displays user name", (): void => {
        renderWithProviders(<UserMenu userName="John Doe" />)

        expect(screen.getByText("John Doe")).not.toBeNull()
    })

    it("when rendered without userName, then displays default name", (): void => {
        renderWithProviders(<UserMenu />)

        const container = screen.getByText(
            (_content, element): boolean =>
                element !== null &&
                element.tagName !== "SCRIPT" &&
                element.textContent !== null &&
                element.textContent.length > 0 &&
                element.classList.contains("font-medium"),
        )
        expect(container).not.toBeNull()
    })

    it("when rendered, then contains avatar", (): void => {
        const { container } = renderWithProviders(<UserMenu userName="Alice" />)

        const avatar =
            container.querySelector("[data-slot='base']") ?? container.querySelector("span")
        expect(avatar).not.toBeNull()
    })

    it("when rendered with userName, then computes initials", (): void => {
        renderWithProviders(<UserMenu userName="Bob" />)

        const initialsElements = screen.getAllByText("BO")
        expect(initialsElements.length).toBeGreaterThan(0)
    })
})
