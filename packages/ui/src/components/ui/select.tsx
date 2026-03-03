import type {SelectHTMLAttributes} from "react"
import {forwardRef} from "react"

import {cn} from "@/lib/utils"

export interface SelectOption {
    /** Значение опции. */
    value: string
    /** Читаемая метка. */
    label: string
    /** Заблокировано ли действие. */
    disabled?: boolean
}

export interface SelectProps
    extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
    /** Список опций. */
    options: SelectOption[]
    /** Текст плейсхолдера для пустого значения. */
    placeholder?: string
}

/**
 * Нативный select с единым визуальным языком кода.
 *
 * @param props - стандартные props и массив `options`
 * @returns select-элемент
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
    ({className, options, placeholder, ...properties}, ref) => {
        return (
            <select
                ref={ref}
                className={cn(
                    "bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] shadow-sm h-10 w-full rounded-md px-3 py-2 text-sm outline-none transition-colors",
                    "focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/30",
                    className,
                )}
                {...properties}
            >
                {placeholder !== undefined ? (
                    <option value="" disabled>
                        {placeholder}
                    </option>
                ) : null}
                {options.map((option) => (
                    <option
                        key={option.value}
                        value={option.value}
                        disabled={option.disabled}
                    >
                        {option.label}
                    </option>
                ))}
            </select>
        )
    },
)

Select.displayName = "Select"
