import { type ReactElement } from "react"
import { type FieldPath, type FieldValues } from "react-hook-form"
import { Radio, RadioGroup } from "@/components/ui"

import { FormField, type IFormFieldProps } from "./form-field"

/**
 * Опция для radio-group.
 */
export interface IFormRadioOption {
    /** Значение радиокнопки. */
    readonly value: string
    /** Отображаемый текст. */
    readonly label: string
    /** Отключена ли опция. */
    readonly isDisabled?: boolean
}

/**
 * Свойства radio-group поля.
 */
export interface IFormRadioGroupFieldProps<
    TFormValues extends FieldValues,
    TName extends FieldPath<TFormValues>,
> extends Omit<IFormFieldProps<TFormValues, TName>, "renderField" | "gapClass"> {
    /** Набор опций. */
    readonly options: ReadonlyArray<IFormRadioOption>
}

/**
 * HeroUI radio-group field с RHF.
 *
 * @param props Конфигурация.
 * @returns Переключатель опций.
 */
export function FormRadioGroupField<
    TFormValues extends FieldValues,
    TName extends FieldPath<TFormValues>,
>(props: IFormRadioGroupFieldProps<TFormValues, TName>): ReactElement {
    const { options, ...fieldProps } = props

    return (
        <FormField
            {...fieldProps}
            labelElement="span"
            renderField={({
                field,
                hasError,
                accessibilityLabel,
                ariaDescribedBy,
            }): ReactElement => (
                <RadioGroup
                    aria-describedby={ariaDescribedBy}
                    aria-label={accessibilityLabel}
                    aria-invalid={hasError}
                    isInvalid={hasError}
                    name={field.name}
                    value={field.value ?? ""}
                    onValueChange={(value: string): void => {
                        field.onChange(value)
                    }}
                >
                    {options.map((option): ReactElement => {
                        return (
                            <Radio
                                key={option.value}
                                isDisabled={option.isDisabled}
                                value={option.value}
                            >
                                {option.label}
                            </Radio>
                        )
                    })}
                </RadioGroup>
            )}
        />
    )
}
