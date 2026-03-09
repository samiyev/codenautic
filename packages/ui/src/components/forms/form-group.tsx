import { type ReactElement, type ReactNode } from "react"

/**
 * Свойства группы полей формы.
 */
export interface IFormGroupProps {
    /** Содержимое группы (поля формы). */
    readonly children: ReactNode
    /** Показать разделитель после группы. */
    readonly withDivider?: boolean
}

/**
 * Группа связанных полей формы с опциональным divider.
 *
 * @param props Конфигурация группы.
 * @returns Группа полей формы.
 */
export function FormGroup(props: IFormGroupProps): ReactElement {
    return (
        <>
            <div className="space-y-3">{props.children}</div>
            {props.withDivider === true ? <hr className="border-border" /> : null}
        </>
    )
}
