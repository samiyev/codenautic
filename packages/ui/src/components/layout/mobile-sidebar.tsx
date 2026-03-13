import { Drawer, DrawerBody, DrawerContent, DrawerHeader } from "@/components/ui"

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
        <Drawer isOpen={props.isOpen} onOpenChange={props.onOpenChange}>
            <DrawerContent className="!m-0 !h-full !w-72 !rounded-none bg-surface text-foreground">
                <DrawerHeader className="border-b border-border px-4 py-3">
                    <p className={TYPOGRAPHY.overline}>
                        {props.title ?? t("navigation:sidebarNav.title")}
                    </p>
                </DrawerHeader>
                <DrawerBody>
                    <Sidebar
                        footerSlot={props.footerSlot}
                        onNavigate={(): void => {
                            props.onOpenChange(false)
                        }}
                    />
                </DrawerBody>
            </DrawerContent>
        </Drawer>
    )
}
