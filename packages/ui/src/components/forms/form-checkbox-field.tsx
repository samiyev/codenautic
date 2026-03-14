import { type ReactElement } from "react"
import { type FieldPath, type FieldValues } from "react-hook-form"
import { Checkbox } from "@heroui/react"

import { FormField, type IFormFieldProps } from "./form-field"

/**
 * Свойства checkbox-поля.
 */
export type IFormCheckboxFieldProps<
    TFormValues extends FieldValues,
    TName extends FieldPath<TFormValues>,
> = Omit<
    IFormFieldProps<TFormValues, TName>,
    "renderField" | "labelElement" | "gapClass" | "hideLabel"
>

/**
 * HeroUI checkbox-field с RHF.
 *
 * @param props Конфигурация.
 * @returns Поле для булевого ввода.
 */
export function FormCheckboxField<
    TFormValues extends FieldValues,
    TName extends FieldPath<TFormValues>,
>(props: IFormCheckboxFieldProps<TFormValues, TName>): ReactElement {
    return (
        <FormField
            {...props}
            gapClass="gap-1"
            hideLabel={true}
            showRequiredMarker={false}
            renderField={({
                field,
                hasError,
                accessibilityLabel,
                ariaDescribedBy,
            }): ReactElement => (
                <Checkbox
                    aria-describedby={ariaDescribedBy}
                    aria-label={accessibilityLabel}
                    aria-invalid={hasError}
                    isSelected={field.value === true}
                    name={field.name}
                    onChange={field.onChange}
                >
                    {props.label}
                </Checkbox>
            )}
        />
    )
}
