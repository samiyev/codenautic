import { screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { Sidebar } from "@/components/layout/sidebar"
import { renderWithProviders } from "../../utils/render"

vi.mock("@tanstack/react-router", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@tanstack/react-router")>()
    return {
        ...actual,
        useLocation: () => ({ pathname: "/" }),
        useNavigate: () => vi.fn(),
    }
})

describe("Sidebar", (): void => {
    it("when rendered, then shows aside element with brand mark", (): void => {
        const { container } = renderWithProviders(<Sidebar />)

        const aside = container.querySelector("aside")
        expect(aside).not.toBeNull()
        expect(screen.getByText("CodeNautic")).not.toBeNull()
    })

    it("when isCollapsed is true, then hides brand name text", (): void => {
        renderWithProviders(<Sidebar isCollapsed />)

        expect(screen.queryByText("CodeNautic")).toBeNull()
        expect(screen.getByText("CN")).not.toBeNull()
    })

    it("when headerSlot is provided, then renders header content", (): void => {
        renderWithProviders(
            <Sidebar headerSlot={<div data-testid="custom-header">Header content</div>} />,
        )

        expect(screen.getByTestId("custom-header")).not.toBeNull()
        expect(screen.getByText("Header content")).not.toBeNull()
    })

    it("when footerSlot is provided, then renders footer content", (): void => {
        renderWithProviders(
            <Sidebar footerSlot={<div data-testid="custom-footer">Footer content</div>} />,
        )

        expect(screen.getByTestId("custom-footer")).not.toBeNull()
        expect(screen.getByText("Footer content")).not.toBeNull()
    })

    it("when headerSlot is not provided, then header slot container is not rendered", (): void => {
        const { container } = renderWithProviders(<Sidebar />)

        const aside = container.querySelector("aside")
        expect(aside).not.toBeNull()
        expect(screen.queryByTestId("custom-header")).toBeNull()
    })

    it("when className is provided, then applies it to aside element", (): void => {
        const { container } = renderWithProviders(<Sidebar className="custom-test-class" />)

        const aside = container.querySelector("aside")
        expect(aside?.className).toContain("custom-test-class")
    })
})
