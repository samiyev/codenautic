import type { ComponentProps, ReactElement, HTMLAttributes, ReactNode } from "react"
import { Modal } from "@heroui/react"

/**
 * Совместимый с legacy Drawer root.
 *
 * @param props Свойства модального слоя.
 * @returns Блок Drawer.
 */
export const Drawer: typeof Modal = Modal

/**
 * Обёртка для содержимого Drawer.
 */
export function DrawerContent({
    children,
    className,
    ...props
}: Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
    readonly children?: ReactNode
    readonly className?: string
}): ReactElement {
    return (
        <div className={className} {...props}>
            {children}
        </div>
    )
}

/**
 * Заголовок Drawer.
 */
export function DrawerHeader({
    children,
    ...props
}: ComponentProps<"div">): ReactElement {
    return (
        <div className="px-4 py-3" {...props}>
            {children}
        </div>
    )
}

/**
 * Тело Drawer.
 */
export function DrawerBody({
    children,
    ...props
}: ComponentProps<"div">): ReactElement {
    return (
        <div className="flex-1 overflow-y-auto" {...props}>
            {children}
        </div>
    )
}

export type DrawerProps = ComponentProps<typeof Modal>
export type DrawerContentProps = ComponentProps<"div">
