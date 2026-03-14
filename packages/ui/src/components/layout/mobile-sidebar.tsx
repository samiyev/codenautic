import { Modal } from "@heroui/react"

import type { ReactElement, ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { TYPOGRAPHY } from "@/lib/constants/typography"

import { Sidebar } from "./sidebar"

/**
 * Mobile sidebar props.
 */
export interface IMobileSidebarProps {
    /** Whether the drawer is visible. */
    readonly isOpen: boolean
    /** Update drawer open state. */
    readonly onOpenChange: (isOpen: boolean) => void
    /** Navigation section title. */
    readonly title?: string
    /** Footer slot to pass through to Sidebar (org switcher, user menu). */
    readonly footerSlot?: ReactNode
}

/**
 * Drawer wrapper for mobile navigation.
 *
 * @param props Drawer configuration.
 * @returns Mobile sidebar with close-on-nav behavior.
 */
export function MobileSidebar(props: IMobileSidebarProps): ReactElement {
    const { t } = useTranslation(["navigation"])

    return (
        <Modal isOpen={props.isOpen} onOpenChange={props.onOpenChange}>
            <Modal.Backdrop>
                <Modal.Container className="!items-stretch !justify-start !p-0">
                    <Modal.Dialog className="!m-0 !h-full !w-72 !rounded-none bg-surface text-foreground">
                        <div className="px-4 py-3 border-b border-border">
                            <p className={TYPOGRAPHY.overline}>
                                {props.title ?? t("navigation:sidebarNav.title")}
                            </p>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            <Sidebar
                                footerSlot={props.footerSlot}
                                onNavigate={(): void => {
                                    props.onOpenChange(false)
                                }}
                            />
                        </div>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    )
}
