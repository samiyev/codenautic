import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { ContentToolbar } from "@/components/layout/content-toolbar"
import { renderWithProviders } from "../../utils/render"

vi.mock("@tanstack/react-router", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@tanstack/react-router")>()
    return {
        ...actual,
        useLocation: () => ({ pathname: "/" }),
        useNavigate: () => vi.fn(),
    }
})

describe("ContentToolbar", (): void => {
    it("when rendered without breadcrumbs, then shows toolbar container", (): void => {
        const { container } = renderWithProviders(<ContentToolbar />)

        expect(container.firstElementChild).not.toBeNull()
    })

    it("when breadcrumbs are provided, then renders breadcrumb navigation", (): void => {
        renderWithProviders(
            <ContentToolbar
                breadcrumbs={[{ label: "Home", path: "/" }, { label: "Current page" }]}
            />,
        )

        expect(screen.getByText("Home")).not.toBeNull()
        expect(screen.getAllByText("Current page").length).toBeGreaterThan(0)
    })

    it("when notificationCount is greater than 0, then shows notification badge", (): void => {
        renderWithProviders(<ContentToolbar notificationCount={5} />)

        expect(screen.getByText("5")).not.toBeNull()
    })

    it("when notificationCount is 0, then does not show notification badge count", (): void => {
        renderWithProviders(<ContentToolbar notificationCount={0} />)

        expect(screen.queryByText("0")).toBeNull()
    })

    it("when onBreadcrumbNavigate is provided, then clicking breadcrumb calls handler", async (): Promise<void> => {
        const user = userEvent.setup()
        const onNavigate = vi.fn()

        renderWithProviders(
            <ContentToolbar
                breadcrumbs={[{ label: "Home", path: "/" }, { label: "Current" }]}
                onBreadcrumbNavigate={onNavigate}
            />,
        )

        const homeButton = screen.getByText("Home")
        await user.click(homeButton)

        expect(onNavigate).toHaveBeenCalledWith("/")
    })
})
