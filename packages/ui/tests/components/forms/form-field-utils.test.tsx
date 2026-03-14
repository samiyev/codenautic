import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { pickFieldMessage } from "@/components/forms/form-field-utils"
import { renderWithProviders } from "../../utils/render"

describe("pickFieldMessage", (): void => {
    it("when errorMessage is provided, then renders error text with alert role", (): void => {
        const result = pickFieldMessage("Email is required", undefined)
        renderWithProviders(<div>{result}</div>)

        const alert = screen.getByRole("alert")
        expect(alert).not.toBeNull()
        expect(alert.textContent).toBe("Email is required")
    })

    it("when errorMessage is empty string, then returns helperText instead", (): void => {
        const result = pickFieldMessage("", "Enter your email")
        renderWithProviders(<div>{result}</div>)

        expect(screen.queryByRole("alert")).toBeNull()
        expect(screen.getByText("Enter your email")).not.toBeNull()
    })

    it("when both are undefined, then returns null", (): void => {
        const result = pickFieldMessage(undefined, undefined)
        expect(result).toBeNull()
    })

    it("when helperText is provided without error, then renders helper paragraph", (): void => {
        const result = pickFieldMessage(undefined, "Use your corporate email")
        renderWithProviders(<div>{result}</div>)

        expect(screen.queryByRole("alert")).toBeNull()
        expect(screen.getByText("Use your corporate email")).not.toBeNull()
    })

    it("when both errorMessage and helperText are provided, then shows error over helper", (): void => {
        const result = pickFieldMessage("Field required", "Hint text")
        renderWithProviders(<div>{result}</div>)

        expect(screen.getByRole("alert").textContent).toBe("Field required")
        expect(screen.queryByText("Hint text")).toBeNull()
    })

    it("when helperText is empty string, then returns null", (): void => {
        const result = pickFieldMessage(undefined, "")
        expect(result).toBeNull()
    })
})
