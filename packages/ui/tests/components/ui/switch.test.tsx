import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { Switch } from "@/components/ui/switch"
import { renderWithProviders } from "../../utils/render"

describe("Switch", (): void => {
    it("when rendered, then displays a switch control", (): void => {
        renderWithProviders(<Switch aria-label="Toggle feature">Enable</Switch>)

        expect(screen.getByRole("switch")).not.toBeNull()
    })

    it("when clicked, then fires onValueChange callback", async (): Promise<void> => {
        const user = userEvent.setup()
        const handleChange = vi.fn()

        renderWithProviders(<Switch onValueChange={handleChange} aria-label="Dark mode" />)

        await user.click(screen.getByRole("switch"))
        expect(handleChange).toHaveBeenCalledTimes(1)
    })

    it("when isDisabled is true, then switch is not interactive", (): void => {
        renderWithProviders(<Switch isDisabled aria-label="Locked" />)

        const switchEl = screen.getByRole("switch")
        expect(switchEl).toHaveAttribute("disabled")
    })

    it("when isInvalid is true, then renders with data-invalid on wrapper", (): void => {
        const { container } = renderWithProviders(<Switch isInvalid aria-label="Invalid switch" />)

        const invalidEl = container.querySelector("[data-invalid]")
        expect(invalidEl).not.toBeNull()
    })
})
