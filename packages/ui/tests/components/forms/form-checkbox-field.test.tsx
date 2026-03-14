import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactElement } from "react"
import { useForm } from "react-hook-form"
import { describe, expect, it } from "vitest"

import { FormCheckboxField } from "@/components/forms/form-checkbox-field"
import { renderWithProviders } from "../../utils/render"

interface ITestForm {
    enabled: boolean
}

function CheckboxHarness(props: { readonly defaultValue?: boolean }): ReactElement {
    const form = useForm<ITestForm>({
        defaultValues: { enabled: props.defaultValue ?? false },
    })

    return (
        <form>
            <FormCheckboxField<ITestForm, "enabled">
                control={form.control}
                label="Enable feature"
                name="enabled"
            />
        </form>
    )
}

describe("FormCheckboxField", (): void => {
    it("when rendered, then shows checkbox with label", (): void => {
        renderWithProviders(<CheckboxHarness />)

        expect(screen.getByRole("checkbox", { name: "Enable feature" })).not.toBeNull()
        expect(screen.getByText("Enable feature")).not.toBeNull()
    })

    it("when default value is false, then checkbox is unchecked", (): void => {
        renderWithProviders(<CheckboxHarness defaultValue={false} />)

        const checkbox = screen.getByRole("checkbox", { name: "Enable feature" })
        expect(checkbox).not.toBeChecked()
    })

    it("when default value is true, then checkbox is checked", (): void => {
        renderWithProviders(<CheckboxHarness defaultValue />)

        const checkbox = screen.getByRole("checkbox", { name: "Enable feature" })
        expect(checkbox).toBeChecked()
    })

    it("when clicked, then toggles checked state", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<CheckboxHarness />)

        const checkbox = screen.getByRole("checkbox", { name: "Enable feature" })
        expect(checkbox).not.toBeChecked()

        await user.click(checkbox)
        expect(checkbox).toBeChecked()
    })
})
