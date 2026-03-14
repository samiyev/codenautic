import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { Textarea } from "@/components/ui/textarea"
import { renderWithProviders } from "../../utils/render"

describe("Textarea", (): void => {
    it("when rendered with placeholder, then displays textarea", (): void => {
        renderWithProviders(<Textarea placeholder="Write something" />)

        expect(screen.getByPlaceholderText("Write something")).not.toBeNull()
    })

    it("when onValueChange is provided, then fires with text value", async (): Promise<void> => {
        const user = userEvent.setup()
        const handleValueChange = vi.fn()

        renderWithProviders(<Textarea placeholder="Type" onValueChange={handleValueChange} />)

        await user.type(screen.getByPlaceholderText("Type"), "abc")
        expect(handleValueChange).toHaveBeenCalledTimes(3)
        expect(handleValueChange).toHaveBeenCalledWith("a")
    })

    it("when label is provided, then renders label element", (): void => {
        renderWithProviders(<Textarea label="Description" placeholder="desc" />)

        const label = screen.getByText("Description")
        expect(label.tagName).toBe("LABEL")
    })

    it("when isInvalid is true, then sets aria-invalid", (): void => {
        renderWithProviders(<Textarea placeholder="Invalid" isInvalid />)

        expect(screen.getByPlaceholderText("Invalid")).toHaveAttribute("aria-invalid", "true")
    })

    it("when isDisabled is true, then textarea is disabled", (): void => {
        renderWithProviders(<Textarea placeholder="Locked" isDisabled />)

        expect(screen.getByPlaceholderText("Locked")).toBeDisabled()
    })

    it("when startContent and endContent are provided, then renders wrapper", (): void => {
        renderWithProviders(
            <Textarea
                placeholder="Note"
                startContent={<span data-testid="start-icon">S</span>}
                endContent={<span data-testid="end-icon">E</span>}
            />,
        )

        expect(screen.getByTestId("start-icon")).not.toBeNull()
        expect(screen.getByTestId("end-icon")).not.toBeNull()
    })
})
