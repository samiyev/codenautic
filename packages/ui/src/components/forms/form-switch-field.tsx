import { type ReactElement } from "react"
import { type FieldPath, type FieldValues } from "react-hook-form"
import { Switch } from "@/components/ui"

import { FormField, type IFormFieldProps } from "./form-field"

/**
 * Свойства switch-поля.
 */
export type IFormSwitchFieldProps<
    TFormValues extends FieldValues,
    TName extends FieldPath<TFormValues>,
> = Omit<
    IFormFieldProps<TFormValues, TName>,
    "renderField" | "labelElement" | "gapClass" | "hideLabel"
>

/**
 * HeroUI switch-field с RHF.
 *
 * @param props Конфигурация.
 * @returns Поле переключателя.
 */
export function FormSwitchField<
    TFormValues extends FieldValues,
    TName extends FieldPath<TFormValues>,
>(props: IFormSwitchFieldProps<TFormValues, TName>): ReactElement {
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
                <Switch
                    aria-describedby={ariaDescribedBy}
                    aria-label={accessibilityLabel}
                    aria-invalid={hasError}
                    name={field.name}
                    isInvalid={hasError}
                    isSelected={field.value === true}
                    onValueChange={field.onChange}
                >
                    {props.label}
                </Switch>
            )}
        />
    )
}
