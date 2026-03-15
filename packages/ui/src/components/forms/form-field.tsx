import { type ReactElement, type ReactNode } from "react"
import {
    Controller,
    type Control,
    type ControllerFieldState,
    type ControllerProps,
    type ControllerRenderProps,
    type FieldPath,
    type FieldValues,
} from "react-hook-form"

import { TYPOGRAPHY } from "@/lib/constants/typography"

/**
 * Опция для select-поля.
 */
export interface IFormSelectOption {
    /** Значение опции. */
    readonly value: string
    /** Лейбл опции. */
    readonly label: string
    /** Дополнительный подпоясняющий текст. */
    readonly description?: string
    /** Блокирован ли выбор пункта. */
    readonly isDisabled?: boolean
}

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
 * Утилита для выбора текста ошибки или helper-текста.
 *
 * @param errorMessage Сообщение ошибки.
 * @param helperText Текст-подсказка.
 * @returns Актуальный текст для снизу у поля.
 */
function pickFieldMessage(
    errorMessage: string | undefined,
    helperText: string | undefined,
): ReactNode | null {
    if (errorMessage !== undefined && errorMessage !== "") {
        return (
            <p className="text-xs text-danger" role="alert">
                {errorMessage}
            </p>
        )
    }

    if (helperText === undefined || helperText === "") {
        return null
    }

    return <p className="text-xs text-muted">{helperText}</p>
}

/**
 * Правила валидации для generic form field.
 */
export type TFormFieldRules<
    TFormValues extends FieldValues,
    TName extends FieldPath<TFormValues>,
> = Omit<ControllerProps<TFormValues, TName>, "render" | "name" | "control">["rules"]

/**
 * Контекст, передаваемый в renderField для отрисовки конкретного input-элемента.
 */
export interface IFormFieldRenderContext<
    TFormValues extends FieldValues,
    TName extends FieldPath<TFormValues>,
> {
    /** RHF-поле с value, onChange, onBlur, name. */
    readonly field: ControllerRenderProps<TFormValues, TName>
    /** Состояние поля (ошибки). */
    readonly fieldState: ControllerFieldState
    /** Есть ли ошибка валидации. */
    readonly hasError: boolean
    /** Текст ошибки, если есть. */
    readonly errorMessage: string | undefined
    /** Вычисленный id для поля. */
    readonly fieldId: string
    /** aria-describedby для связи с helper-текстом. */
    readonly ariaDescribedBy: string | undefined
    /** aria-label для доступности. */
    readonly accessibilityLabel: string
}

/**
 * Свойства generic form field.
 */
export interface IFormFieldProps<
    TFormValues extends FieldValues,
    TName extends FieldPath<TFormValues>,
> {
    /** Контроллер формы. */
    readonly control: Control<TFormValues>
    /** Имя поля в форме. */
    readonly name: TName
    /** Заголовок поля. */
    readonly label?: string
    /** Подсказка под полем. */
    readonly helperText?: string
    /** Правила валидации. */
    readonly rules?: TFormFieldRules<TFormValues, TName>
    /** Идентификатор для accessibility. */
    readonly id?: string
    /** Показывать маркер обязательного поля. */
    readonly showRequiredMarker?: boolean
    /** HTML-элемент для label (label или span). */
    readonly labelElement?: "label" | "span"
    /** CSS-класс для gap между элементами. */
    readonly gapClass?: string
    /** Скрыть рендеринг label-элемента (label передаётся только в aria). */
    readonly hideLabel?: boolean
    /** Рендер-функция для конкретного input-элемента. */
    readonly renderField: (context: IFormFieldRenderContext<TFormValues, TName>) => ReactNode
}

/**
 * Generic form field с Controller, label, helper-текстом и aria-атрибутами.
 *
 * @param props Конфигурация поля.
 * @returns Поле формы с валидацией.
 */
export function FormField<TFormValues extends FieldValues, TName extends FieldPath<TFormValues>>(
    props: IFormFieldProps<TFormValues, TName>,
): ReactElement {
    const fieldId = props.id ?? String(props.name)
    const showRequiredMarker = props.showRequiredMarker ?? props.rules?.required !== undefined
    const LabelElement = props.labelElement ?? "label"
    const gapClass = props.gapClass ?? "gap-1.5"

    return (
        <Controller
            control={props.control}
            name={props.name}
            rules={props.rules}
            render={({ field, fieldState }): ReactElement => {
                const rawErrorMessage = fieldState.error?.message
                const errorMessage =
                    typeof rawErrorMessage === "string" ? rawErrorMessage : undefined
                const hasError = errorMessage !== undefined
                const helperId = `${fieldId}-helper`
                const ariaDescribedBy =
                    hasError || props.helperText !== undefined ? helperId : undefined
                const accessibilityLabel = props.label ?? String(props.name)

                return (
                    <div className={`flex flex-col ${gapClass}`}>
                        {props.label === undefined || props.hideLabel === true ? null : (
                            <LabelElement
                                className={TYPOGRAPHY.label}
                                htmlFor={LabelElement === "label" ? fieldId : undefined}
                            >
                                {props.label}
                                {showRequiredMarker ? <span aria-hidden="true"> *</span> : null}
                            </LabelElement>
                        )}
                        {props.renderField({
                            accessibilityLabel,
                            ariaDescribedBy,
                            errorMessage,
                            field,
                            fieldId,
                            fieldState,
                            hasError,
                        })}
                        <span id={helperId}>
                            {pickFieldMessage(errorMessage, props.helperText)}
                        </span>
                    </div>
                )
            }}
        />
    )
}
