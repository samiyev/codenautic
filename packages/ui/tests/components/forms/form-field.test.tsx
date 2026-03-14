import { screen } from "@testing-library/react"
import type { FormEvent, ReactElement } from "react"
import { useForm } from "react-hook-form"
import { describe, expect, it } from "vitest"

import { FormField } from "@/components/forms/form-field"
import { renderWithProviders } from "../../utils/render"

interface ITestForm {
    name: string
}

function FormFieldHarness(props: {
    readonly label?: string
    readonly helperText?: string
    readonly showRequiredMarker?: boolean
    readonly hideLabel?: boolean
    readonly gapClass?: string
    readonly id?: string
    readonly labelElement?: "label" | "span"
}): ReactElement {
    const form = useForm<ITestForm>({ defaultValues: { name: "" } })

    return (
        <form
            onSubmit={(event: FormEvent<HTMLFormElement>): void => {
                event.preventDefault()
            }}
        >
            <FormField<ITestForm, "name">
                control={form.control}
                name="name"
                label={props.label}
                helperText={props.helperText}
                showRequiredMarker={props.showRequiredMarker}
                hideLabel={props.hideLabel}
                gapClass={props.gapClass}
                id={props.id}
                labelElement={props.labelElement}
                renderField={({ field, fieldId, accessibilityLabel }): ReactElement => (
                    <input
                        aria-label={accessibilityLabel}
                        id={fieldId}
                        name={field.name}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                    />
                )}
            />
        </form>
    )
}

describe("FormField", (): void => {
    it("when label is provided, then renders label element", (): void => {
        renderWithProviders(<FormFieldHarness label="Full name" />)

        expect(screen.getByText("Full name")).not.toBeNull()
    })

    it("when hideLabel is true, then does not render label text", (): void => {
        renderWithProviders(<FormFieldHarness label="Hidden" hideLabel />)

        expect(screen.queryByText("Hidden")).toBeNull()
    })

    it("when helperText is provided, then renders helper paragraph", (): void => {
        renderWithProviders(<FormFieldHarness label="Name" helperText="Enter full name" />)

        expect(screen.getByText("Enter full name")).not.toBeNull()
    })

    it("when showRequiredMarker is true, then renders asterisk", (): void => {
        renderWithProviders(<FormFieldHarness label="Email" showRequiredMarker />)

        expect(screen.getByText("*")).not.toBeNull()
    })

    it("when label is not provided, then does not render label element", (): void => {
        const { container } = renderWithProviders(<FormFieldHarness />)

        expect(container.querySelector("label")).toBeNull()
    })

    it("when labelElement is span, then uses span instead of label", (): void => {
        const { container } = renderWithProviders(
            <FormFieldHarness label="Group label" labelElement="span" />,
        )

        expect(container.querySelector("label")).toBeNull()
        expect(screen.getByText("Group label").tagName.toLowerCase()).toBe("span")
    })
})
