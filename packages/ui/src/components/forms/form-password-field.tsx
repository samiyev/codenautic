import { type ReactElement, useState } from "react"
import { type FieldPath, type FieldValues } from "react-hook-form"
import { Button, Input } from "@heroui/react"
import { Eye, EyeOff } from "@/components/icons/app-icons"

import { FormField, type IFormFieldProps } from "./form-field"

/**
 * Свойства password-поля.
 */
export type IFormPasswordFieldProps<
    TFormValues extends FieldValues,
    TName extends FieldPath<TFormValues>,
> = Omit<IFormFieldProps<TFormValues, TName>, "renderField" | "labelElement" | "gapClass">

/**
 * HeroUI password field с локальным переключением видимости.
 *
 * @param props Конфигурация поля.
 * @returns Поле для ввода пароля.
 */
export function FormPasswordField<
    TFormValues extends FieldValues,
    TName extends FieldPath<TFormValues>,
>(props: IFormPasswordFieldProps<TFormValues, TName>): ReactElement {
    const [isPasswordVisible, setIsPasswordVisible] = useState(false)

    return (
        <FormField
            {...props}
            renderField={({
                field,
                hasError,
                fieldId,
                accessibilityLabel,
                ariaDescribedBy,
            }): ReactElement => {
                const value = field.value === undefined ? "" : field.value

                return (
                    <div className="relative">
                        <Input
                            aria-describedby={ariaDescribedBy}
                            aria-label={accessibilityLabel}
                            aria-invalid={hasError}
                            className="pe-10"
                            id={fieldId}
                            minLength={8}
                            name={field.name}
                            placeholder="••••••••"
                            type={isPasswordVisible ? "text" : "password"}
                            value={value}
                            onBlur={field.onBlur}
                            onChange={field.onChange}
                        />
                        <Button
                            aria-label={
                                isPasswordVisible ? "Hide password text" : "Show password text"
                            }
                            className="absolute right-1 top-1/2 -translate-y-1/2"
                            isIconOnly
                            size="sm"
                            variant="ghost"
                            onPress={(): void => {
                                setIsPasswordVisible(
                                    (previousValue: boolean): boolean => !previousValue,
                                )
                            }}
                        >
                            {isPasswordVisible ? <Eye size={16} /> : <EyeOff size={16} />}
                        </Button>
                    </div>
                )
            }}
        />
    )
}
