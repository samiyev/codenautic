import type { HTMLAttributes, ReactElement, ReactNode } from "react"
import {
    Modal as HeroUIModal,
    type ModalProps as HeroUIModalProps,
} from "@heroui/react"

/**
 * Совместимый с legacy API root-модальный компонент.
 */
export const Modal: typeof HeroUIModal = HeroUIModal

/**
 * Legacy `ModalContent` wrapper.
 */
export function ModalContent({
    children,
    ...props
}: Omit<HTMLAttributes<HTMLDivElement>, "children"> & { readonly children?: ReactNode }): ReactElement {
    return (
        <div className="max-h-[85vh] w-full overflow-hidden" {...props}>
            {children}
        </div>
    )
}

/**
 * Legacy `ModalHeader` wrapper.
 */
export function ModalHeader({
    children,
    ...props
}: Omit<HTMLAttributes<HTMLDivElement>, "children"> & { readonly children?: ReactNode }): ReactElement {
    return <div className="px-6 pt-6" {...props}>{children}</div>
}

/**
 * Legacy `ModalBody` wrapper.
 */
export function ModalBody({
    children,
    ...props
}: Omit<HTMLAttributes<HTMLDivElement>, "children"> & { readonly children?: ReactNode }): ReactElement {
    return (
        <div className="px-6 py-4" {...props}>
            {children}
        </div>
    )
}

/**
 * Legacy `ModalFooter` wrapper.
 */
export function ModalFooter({
    children,
    ...props
}: Omit<HTMLAttributes<HTMLDivElement>, "children"> & { readonly children?: ReactNode }): ReactElement {
    return (
        <div className="flex items-center justify-end gap-2 px-6 pb-6" {...props}>
            {children}
        </div>
    )
}

/**
 * Прозрачный fallback для старого экспорта `ModalBackdrop`.
 */
export function ModalBackdrop({ ...props }: Omit<HTMLAttributes<HTMLDivElement>, "children">): ReactElement {
    return <div {...props} />
}

export type ModalProps = HeroUIModalProps
export type ModalContentProps = Omit<HTMLAttributes<HTMLDivElement>, "children">
    & { readonly children?: ReactNode }
export type ModalHeaderProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
    readonly children?: ReactNode
}
export type ModalBodyProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & { readonly children?: ReactNode }
export type ModalFooterProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
    readonly children?: ReactNode
}
export type ModalBackdropProps = Omit<HTMLAttributes<HTMLDivElement>, "children">
