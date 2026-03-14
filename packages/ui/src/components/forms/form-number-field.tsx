import { type ChangeEvent, type ReactElement } from "react"
import { type FieldPath, type FieldValues } from "react-hook-form"
import { Input, type InputProps } from "@heroui/react"

import { FormField, type IFormFieldProps } from "./form-field"

/**
 * Свойства числового поля.
 */
export interface IFormNumberFieldProps<
    TFormValues extends FieldValues,
    TName extends FieldPath<TFormValues>,
> extends Omit<IFormFieldProps<TFormValues, TName>, "renderField" | "labelElement" | "gapClass"> {
    /** Пропсы HeroUI Input без value/onChange. */
    readonly inputProps?: Omit<
        InputProps,
        "name" | "value" | "defaultValue" | "onChange" | "onBlur"
    >
}

/**
 * HeroUI Input Number field через react-hook-form.
 *
 * @param props Конфигурация поля.
 * @returns Поле ввода числа с контролем ошибки.
 */
export function FormNumberField<
    TFormValues extends FieldValues,
    TName extends FieldPath<TFormValues>,
>(props: IFormNumberFieldProps<TFormValues, TName>): ReactElement {
    const { inputProps, ...fieldProps } = props

    return (
        <FormField
            {...fieldProps}
            renderField={({
                field,
                hasError,
                fieldId,
                accessibilityLabel,
                ariaDescribedBy,
            }): ReactElement => {
                const value = field.value === undefined ? "" : String(field.value)

                return (
                    <Input
                        aria-describedby={ariaDescribedBy}
                        aria-label={accessibilityLabel}
                        aria-invalid={hasError}
                        id={fieldId}
                        inputMode="decimal"
                        name={field.name}
                        placeholder="0"
                        type="number"
                        value={value}
                        onBlur={field.onBlur}
                        onChange={(event: ChangeEvent<HTMLInputElement>): void => {
                            const nextValue = event.target.value

                            if (nextValue === "") {
                                field.onChange(undefined)
                                return
                            }

                            const parsedNumber = Number(nextValue)
                            if (Number.isNaN(parsedNumber) === true) {
                                field.onChange(undefined)
                                return
                            }

                            field.onChange(parsedNumber)
                        }}
                        {...inputProps}
                    />
                )
            }}
        />
    )
}
