import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { EmptyState } from "@/components/states/empty-state"
import { renderWithProviders } from "../../utils/render"

describe("EmptyState", (): void => {
    it("when rendered, then displays title", (): void => {
        renderWithProviders(<EmptyState title="No items found" />)

        expect(screen.getByText("No items found")).not.toBeNull()
    })

    it("when description is provided, then displays it", (): void => {
        renderWithProviders(
            <EmptyState description="Try adjusting your filters" title="No results" />,
        )

        expect(screen.getByText("Try adjusting your filters")).not.toBeNull()
    })

    it("when icon is provided, then renders icon", (): void => {
        renderWithProviders(<EmptyState icon={<span data-testid="icon">📭</span>} title="Empty" />)

        expect(screen.getByTestId("icon")).not.toBeNull()
    })

    it("when action is provided, then renders action button", async (): Promise<void> => {
        const user = userEvent.setup()
        const onAction = vi.fn()

        renderWithProviders(
            <EmptyState actionLabel="Create new" onAction={onAction} title="No items" />,
        )

        const button = screen.getByRole("button", { name: "Create new" })
        await user.click(button)

        expect(onAction).toHaveBeenCalledTimes(1)
    })

    it("when no action is provided, then does not render button", (): void => {
        renderWithProviders(<EmptyState title="Empty" />)

        expect(screen.queryByRole("button")).toBeNull()
    })
})
