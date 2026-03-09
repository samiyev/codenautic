import { type ReactElement } from "react"
import { type FieldPath, type FieldValues } from "react-hook-form"
import { Select, SelectItem } from "@/components/ui"

import { FormField, type IFormFieldProps } from "./form-field"

/**
 * Возвращает выбранное значение из selection-структуры.
 *
 * @param keys Значение из onSelectionChange.
 * @returns Идентификатор выбранного пункта или undefined.
 */
function getSelectedValue(keys: unknown): string | undefined {
    if (keys === "all") {
        return undefined
    }

    if (isReadableSetOfString(keys) === false) {
        return undefined
    }

    const nextValue = keys.values().next().value
    return typeof nextValue === "string" ? nextValue : undefined
}

/**
 * Проверяет, является ли значение Set.
 *
 * @param value Проверяемое значение.
 * @returns True если значение — Set.
 */
function isReadableSetOfString(value: unknown): value is ReadonlySet<unknown> {
    return value instanceof Set
}

/**
 * Опция для form-select-field.
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
 * Свойства select-поля.
 */
export interface IFormSelectFieldProps<
    TFormValues extends FieldValues,
    TName extends FieldPath<TFormValues>,
> extends Omit<IFormFieldProps<TFormValues, TName>, "renderField" | "labelElement" | "gapClass"> {
    /** Список опций. */
    readonly options: ReadonlyArray<IFormSelectOption>
}

/**
 * HeroUI select-field с RHF.
 *
 * @param props Конфигурация поля.
 * @returns Выпадающий список с отображением ошибки/подсказки.
 */
export function FormSelectField<
    TFormValues extends FieldValues,
    TName extends FieldPath<TFormValues>,
>(props: IFormSelectFieldProps<TFormValues, TName>): ReactElement {
    const { options, ...fieldProps } = props

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
                const selectedKey = field.value === undefined ? undefined : String(field.value)
                const selectedKeys =
                    selectedKey === undefined ? new Set<string>() : new Set([selectedKey])

                return (
                    <Select
                        aria-describedby={ariaDescribedBy}
                        aria-label={accessibilityLabel}
                        aria-invalid={hasError}
                        name={field.name}
                        id={fieldId}
                        isInvalid={hasError}
                        selectedKeys={selectedKeys}
                        onSelectionChange={(keys): void => {
                            field.onChange(getSelectedValue(keys))
                        }}
                    >
                        {options.map((option): ReactElement => {
                            return (
                                <SelectItem
                                    key={option.value}
                                    isDisabled={option.isDisabled}
                                    id={option.value}
                                    value={option.value}
                                >
                                    <div className="flex flex-col">
                                        <span>{option.label}</span>
                                        {option.description === undefined ? null : (
                                            <span className="text-xs text-muted-foreground">
                                                {option.description}
                                            </span>
                                        )}
                                    </div>
                                </SelectItem>
                            )
                        })}
                    </Select>
                )
            }}
        />
    )
}
