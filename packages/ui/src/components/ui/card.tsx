import type {ReactNode} from "react"
import {forwardRef} from "react"

import {cn} from "@/lib/utils"

export interface CardProps {
    /** Контент карточки. */
    children: ReactNode
    /** Доп. классы. */
    className?: string
}

/**
 * Базовый контейнер-карточка с фоном и границей.
 *
 * @param props - props карточки
 * @returns карточка
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
    ({children, className}, ref) => {
        return (
            <section
                ref={ref}
                className={cn(
                    "rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm",
                    className,
                )}
            >
                {children}
            </section>
        )
    },
)

Card.displayName = "Card"

export interface CardHeaderProps {
    /** Заголовок карточки. */
    title: string
    /** Подзаголовок (опционально). */
    subtitle?: string
}

/**
 * Заголовок карточки.
 */
export function CardHeader({title, subtitle}: CardHeaderProps): ReactNode {
    return (
        <header className="mb-4 border-b border-[var(--border)] pb-3">
            <h3 className="text-lg font-semibold text-[var(--foreground)]">{title}</h3>
            {subtitle !== undefined ? (
                <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
            ) : null}
        </header>
    )
}
