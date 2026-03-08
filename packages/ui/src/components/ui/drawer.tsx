import type { ComponentProps, ReactElement, ReactNode } from "react"
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
}: Omit<ComponentProps<typeof Modal.Dialog>, "children"> & {
    readonly children?: ReactNode
    readonly className?: string
}): ReactElement {
    return (
        <Modal.Backdrop>
            <Modal.Container className="!items-stretch !justify-start !p-0">
                <Modal.Dialog className={className} {...props}>
                    {children}
                </Modal.Dialog>
            </Modal.Container>
        </Modal.Backdrop>
    )
}

/**
 * Заголовок Drawer.
 */
export function DrawerHeader({ children, ...props }: ComponentProps<"div">): ReactElement {
    return (
        <div className="px-4 py-3" {...props}>
            {children}
        </div>
    )
}

/**
 * Тело Drawer.
 */
export function DrawerBody({ children, ...props }: ComponentProps<"div">): ReactElement {
    return (
        <div className="flex-1 overflow-y-auto" {...props}>
            {children}
        </div>
    )
}

export type DrawerProps = ComponentProps<typeof Modal>
export type DrawerContentProps = ComponentProps<"div">
