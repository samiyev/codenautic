import { type ReactElement } from "react"

/**
 * Свойства brand mark компонента.
 */
export interface IBrandMarkProps {
    /** Компактный режим (collapsed sidebar). */
    readonly isCompact?: boolean
}

/**
 * Brand mark для sidebar header.
 * Compact mode: logo only. Expanded: logo + product name.
 *
 * @param props Конфигурация brand mark.
 * @returns Brand mark.
 */
export function BrandMark(props: IBrandMarkProps): ReactElement {
    const isCompact = props.isCompact === true

    return (
        <div className="flex items-center gap-2 px-1 py-1">
            <div className="brand-mark-logo relative flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-primary">
                <span className="text-xs font-bold text-primary-foreground">CN</span>
            </div>
            {isCompact !== true ? (
                <span className="font-display text-sm font-semibold tracking-tight text-foreground">
                    CodeNautic
                </span>
            ) : null}
        </div>
    )
}
