import type { ComponentProps, ReactNode, ReactElement } from "react"
import {
    ListBox,
    ListBoxItem,
    ListBoxSection,
    Select as HeroUISelect,
} from "@heroui/react"

/**
 * Свойства совместимого select с поддержкой старого API (`SelectItem`).
 */
export type SelectProps = Omit<ComponentProps<typeof HeroUISelect>, "children"> & {
    /** Дочерние элементы пунктов/секций. */
    readonly children?: ReactNode
}

/**
 * Свойства пункта select.
 */
export type SelectItemProps = ComponentProps<typeof ListBoxItem> & {
    /** Идентификатор пункта для `selectedKeys`. */
    readonly value?: string
}

/**
 * Свойства секции select.
 */
export type SelectSectionProps = ComponentProps<typeof ListBoxSection>

/**
 * Select-компонент с совместимым API.
 */
export function Select(props: SelectProps): ReactElement {
    const { children, ...selectProps } = props

    return (
        <HeroUISelect {...selectProps}>
            <HeroUISelect.Trigger>
                <HeroUISelect.Value />
            </HeroUISelect.Trigger>
            <HeroUISelect.Popover>
                <ListBox>{children}</ListBox>
            </HeroUISelect.Popover>
        </HeroUISelect>
    )
}

/**
 * Пункт выборки в совместимом Select.
 */
export function SelectItem(props: SelectItemProps): ReactElement {
    const { value, ...nextProps } = props
    const itemId = value ?? (nextProps as { readonly id?: string }).id

    return <ListBoxItem id={itemId} {...nextProps} />
}

/**
 * Секция выборки в совместимом Select.
 */
export function SelectSection(props: SelectSectionProps): ReactElement {
    return <ListBoxSection {...props} />
}
