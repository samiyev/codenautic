import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { FormEvent, ReactElement } from "react"
import { useForm } from "react-hook-form"
import { describe, expect, it, vi } from "vitest"

import { FormTextField } from "@/components/forms/form-text-field"
import { renderWithProviders } from "../../utils/render"

interface ITestForm {
    email: string
}

function TextFieldHarness(props: {
    readonly helperText?: string
    readonly disabled?: boolean
    readonly onSubmit?: (values: ITestForm) => void
    readonly rules?: object
}): ReactElement {
    const form = useForm<ITestForm>({ defaultValues: { email: "" } })

    const submitForm = (event: FormEvent<HTMLFormElement>): void => {
        void form.handleSubmit((values): void => {
            props.onSubmit?.(values)
        })(event)
    }

    return (
        <form onSubmit={submitForm}>
            <FormTextField<ITestForm, "email">
                control={form.control}
                label="Email"
                name="email"
                helperText={props.helperText}
                inputProps={{ disabled: props.disabled }}
                rules={props.rules}
            />
            <button type="submit">Submit</button>
        </form>
    )
}

describe("FormTextField", (): void => {
    it("when rendered, then displays label and input", (): void => {
        renderWithProviders(<TextFieldHarness />)

        expect(screen.getByText("Email")).not.toBeNull()
        expect(screen.getByRole("textbox", { name: "Email" })).not.toBeNull()
    })

    it("when user types, then updates input value", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<TextFieldHarness />)

        const input = screen.getByRole("textbox", { name: "Email" })
        await user.type(input, "test@example.com")

        expect((input as HTMLInputElement).value).toBe("test@example.com")
    })

    it("when helperText is provided, then renders helper text", (): void => {
        renderWithProviders(<TextFieldHarness helperText="Enter corporate email" />)

        expect(screen.getByText("Enter corporate email")).not.toBeNull()
    })

    it("when disabled is true, then input is disabled", (): void => {
        renderWithProviders(<TextFieldHarness disabled />)

        const input = screen.getByRole("textbox", { name: "Email" })
        expect(input).toBeDisabled()
    })

    it("when required validation fails, then shows error message", async (): Promise<void> => {
        const user = userEvent.setup()
        const onSubmit = vi.fn()

        renderWithProviders(
            <TextFieldHarness onSubmit={onSubmit} rules={{ required: "Email is required" }} />,
        )

        await user.click(screen.getByRole("button", { name: "Submit" }))

        expect(screen.getByText("Email is required")).not.toBeNull()
        expect(onSubmit).not.toHaveBeenCalled()
    })
})
