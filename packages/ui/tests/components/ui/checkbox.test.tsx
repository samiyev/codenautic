import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { Checkbox } from "@/components/ui/checkbox"
import { renderWithProviders } from "../../utils/render"

describe("Checkbox", (): void => {
    it("when rendered with children, then displays label text", (): void => {
        renderWithProviders(<Checkbox>Accept terms</Checkbox>)

        expect(screen.getByText("Accept terms")).not.toBeNull()
    })

    it("when clicked, then toggles checked state", async (): Promise<void> => {
        const user = userEvent.setup()
        const handleChange = vi.fn()

        renderWithProviders(<Checkbox onValueChange={handleChange}>Toggle</Checkbox>)

        await user.click(screen.getByText("Toggle"))
        expect(handleChange).toHaveBeenCalledTimes(1)
    })

    it("when isDisabled is true, then checkbox is disabled", (): void => {
        renderWithProviders(<Checkbox isDisabled>Disabled</Checkbox>)

        const checkbox = screen.getByRole("checkbox")
        expect(checkbox).toBeDisabled()
    })

    it("when isSelected is true, then checkbox is checked", (): void => {
        renderWithProviders(<Checkbox isSelected>Checked</Checkbox>)

        const checkbox = screen.getByRole("checkbox")
        expect(checkbox).toBeChecked()
    })
})
