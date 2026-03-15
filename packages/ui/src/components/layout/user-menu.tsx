import type { ReactElement } from "react"
import { useTranslation } from "react-i18next"

import {
    Avatar as HeroUIAvatar,
    AvatarFallback,
    Dropdown,
    DropdownItem,
    DropdownMenu,
    DropdownPopover,
    DropdownTrigger,
} from "@heroui/react"

/**
 * Количество символов для инициалов пользователя.
 */
const INITIALS_LENGTH = 2

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
    const { t } = useTranslation(["navigation"])
    const defaultName = t("navigation:userMenu.defaultName")
    const initials =
        props.userName !== undefined ? props.userName.slice(0, INITIALS_LENGTH).toUpperCase() : "CN"

    return (
        <Dropdown>
            <DropdownTrigger className="h-8 min-h-8 rounded-full px-1">
                <span className="inline-flex items-center gap-2 rounded-full">
                    <HeroUIAvatar>
                        <AvatarFallback>{initials}</AvatarFallback>
                    </HeroUIAvatar>
                    <span className="hidden text-xs font-medium sm:inline">
                        {props.userName ?? defaultName}
                    </span>
                    <span className="sr-only">{initials}</span>
                </span>
            </DropdownTrigger>
            <DropdownPopover>
                <DropdownMenu aria-label={t("navigation:userMenuAriaLabel")}>
                    <DropdownItem key="name">{props.userName ?? defaultName}</DropdownItem>
                    <DropdownItem key="email">
                        {props.userEmail ?? t("navigation:userMenu.defaultEmail")}
                    </DropdownItem>
                    <DropdownItem
                        key="settings"
                        onPress={(): void => {
                            props.onOpenSettings?.()
                        }}
                    >
                        {t("navigation:userMenu.openSettings")}
                    </DropdownItem>
                    <DropdownItem
                        key="billing"
                        onPress={(): void => {
                            props.onOpenBilling?.()
                        }}
                    >
                        {t("navigation:userMenu.openBilling")}
                    </DropdownItem>
                    <DropdownItem
                        key="help"
                        onPress={(): void => {
                            props.onOpenHelp?.()
                        }}
                    >
                        {t("navigation:userMenu.helpDiagnostics")}
                    </DropdownItem>
                    {props.onSignOut === undefined ? null : (
                        <DropdownItem
                            key="logout"
                            className="text-danger hover:text-danger"
                            onPress={(): void => {
                                const signOut = props.onSignOut
                                if (signOut === undefined) {
                                    return
                                }

                                void signOut()
                            }}
                        >
                            {t("navigation:userMenu.signOut")}
                        </DropdownItem>
                    )}
                </DropdownMenu>
            </DropdownPopover>
        </Dropdown>
    )
}
