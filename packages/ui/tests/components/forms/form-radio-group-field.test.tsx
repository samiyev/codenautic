import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactElement } from "react"
import { useForm } from "react-hook-form"
import { describe, expect, it } from "vitest"

import { FormRadioGroupField } from "@/components/forms/form-radio-group-field"
import { renderWithProviders } from "../../utils/render"

interface ITestForm {
    mode: string
}

const TEST_OPTIONS = [
    { label: "Strict", value: "strict" },
    { label: "Relaxed", value: "relaxed" },
    { label: "Custom", value: "custom", isDisabled: true },
]

function RadioGroupHarness(props: { readonly defaultValue?: string }): ReactElement {
    const form = useForm<ITestForm>({
        defaultValues: { mode: props.defaultValue ?? "relaxed" },
    })

    return (
        <form>
            <FormRadioGroupField<ITestForm, "mode">
                control={form.control}
                label="Mode"
                name="mode"
                options={TEST_OPTIONS}
            />
        </form>
    )
}

describe("FormRadioGroupField", (): void => {
    it("when rendered, then shows all radio options", (): void => {
        renderWithProviders(<RadioGroupHarness />)

        expect(screen.getByRole("radio", { name: "Strict" })).not.toBeNull()
        expect(screen.getByRole("radio", { name: "Relaxed" })).not.toBeNull()
        expect(screen.getByRole("radio", { name: "Custom" })).not.toBeNull()
    })

    it("when default value is set, then corresponding radio is checked", (): void => {
        renderWithProviders(<RadioGroupHarness defaultValue="strict" />)

        expect(screen.getByRole("radio", { name: "Strict" })).toBeChecked()
        expect(screen.getByRole("radio", { name: "Relaxed" })).not.toBeChecked()
    })

    it("when user clicks a radio, then selection changes", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<RadioGroupHarness defaultValue="relaxed" />)

        expect(screen.getByRole("radio", { name: "Relaxed" })).toBeChecked()

        await user.click(screen.getByRole("radio", { name: "Strict" }))
        expect(screen.getByRole("radio", { name: "Strict" })).toBeChecked()
    })

    it("when label is provided, then renders label text", (): void => {
        renderWithProviders(<RadioGroupHarness />)

        expect(screen.getByText("Mode")).not.toBeNull()
    })
})
