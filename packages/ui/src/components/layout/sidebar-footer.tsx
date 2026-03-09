import { type ReactElement } from "react"

import { Building2, ChevronDown } from "@/components/icons/app-icons"
import {
    Avatar,
    Button,
    Dropdown,
    DropdownItem,
    DropdownMenu,
    DropdownTrigger,
} from "@/components/ui"

/**
 * Organization option for workspace switcher.
 */
export interface ISidebarOrganizationOption {
    /** Organization/tenant identifier. */
    readonly id: string
    /** Display label in selector. */
    readonly label: string
}

/**
 * Props for the sidebar footer area with workspace and user controls.
 */
export interface ISidebarFooterProps {
    /** Available tenant/workspace options. */
    readonly organizations?: ReadonlyArray<ISidebarOrganizationOption>
    /** Active organization ID. */
    readonly activeOrganizationId?: string
    /** Organization change handler. */
    readonly onOrganizationChange?: (organizationId: string) => void
    /** User name. */
    readonly userName?: string
    /** User email. */
    readonly userEmail?: string
    /** Sign out action. */
    readonly onSignOut?: () => void
    /** Open Settings page. */
    readonly onOpenSettings?: () => void
    /** Open Billing page. */
    readonly onOpenBilling?: () => void
    /** Open Help & Diagnostics page. */
    readonly onOpenHelp?: () => void
    /** Whether sidebar is in collapsed (icon-only) mode. */
    readonly isCollapsed?: boolean
}

/**
 * Sidebar footer with workspace switcher and user avatar.
 * Renders compact (icon-only) or expanded depending on sidebar state.
 *
 * @param props Footer configuration.
 * @returns Sidebar footer element.
 */
export function SidebarFooter(props: ISidebarFooterProps): ReactElement {
    const isCollapsed = props.isCollapsed === true

    const activeOrganization = props.organizations?.find(
        (organization): boolean =>
            organization.id === props.activeOrganizationId,
    )

    const initials =
        props.userName !== undefined
            ? props.userName.slice(0, 2).toUpperCase()
            : "CN"

    return (
        <div className="mt-auto border-t border-border pt-2">
            {/* Workspace switcher */}
            {props.organizations !== undefined ? (
                <Dropdown>
                    <DropdownTrigger
                        className={`w-full justify-start gap-2 px-2 ${isCollapsed ? "min-w-0" : ""}`}
                        size="sm"
                        variant="light"
                    >
                        <span className="inline-flex items-center gap-2 truncate">
                            <Building2
                                aria-hidden="true"
                                className="shrink-0 text-text-subtle"
                                size={15}
                            />
                            {isCollapsed ? null : (
                                <>
                                    <span className="truncate text-sm text-foreground">
                                        {activeOrganization?.label ??
                                            "Workspace"}
                                    </span>
                                    <ChevronDown
                                        aria-hidden="true"
                                        className="shrink-0 text-text-subtle"
                                        size={14}
                                    />
                                </>
                            )}
                        </span>
                    </DropdownTrigger>
                    <DropdownMenu
                        aria-label="Workspace switcher"
                        selectedKeys={
                            props.activeOrganizationId !== undefined
                                ? new Set([props.activeOrganizationId])
                                : new Set<string>()
                        }
                        selectionMode="single"
                        onSelectionChange={(keys): void => {
                            const selected = [...keys][0]
                            if (typeof selected === "string") {
                                props.onOrganizationChange?.(selected)
                            }
                        }}
                    >
                        {props.organizations.map(
                            (organization): ReactElement => (
                                <DropdownItem key={organization.id}>
                                    {organization.label}
                                </DropdownItem>
                            ),
                        )}
                    </DropdownMenu>
                </Dropdown>
            ) : null}

            {/* User avatar + menu */}
            <Dropdown>
                <DropdownTrigger
                    className={`w-full justify-start gap-2 px-2 ${isCollapsed ? "min-w-0" : ""}`}
                    size="sm"
                    variant="light"
                >
                    <span className="inline-flex items-center gap-2 truncate">
                        <Avatar
                            className="shrink-0"
                            label={props.userName ?? "User"}
                            size="sm"
                        />
                        {isCollapsed ? null : (
                            <span className="truncate text-sm text-foreground">
                                {props.userName ?? "User"}
                            </span>
                        )}
                        <span className="sr-only">{initials}</span>
                    </span>
                </DropdownTrigger>
                <DropdownMenu aria-label="User menu">
                    <DropdownItem key="name">
                        {props.userName ?? "User"}
                    </DropdownItem>
                    <DropdownItem key="email">
                        {props.userEmail ?? "user@example.com"}
                    </DropdownItem>
                    <DropdownItem
                        key="settings"
                        onPress={(): void => {
                            props.onOpenSettings?.()
                        }}
                    >
                        Open settings
                    </DropdownItem>
                    <DropdownItem
                        key="billing"
                        onPress={(): void => {
                            props.onOpenBilling?.()
                        }}
                    >
                        Open billing
                    </DropdownItem>
                    <DropdownItem
                        key="help"
                        onPress={(): void => {
                            props.onOpenHelp?.()
                        }}
                    >
                        Help & diagnostics
                    </DropdownItem>
                    {props.onSignOut === undefined ? null : (
                        <DropdownItem
                            key="logout"
                            color="danger"
                            onPress={(): void => {
                                const signOut = props.onSignOut
                                if (signOut === undefined) {
                                    return
                                }

                                void signOut()
                            }}
                        >
                            Sign out
                        </DropdownItem>
                    )}
                </DropdownMenu>
            </Dropdown>
        </div>
    )
}
