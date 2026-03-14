import { type ChangeEvent, type ReactElement } from "react"
import { type FieldPath, type FieldValues } from "react-hook-form"
import { TextArea as Textarea, type TextAreaProps as TextareaProps } from "@heroui/react"

import { FormField, type IFormFieldProps } from "./form-field"

/**
 * Свойства textarea-поля.
 */
export interface IFormTextareaFieldProps<
    TFormValues extends FieldValues,
    TName extends FieldPath<TFormValues>,
> extends Omit<IFormFieldProps<TFormValues, TName>, "renderField" | "labelElement" | "gapClass"> {
    /** Пропсы HeroUI Textarea без значений/обработчиков. */
    readonly textareaProps?: Omit<
        TextareaProps,
        "name" | "value" | "defaultValue" | "onChange" | "onBlur"
    >
}

/**
 * HeroUI Textarea-обвязка для react-hook-form.
 *
 * @param props Конфигурация textarea.
 * @returns Текстовая область с поддержкой ошибок и описаний.
 */
export function FormTextareaField<
    TFormValues extends FieldValues,
    TName extends FieldPath<TFormValues>,
>(props: IFormTextareaFieldProps<TFormValues, TName>): ReactElement {
    const { textareaProps, ...fieldProps } = props

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
                const value = field.value === undefined ? "" : field.value

                return (
                    <Textarea
                        aria-describedby={ariaDescribedBy}
                        aria-label={accessibilityLabel}
                        aria-invalid={hasError}
                        id={fieldId}
                        name={field.name}
                        value={value}
                        onBlur={field.onBlur}
                        onChange={(event: ChangeEvent<HTMLTextAreaElement>): void => {
                            field.onChange(event.target.value)
                        }}
                        {...textareaProps}
                    />
                )
            }}
        />
    )
}
