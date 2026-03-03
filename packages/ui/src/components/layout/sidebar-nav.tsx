import type {ReactElement} from "react"
import {Link, useLocation} from "@tanstack/react-router"
import {Avatar, Button} from "@/components/ui"

/**
 * Навигационный элемент сайдбара.
 */
interface ISidebarItem {
    /** Отображаемый лейбл пункта. */
    readonly label: string
    /** Маршрут. */
    readonly to: string
    /** Иконка инициалов или маркер состояния. */
    readonly icon?: string
}

/**
 * Свойства навигационного списка сайдбара.
 */
export interface ISidebarNavProps {
    /** Список элементов меню. */
    readonly items?: ReadonlyArray<ISidebarItem>
}

const DEFAULT_SIDEBAR_ITEMS: readonly ISidebarItem[] = [
    {
        icon: "🏠",
        label: "Dashboard",
        to: "/",
    },
] as const

/**
 * Навигационный список для sidebar.
 *
 * @param props Список ссылок.
 * @returns Список доступных route-переходов.
 */
export function SidebarNav(props: ISidebarNavProps): ReactElement {
    const currentLocation = useLocation()
    const items = props.items ?? DEFAULT_SIDEBAR_ITEMS

    return (
        <nav aria-label="Main navigation">
            <ul className="flex flex-col gap-1">
                {items.map((item): ReactElement => {
                    const isActive = currentLocation.pathname === item.to
                    return (
                        <li key={item.to}>
                            <Link
                                className="inline-flex w-full rounded-lg"
                                to={item.to}
                                viewTransition={false}
                            >
                                <Button
                                    className="w-full justify-start"
                                    fullWidth
                                    startContent={item.icon === undefined ? undefined : <Avatar name={item.icon} size="sm" />}
                                    variant={isActive ? "solid" : "light"}
                                >
                                    {item.label}
                                </Button>
                            </Link>
                        </li>
                    )
                })}
            </ul>
        </nav>
    )
}
