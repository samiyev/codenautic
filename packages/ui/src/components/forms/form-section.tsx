import { type ReactElement, type ReactNode } from "react"

import { TYPOGRAPHY } from "@/lib/constants/typography"

/**
 * Свойства секции формы.
 */
export interface IFormSectionProps {
    /** Заголовок секции. */
    readonly heading: string
    /** Описание секции (опционально). */
    readonly description?: string
    /** Содержимое секции (поля формы). */
    readonly children: ReactNode
}

/**
 * Секция формы с заголовком и описанием.
 * Группирует связанные поля с визуальным разделением.
 *
 * @param props Конфигурация секции.
 * @returns Обёрнутая секция формы.
 */
export function FormSection(props: IFormSectionProps): ReactElement {
    return (
        <section className="space-y-4">
            <div className="space-y-1">
                <h3 className={TYPOGRAPHY.sectionTitle}>{props.heading}</h3>
                {props.description !== undefined ? (
                    <p className={TYPOGRAPHY.bodyMuted}>{props.description}</p>
                ) : null}
            </div>
            <div className="space-y-3">{props.children}</div>
        </section>
    )
}
