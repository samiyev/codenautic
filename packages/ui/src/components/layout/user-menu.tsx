import type {ReactElement} from "react"
import {Avatar, Button} from "@/components/ui"

/**
 * Настройки отображения пользовательского блока в header.
 */
export interface IUserMenuProps {
    /** Имя пользователя. */
    readonly userName?: string
    /** Email пользователя. */
    readonly userEmail?: string
    /** Коллбэк для выхода из системы. */
    readonly onSignOut?: () => void
}

/**
 * Минимальный user-menu без выпадающих слоёв.
 *
 * Служит placeholder, пока не введена полноценная навигация в settings/profile.
 *
 * @param props Параметры пользовательского меню.
 * @returns Блок с avatar и кнопкой sign out.
 */
export function UserMenu(props: IUserMenuProps): ReactElement {
    const initials = props.userName !== undefined ? props.userName.slice(0, 2).toUpperCase() : "CN"

    return (
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/85 px-2 py-1">
            <Avatar name={props.userName ?? "User"} size="sm" />
            <div className="hidden flex-col text-left text-xs sm:flex">
                <span className="font-medium text-slate-900">{props.userName ?? "User"}</span>
                {props.userEmail !== undefined ? <span className="text-slate-600">{props.userEmail}</span> : null}
            </div>
            {props.onSignOut === undefined ? null : (
                <Button
                    className="h-7 min-h-7 px-2 text-xs"
                    size="sm"
                    variant="light"
                    onPress={(): void => {
                        props.onSignOut?.()
                    }}
                >
                    Sign out
                </Button>
            )}
            <span className="sr-only">{initials}</span>
        </div>
    )
}
