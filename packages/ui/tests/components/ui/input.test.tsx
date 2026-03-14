import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { Input } from "@/components/ui/input"
import { renderWithProviders } from "../../utils/render"

describe("Input", (): void => {
    it("when rendered with placeholder, then displays input element", (): void => {
        renderWithProviders(<Input placeholder="Enter text" />)

        expect(screen.getByPlaceholderText("Enter text")).not.toBeNull()
    })

    it("when onValueChange is provided, then fires with string value on typing", async (): Promise<void> => {
        const user = userEvent.setup()
        const handleValueChange = vi.fn()

        renderWithProviders(<Input placeholder="Type here" onValueChange={handleValueChange} />)

        await user.type(screen.getByPlaceholderText("Type here"), "hello")
        expect(handleValueChange).toHaveBeenCalledWith("h")
        expect(handleValueChange).toHaveBeenCalledTimes(5)
    })

    it("when onChange is provided, then fires with change event", async (): Promise<void> => {
        const user = userEvent.setup()
        const handleChange = vi.fn()

        renderWithProviders(<Input placeholder="Change" onChange={handleChange} />)

        await user.type(screen.getByPlaceholderText("Change"), "a")
        expect(handleChange).toHaveBeenCalledTimes(1)
    })

    it("when label is provided, then renders label element linked to input", (): void => {
        renderWithProviders(<Input label="Username" placeholder="name" />)

        const label = screen.getByText("Username")
        expect(label.tagName).toBe("LABEL")
        expect(label).toHaveAttribute("for")
    })

    it("when isInvalid is true, then sets aria-invalid attribute", (): void => {
        renderWithProviders(<Input placeholder="Invalid" isInvalid />)

        expect(screen.getByPlaceholderText("Invalid")).toHaveAttribute("aria-invalid", "true")
    })

    it("when isDisabled is true, then input is disabled", (): void => {
        renderWithProviders(<Input placeholder="Disabled" isDisabled />)

        expect(screen.getByPlaceholderText("Disabled")).toBeDisabled()
    })

    it("when startContent and endContent are provided, then renders wrapper with icons", (): void => {
        renderWithProviders(
            <Input
                placeholder="Search"
                startContent={<span data-testid="prefix">@</span>}
                endContent={<span data-testid="suffix">!</span>}
            />,
        )

        expect(screen.getByTestId("prefix")).not.toBeNull()
        expect(screen.getByTestId("suffix")).not.toBeNull()
    })
})
