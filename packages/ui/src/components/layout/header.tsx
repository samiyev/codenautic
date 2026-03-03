import type {ReactElement} from "react"
import {Navbar, NavbarBrand, NavbarContent, NavbarItem} from "@heroui/react"

import {ThemeToggle} from "./theme-toggle"
import {UserMenu} from "./user-menu"

/**
 * Параметры для layout header.
 */
export interface IHeaderProps {
    /** Заголовок в центре навбара. */
    readonly title?: string
    /** Имя пользователя. */
    readonly userName?: string
    /** Почта пользователя для дополнительного текста. */
    readonly userEmail?: string
    /** Действие выхода. */
    readonly onSignOut?: () => void
}

/**
 * Общий header для приложений с hero ui shell.
 *
 * @param props Параметры header.
 * @returns Navbar c переключателем темы и блоком пользователя.
 */
export function Header(props: IHeaderProps): ReactElement {
    return (
        <Navbar isBlurred className="border-b border-slate-200 bg-white/80 backdrop-blur" maxWidth="full">
            <NavbarContent justify="start">
                <NavbarBrand>
                    <p className="text-sm font-semibold tracking-wide">CodeNautic</p>
                </NavbarBrand>
            </NavbarContent>
            <NavbarContent justify="center">
                {props.title !== undefined ? (
                    <p className="text-sm font-medium text-slate-700">{props.title}</p>
                ) : null}
            </NavbarContent>
            <NavbarContent justify="end">
                <NavbarItem>
                    <ThemeToggle />
                </NavbarItem>
                <NavbarItem>
                    <UserMenu
                        onSignOut={props.onSignOut}
                        userEmail={props.userEmail}
                        userName={props.userName}
                    />
                </NavbarItem>
            </NavbarContent>
        </Navbar>
    )
}
