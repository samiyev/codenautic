import type { ReactElement } from "react"
import { Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@/components/ui"
import { Avatar } from "@/components/ui"

/**
 * Настройки отображения пользовательского блока в header.
 */
export interface IUserMenuProps {
    /** Имя пользователя. */
    readonly userName?: string
    /** Email пользователя. */
    readonly userEmail?: string
    /** Коллбэк для выхода из системы. */
    readonly onSignOut?: () => Promise<void> | void
    /** Открыть Settings. */
    readonly onOpenSettings?: () => void
    /** Открыть Billing. */
    readonly onOpenBilling?: () => void
    /** Открыть Help & Diagnostics. */
    readonly onOpenHelp?: () => void
}

/**
 * Пользовательское меню с быстрыми переходами по ключевым экранам.
 *
 * @param props Параметры пользовательского меню.
 * @returns Блок с avatar и кнопкой sign out.
 */
export function UserMenu(props: IUserMenuProps): ReactElement {
    const initials = props.userName !== undefined ? props.userName.slice(0, 2).toUpperCase() : "CN"

    return (
        <Dropdown>
            <DropdownTrigger
                className="h-8 min-h-8 rounded-full px-1"
                radius="full"
                size="sm"
                variant="light"
            >
                <span className="inline-flex items-center gap-2 rounded-full">
                    <Avatar label={props.userName ?? "User"} size="sm" />
                    <span className="hidden text-xs font-medium sm:inline">
                        {props.userName ?? "User"}
                    </span>
                    <span className="sr-only">{initials}</span>
                </span>
            </DropdownTrigger>
            <DropdownMenu aria-label="User menu">
                <DropdownItem key="name">{props.userName ?? "User"}</DropdownItem>
                <DropdownItem key="email">{props.userEmail ?? "user@example.com"}</DropdownItem>
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
    )
}
