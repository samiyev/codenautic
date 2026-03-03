import {
    type MouseEvent,
    type ReactNode,
    type KeyboardEvent,
    useId,
    useMemo,
    useRef,
    useState,
} from "react"

import {cn} from "@/lib/utils"

export interface TabItem {
    /** Уникальный key вкладки. */
    value: string
    /** Метка вкладки. */
    label: ReactNode
    /** Контент вкладки. */
    content: ReactNode
    /** Блокирует доступную вкладку. */
    disabled?: boolean
}

export interface TabsProps {
    /** Список вкладок. */
    items: TabItem[]
    /** Значение по умолчанию. */
    defaultValue?: string
    /** Контролируемое значение. */
    value?: string
    /** Обработчик смены таба. */
    onValueChange?: (value: string) => void
    /** Классы. */
    className?: string
}

/**
 * Доступный Tab-компонент без внешних UI-зависимостей.
 *
 * @param props - список вкладок и поведение
 * @returns Tabs
 */
export function Tabs({
    items,
    defaultValue,
    value,
    onValueChange,
    className,
}: TabsProps): ReactNode {
    const fallbackValue = useMemo(() => {
        const firstActive = items.find((item) => item.disabled !== true)
        return firstActive?.value ?? items[0]?.value
    }, [items])

    const [internalValue, setInternalValue] = useState(defaultValue ?? fallbackValue)
    const currentValue = value ?? internalValue
    const listId = useId()
    const panelId = useId()

    const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
    const isControlled = value !== undefined

    const updateValue = (nextValue: string): void => {
        if (isControlled === false) {
            setInternalValue(nextValue)
        }

        onValueChange?.(nextValue)
    }

    const handleTabKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
        const activeIndex = items.findIndex((item) => item.value === currentValue)
        if (activeIndex === -1) {
            return
        }

        if (event.key === "ArrowRight") {
            event.preventDefault()
            const nextIndex = (activeIndex + 1) % items.length
            const nextItem = items[nextIndex]
            if (nextItem.disabled !== true && nextItem.value !== currentValue) {
                updateValue(nextItem.value)
                tabRefs.current[nextIndex]?.focus()
            }
            return
        }

        if (event.key === "ArrowLeft") {
            event.preventDefault()
            const previousIndex = (activeIndex - 1 + items.length) % items.length
            const previousItem = items[previousIndex]
            if (previousItem.disabled !== true && previousItem.value !== currentValue) {
                updateValue(previousItem.value)
                tabRefs.current[previousIndex]?.focus()
            }
            return
        }

        if (event.key === "Home") {
            event.preventDefault()
            const firstEnabled = items.findIndex((item) => item.disabled !== true)
            if (firstEnabled !== -1) {
                updateValue(items[firstEnabled].value)
                tabRefs.current[firstEnabled]?.focus()
            }
            return
        }

        if (event.key === "End") {
            event.preventDefault()
            const reversedIndex = [...items].reverse().findIndex((item) => item.disabled !== true)
            if (reversedIndex !== -1) {
                const targetIndex = items.length - 1 - reversedIndex
                updateValue(items[targetIndex].value)
                tabRefs.current[targetIndex]?.focus()
            }
            return
        }

        if (event.key === "Tab") {
            return
        }
    }

    const selectedItem = items.find((item) => item.value === currentValue) ?? items[0]

    return (
        <div className={cn("w-full", className)}>
            <div
                id={listId}
                role="tablist"
                aria-orientation="horizontal"
                className="inline-flex rounded-md border border-[var(--border)] bg-[var(--surface-muted)] p-1"
                onKeyDown={handleTabKeyDown}
            >
                {items.map((item, index) => {
                    const isActive = item.value === currentValue
                    return (
                        <button
                            ref={(node) => {
                                tabRefs.current[index] = node
                            }}
                            key={item.value}
                            role="tab"
                            type="button"
                            aria-selected={isActive}
                            aria-controls={`${panelId}-${item.value}`}
                            disabled={item.disabled}
                            onClick={(event: MouseEvent<HTMLButtonElement>): void => {
                                event.preventDefault()
                                if (item.disabled !== true) {
                                    updateValue(item.value)
                                }
                            }}
                            className={cn(
                                "rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
                                isActive
                                    ? "bg-[var(--surface)] text-[var(--foreground)]"
                                    : "text-slate-500 hover:bg-[color-mix(in oklch,var(--surface-muted)_50%,var(--surface))]",
                                item.disabled === true && "cursor-not-allowed opacity-50",
                            )}
                        >
                            {item.label}
                        </button>
                    )
                })}
            </div>
            <section
                id={`${panelId}-${selectedItem?.value}`}
                role="tabpanel"
                aria-labelledby={`${listId}-${selectedItem?.value}`}
                className="mt-4"
            >
                {selectedItem !== undefined ? selectedItem.content : null}
            </section>
        </div>
    )
}
