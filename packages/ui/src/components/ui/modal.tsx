import type { ComponentProps, ReactElement, ReactNode } from "react"
import {
    Modal as HeroUIModal,
    type ModalBodyProps as HeroUIModalBodyProps,
    type ModalBackdropProps as HeroUIModalBackdropProps,
    type ModalDialogProps as HeroUIModalDialogProps,
    type ModalFooterProps as HeroUIModalFooterProps,
    type ModalHeaderProps as HeroUIModalHeaderProps,
    type ModalProps as HeroUIModalProps,
    type ModalRootProps as HeroUIModalRootProps,
} from "@heroui/react"

/**
 * Adapter HeroUI Modal wrapper.
 *
 * Value-add over raw HeroUI Modal:
 * - Re-exports HeroUI Modal as-is for `<Modal isOpen onOpenChange>` API.
 * - Provides `ModalContent` that composes Backdrop → Container → Dialog internally,
 *   matching the legacy single-wrapper pattern (`<ModalContent>children</ModalContent>`)
 *   instead of requiring three nested HeroUI sub-components.
 * - `ModalHeader`, `ModalBody`, `ModalFooter`, `ModalBackdrop` — thin passthrough wrappers
 *   that accept `readonly children` (legacy compat) and delegate to HeroUI sub-components.
 */
export const Modal = HeroUIModal

/**
 * Legacy `ModalContent` wrapper.
 * Composes HeroUI Backdrop + Container + Dialog into a single component.
 */
export function ModalContent(
    props: Omit<HeroUIModalDialogProps, "children"> & {
        readonly children?: ReactNode
    },
): ReactElement {
    const { children, ...dialogProps } = props

    return (
        <HeroUIModal.Backdrop>
            <HeroUIModal.Container>
                <HeroUIModal.Dialog {...dialogProps}>{children}</HeroUIModal.Dialog>
            </HeroUIModal.Container>
        </HeroUIModal.Backdrop>
    )
}

/**
 * Legacy `ModalHeader` wrapper.
 */
export function ModalHeader({
    children,
    ...props
}: Omit<HeroUIModalHeaderProps, "children"> & { readonly children?: ReactNode }): ReactElement {
    return <HeroUIModal.Header {...props}>{children}</HeroUIModal.Header>
}

/**
 * Legacy `ModalBody` wrapper.
 */
export function ModalBody({
    children,
    ...props
}: Omit<HeroUIModalBodyProps, "children"> & { readonly children?: ReactNode }): ReactElement {
    return <HeroUIModal.Body {...props}>{children}</HeroUIModal.Body>
}

/**
 * Legacy `ModalFooter` wrapper.
 */
export function ModalFooter({
    children,
    ...props
}: Omit<HeroUIModalFooterProps, "children"> & { readonly children?: ReactNode }): ReactElement {
    return <HeroUIModal.Footer {...props}>{children}</HeroUIModal.Footer>
}

/**
 * Прозрачный fallback для старого экспорта `ModalBackdrop`.
 */
export function ModalBackdrop(props: ComponentProps<typeof HeroUIModal.Backdrop>): ReactElement {
    return <HeroUIModal.Backdrop {...props} />
}

export type ModalProps = HeroUIModalProps
export type ModalContentProps = Omit<HeroUIModalDialogProps, "children"> & {
    readonly children?: ReactNode
}
export type ModalHeaderProps = Omit<HeroUIModalHeaderProps, "children"> & {
    readonly children?: ReactNode
}
export type ModalBodyProps = Omit<HeroUIModalBodyProps, "children"> & {
    readonly children?: ReactNode
}
export type ModalFooterProps = Omit<HeroUIModalFooterProps, "children"> & {
    readonly children?: ReactNode
}
export type ModalBackdropProps = HeroUIModalBackdropProps
export type ModalRootProps = HeroUIModalRootProps
