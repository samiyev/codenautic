import type {ReactElement} from "react"
import {useLocation, useNavigate} from "@tanstack/react-router"
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
    /** Коллбэк при выборе элемента, полезен для закрытия mobile-drawer. */
    readonly onNavigate?: (to: string) => void
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
    const navigate = useNavigate()
    const items = props.items ?? DEFAULT_SIDEBAR_ITEMS

    return (
        <nav aria-label="Main navigation">
            <ul className="flex flex-col gap-1">
                {items.map((item): ReactElement => {
                    const isActive = currentLocation.pathname === item.to

                    const handlePress = (): void => {
                        if (item.to === currentLocation.pathname) {
                            if (props.onNavigate !== undefined) {
                                props.onNavigate(item.to)
                            }
                            return
                        }

                        if (props.onNavigate !== undefined) {
                            props.onNavigate(item.to)
                        }

                        void navigate({to: item.to})
                    }

                    return (
                        <li key={item.to}>
                            <Button
                                aria-current={isActive ? "page" : undefined}
                                className="w-full justify-start"
                                fullWidth
                                startContent={item.icon === undefined ? undefined : <Avatar name={item.icon} size="sm" />}
                                variant={isActive ? "solid" : "light"}
                                onPress={handlePress}
                            >
                                {item.label}
                            </Button>
                        </li>
                    )
                })}
            </ul>
        </nav>
    )
}
