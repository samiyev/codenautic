import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactElement } from "react"
import { useForm } from "react-hook-form"
import { describe, expect, it } from "vitest"

import { FormPasswordField } from "@/components/forms/form-password-field"
import { renderWithProviders } from "../../utils/render"

interface ITestForm {
    password: string
}

function PasswordHarness(props: { readonly defaultPassword?: string }): ReactElement {
    const form = useForm<ITestForm>({
        defaultValues: { password: props.defaultPassword ?? "" },
    })

    return (
        <form>
            <FormPasswordField<ITestForm, "password">
                control={form.control}
                label="Password"
                name="password"
            />
        </form>
    )
}

describe("FormPasswordField", (): void => {
    it("when rendered, then shows password input with type password", (): void => {
        renderWithProviders(<PasswordHarness />)

        const input = screen.getByLabelText<HTMLInputElement>("Password")
        expect(input.type).toBe("password")
    })

    it("when show button clicked, then toggles input type to text", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<PasswordHarness defaultPassword="secret123" />)

        const input = screen.getByLabelText<HTMLInputElement>("Password")
        expect(input.type).toBe("password")

        const showButton = screen.getByRole("button", { name: "Show password text" })
        await user.click(showButton)

        expect(input.type).toBe("text")
        expect(screen.getByRole("button", { name: "Hide password text" })).not.toBeNull()
    })

    it("when hide button clicked, then toggles back to password type", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<PasswordHarness defaultPassword="secret123" />)

        await user.click(screen.getByRole("button", { name: "Show password text" }))
        await user.click(screen.getByRole("button", { name: "Hide password text" }))

        const input = screen.getByLabelText<HTMLInputElement>("Password")
        expect(input.type).toBe("password")
    })

    it("when rendered with default value, then input contains the value", (): void => {
        renderWithProviders(<PasswordHarness defaultPassword="my-pass" />)

        const input = screen.getByLabelText<HTMLInputElement>("Password")
        expect(input.value).toBe("my-pass")
    })
})
