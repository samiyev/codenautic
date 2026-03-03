import {
    type KeyboardEvent,
    type MouseEvent,
    type ReactNode,
    useEffect,
    useRef,
    useState,
} from "react"

import {cn} from "@/lib/utils"

export interface DropdownItem {
    /** Уникальный идентификатор пункта. */
    value: string
    /** Метка пункта. */
    label: ReactNode
    /** Состояние disable. */
    disabled?: boolean
}

export interface DropdownProps {
    /** Кнопка-триггер. */
    trigger: ReactNode
    /** Набор действий. */
    items: DropdownItem[]
    /** Обработчик выбора. */
    onSelect: (value: string) => void
    /** Лейбл для menu для скринридеров. */
    ariaLabel?: string
    /** Класс контейнера. */
    className?: string
}

/**
 * Клавиатурно-дружественный dropdown с меню и фокус-менеджментом.
 *
 * @param props - props Dropdown
 * @returns menu-компонент
 */
export function Dropdown({
    trigger,
    items,
    onSelect,
    ariaLabel,
    className,
}: DropdownProps): ReactNode {
    const [isOpen, setIsOpen] = useState(false)
    const rootRef = useRef<HTMLDivElement>(null)
    const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

    useEffect(() => {
        const handleDocumentPointerDown = (event: globalThis.MouseEvent): void => {
            const root = rootRef.current
            const target = event.target
            if (root !== null && target !== null && root.contains(target as Node)) {
                return
            }

            setIsOpen(false)
        }

        if (isOpen === true) {
            document.addEventListener("mousedown", handleDocumentPointerDown)
            return () => {
                document.removeEventListener("mousedown", handleDocumentPointerDown)
            }
        }

        return undefined
    }, [isOpen])

    const openAndFocusFirst = (): void => {
        setIsOpen(true)
        const firstAvailable = itemRefs.current.find((item) => item !== null && item.disabled === false)
        firstAvailable?.focus()
    }

    const focusItemByOffset = (currentIndex: number, offset: number): void => {
        if (itemRefs.current.length === 0) {
            return
        }

        const totalItems = itemRefs.current.length
        let nextIndex = (currentIndex + offset + totalItems) % totalItems

        for (let attempt = 0; attempt < totalItems; attempt += 1) {
            const candidate = itemRefs.current[nextIndex]
            if (candidate !== null && candidate.disabled === false) {
                candidate.focus()
                return
            }

            nextIndex = (nextIndex + offset + totalItems) % totalItems
        }
    }

    const handleMenuKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
        if (event.key === "Escape") {
            setIsOpen(false)
            return
        }

        if (event.key === "ArrowDown") {
            event.preventDefault()
            focusItemByOffset(index, 1)
            return
        }

        if (event.key === "ArrowUp") {
            event.preventDefault()
            focusItemByOffset(index, -1)
            return
        }

        if (event.key === "Home") {
            event.preventDefault()
            focusItemByOffset(index, -index - 1)
            return
        }

        if (event.key === "End") {
            event.preventDefault()
            focusItemByOffset(index, itemRefs.current.length - index)
            return
        }

        if (event.key === "Tab") {
            setIsOpen(false)
        }
    }

    const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
        if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            openAndFocusFirst()
        }
    }

    const handleItemClick = (value: string): void => {
        onSelect(value)
        setIsOpen(false)
    }

    return (
        <div ref={rootRef} className={cn("relative inline-flex", className)}>
            <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={isOpen}
                onClick={(): void => {
                    setIsOpen((previous) => !previous)
                }}
                onKeyDown={handleTriggerKeyDown}
                className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 text-sm text-[var(--foreground)] transition hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
                {trigger}
            </button>
            <ul
                role="menu"
                aria-label={ariaLabel}
                className={cn(
                    "absolute right-0 top-full z-30 mt-2 min-w-44 rounded-md border border-[var(--border)] bg-[var(--surface)] p-1 shadow-lg",
                    isOpen !== true ? "hidden" : "flex flex-col",
                )}
            >
                {items.map((item, index) => {
                    const isDisabled = item.disabled === true
                    return (
                        <li key={item.value} role="none">
                            <button
                                ref={(node) => {
                                    itemRefs.current[index] = node
                                }}
                                type="button"
                                role="menuitem"
                                disabled={isDisabled}
                                onKeyDown={(event) => {
                                    handleMenuKeyDown(event, index)
                                }}
                                onClick={(event: MouseEvent<HTMLButtonElement>): void => {
                                    event.stopPropagation()
                                    if (isDisabled === true) {
                                        return
                                    }
                                    handleItemClick(item.value)
                                }}
                                className="w-full rounded-sm px-3 py-2 text-left text-sm text-[var(--foreground)] transition hover:bg-[var(--surface-muted)] focus-visible:bg-[var(--surface-muted)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {item.label}
                            </button>
                        </li>
                    )
                })}
            </ul>
        </div>
    )
}
