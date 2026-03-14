import type { ReactElement, ReactNode } from "react"

import { BrandMark } from "./brand-mark"
import { SidebarNav } from "./sidebar-nav"

/**
 * Sidebar component props.
 */
export interface ISidebarProps {
    /** Additional class for the container. */
    readonly className?: string
    /** Navigation block title. */
    readonly title?: string
    /** Whether the sidebar is collapsed. */
    readonly isCollapsed?: boolean
    /** Content before main menu. */
    readonly headerSlot?: ReactNode
    /** Content at the bottom of the sidebar (org switcher, user menu). */
    readonly footerSlot?: ReactNode
    /** Callback when a nav item is selected (close mobile sidebar). */
    readonly onNavigate?: (to?: string) => void
}

/**
 * Full-height sidebar with brand, scrollable navigation, and footer slot.
 * Supports collapse animation between expanded (240px) and compact (48px) modes.
 *
 * @param props Configuration.
 * @returns Full-height sidebar navigation.
 */
export function Sidebar(props: ISidebarProps): ReactElement {
    const isCollapsed = props.isCollapsed === true

    return (
        <aside
            className={`flex h-full w-60 flex-col overflow-hidden border-r border-border/50 bg-sidebar-bg px-2 py-2 ${props.className ?? ""}`}
        >
            <div className="mb-1 flex items-center">
                <BrandMark isCompact={isCollapsed} />
            </div>
            {props.headerSlot !== undefined ? (
                <div className="mb-1.5 px-1">{props.headerSlot}</div>
            ) : null}
            <div className="min-h-0 flex-1">
                <SidebarNav isCollapsed={isCollapsed} onNavigate={props.onNavigate} />
            </div>
            {props.footerSlot !== undefined ? props.footerSlot : null}
        </aside>
    )
}
