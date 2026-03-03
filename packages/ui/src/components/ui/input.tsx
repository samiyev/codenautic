import type {InputHTMLAttributes, ReactNode} from "react"
import {forwardRef} from "react"

import {cn} from "@/lib/utils"

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    /**
     * Дополнительный текст ошибки для aria-валидации.
     */
    errorText?: ReactNode
}

/**
 * Базовый input с поддержкой состояния invalid и стилизацией по теме.
 *
 * @param props - стандартные props для `input`
 * @returns input-элемент
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({className, errorText, ...properties}, ref) => {
        const isInvalid =
            properties["aria-invalid"] === "true" || properties["aria-invalid"] === true

        const finalClassName = cn(
            "bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] shadow-sm inline-flex h-10 w-full rounded-md px-3 py-2 text-sm outline-none placeholder:text-slate-500 transition-colors",
            "focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/30",
            isInvalid === true && "border-[var(--danger)] focus:border-[var(--danger)] focus:ring-[var(--danger)]/30",
            className,
        )

        return (
            <div className="w-full">
                <input
                    ref={ref}
                    className={finalClassName}
                    aria-invalid={
                        isInvalid === true || properties["aria-invalid"] === "true" || properties["aria-invalid"] === true
                    }
                    {...properties}
                />
                {errorText !== undefined && errorText !== null ? (
                    <p className="mt-1 text-xs text-[var(--danger)]" role="alert">
                        {errorText}
                    </p>
                ) : null}
            </div>
        )
    },
)

Input.displayName = "Input"
