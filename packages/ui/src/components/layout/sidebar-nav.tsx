import type { ReactElement } from "react"
import type { TFunction } from "i18next"
import { useTranslation } from "react-i18next"
import { useLocation, useNavigate } from "@tanstack/react-router"

import {
    Bug,
    Building2,
    ChartPie,
    FolderKanban,
    GitPullRequest,
    House,
    Inbox,
    LifeBuoy,
    Lightbulb,
    Settings,
    TrendingUp,
} from "@/components/icons/app-icons"
import { TYPOGRAPHY } from "@/lib/constants/typography"

/**
 * Sidebar navigation item.
 */
export interface ISidebarItem {
    /** Display label. */
    readonly label: string
    /** Route path. Undefined for disabled state. */
    readonly to?: string
    /** Menu item icon. */
    readonly icon?: ReactElement
    /** Whether the item is disabled. */
    readonly isDisabled?: boolean
}

/**
 * Grouped section of nav items.
 */
interface ISidebarGroup {
    /** Section label (rendered as overline). */
    readonly label?: string
    /** Items in this group. */
    readonly items: ReadonlyArray<ISidebarItem>
}

/**
 * Sidebar nav list props.
 */
export interface ISidebarNavProps {
    /** Menu items (flat list, used when groups not needed). */
    readonly items?: ReadonlyArray<ISidebarItem>
    /** Callback when item is selected (for closing mobile drawer). */
    readonly onNavigate?: (to?: string) => void
    /** Whether the sidebar is in collapsed icon-only mode. */
    readonly isCollapsed?: boolean
}

/**
 * Создаёт сгруппированные навигационные элементы sidebar.
 *
 * @param t Функция перевода из react-i18next.
 * @returns Массив групп навигации.
 */
function createSidebarGroups(
    t: TFunction<ReadonlyArray<"navigation">>,
): ReadonlyArray<ISidebarGroup> {
    return [
        {
            items: [
                {
                    icon: <Inbox aria-hidden="true" size={16} />,
                    label: t("navigation:sidebar.myWork"),
                    to: "/my-work",
                },
                {
                    icon: <House aria-hidden="true" size={16} />,
                    label: t("navigation:sidebar.dashboard"),
                    to: "/",
                },
            ],
        },
        {
            label: t("navigation:sidebarGroup.reviews"),
            items: [
                {
                    icon: <GitPullRequest aria-hidden="true" size={16} />,
                    label: t("navigation:sidebar.ccrManagement"),
                    to: "/reviews",
                },
                {
                    icon: <Bug aria-hidden="true" size={16} />,
                    label: t("navigation:sidebar.issues"),
                    to: "/issues",
                },
            ],
        },
        {
            items: [
                {
                    icon: <FolderKanban aria-hidden="true" size={16} />,
                    label: t("navigation:sidebar.repositories"),
                    to: "/repositories",
                },
            ],
        },
        {
            label: t("navigation:sidebarGroup.intelligence"),
            items: [
                {
                    icon: <Building2 aria-hidden="true" size={16} />,
                    label: t("navigation:sidebar.codeCity"),
                    to: "/dashboard/code-city",
                },
                {
                    icon: <ChartPie aria-hidden="true" size={16} />,
                    label: t("navigation:sidebar.reports"),
                    to: "/reports",
                },
                {
                    icon: <TrendingUp aria-hidden="true" size={16} />,
                    label: t("navigation:sidebar.adoptionAnalytics"),
                    to: "/adoption-analytics",
                },
            ],
        },
    ]
}

/**
 * Bottom utility items (Settings, Help).
 *
 * @param t Функция перевода.
 * @returns Утилитарные nav items.
 */
function createUtilityItems(
    t: TFunction<ReadonlyArray<"navigation">>,
): ReadonlyArray<ISidebarItem> {
    return [
        {
            icon: <Settings aria-hidden="true" size={16} />,
            label: t("navigation:sidebar.settings"),
            to: "/settings",
        },
        {
            icon: <LifeBuoy aria-hidden="true" size={16} />,
            label: t("navigation:sidebar.help"),
            to: "/help-diagnostics",
        },
    ]
}

/**
 * Sidebar navigation with grouped sections and utility footer items.
 *
 * @param props List of route links.
 * @returns Navigation item list with section grouping.
 */
export function SidebarNav(props: ISidebarNavProps): ReactElement {
    const { t } = useTranslation(["navigation"])
    const currentLocation = useLocation()
    const navigate = useNavigate()
    const isCollapsed = props.isCollapsed === true

    const hasCustomItems = props.items !== undefined
    const groups = hasCustomItems ? [{ items: props.items }] : createSidebarGroups(t)
    const utilityItems = hasCustomItems ? [] : createUtilityItems(t)

    const isItemActive = (to: string): boolean => {
        if (to === "/") {
            return currentLocation.pathname === "/"
        }

        return currentLocation.pathname === to || currentLocation.pathname.startsWith(`${to}/`)
    }

    const renderItem = (item: ISidebarItem): ReactElement => {
        const isNavigable = item.to !== undefined && item.isDisabled !== true
        const isActive = item.to !== undefined && isItemActive(item.to) && item.isDisabled !== true

        const handlePress = (): void => {
            if (props.onNavigate !== undefined) {
                props.onNavigate(item.to)
            }

            if (isNavigable !== true || item.to === undefined) {
                return
            }

            if (currentLocation.pathname !== item.to) {
                void navigate({ to: item.to })
            }
        }

        if (isCollapsed) {
            return (
                <li key={item.label} title={item.label}>
                    <button
                        aria-current={isActive ? "page" : undefined}
                        aria-disabled={item.isDisabled === true ? true : undefined}
                        aria-label={item.label}
                        className={`flex h-8 w-full items-center justify-center rounded-md transition-colors duration-100 ${
                            isActive
                                ? "bg-accent/12 text-accent"
                                : "text-muted hover:bg-surface-hover hover:text-foreground"
                        } ${item.isDisabled === true ? "pointer-events-none opacity-40" : ""}`}
                        type="button"
                        onClick={handlePress}
                    >
                        {item.icon}
                    </button>
                </li>
            )
        }

        return (
            <li key={item.label}>
                <button
                    aria-current={isActive ? "page" : undefined}
                    aria-disabled={item.isDisabled === true ? true : undefined}
                    className={`group flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-[13px] transition-colors duration-100 ${
                        isActive
                            ? "bg-accent/10 font-medium text-accent"
                            : "text-muted hover:bg-surface-hover hover:text-foreground"
                    } ${item.isDisabled === true ? "pointer-events-none opacity-40" : ""}`}
                    type="button"
                    onClick={handlePress}
                >
                    <span
                        className={`inline-flex shrink-0 items-center justify-center ${isActive ? "text-accent" : "text-muted group-hover:text-foreground"}`}
                    >
                        {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                </button>
            </li>
        )
    }

    return (
        <nav
            aria-label={t("navigation:ariaLabel.sidebarNav.mainNavigation")}
            className="flex h-full flex-col"
        >
            <div className="flex-1 space-y-3 overflow-y-auto">
                {groups.map(
                    (group, groupIndex): ReactElement => (
                        <div key={group.label ?? `group-${String(groupIndex)}`}>
                            {group.label !== undefined && isCollapsed !== true ? (
                                <p
                                    className={`mb-1 px-2 ${TYPOGRAPHY.overline}`}
                                    style={{ fontSize: "10px" }}
                                >
                                    {group.label}
                                </p>
                            ) : null}
                            {isCollapsed && groupIndex > 0 ? (
                                <div
                                    aria-hidden="true"
                                    className="mx-auto mb-1.5 mt-0.5 h-px w-4 bg-border/40"
                                />
                            ) : null}
                            <ul className="flex flex-col gap-px">{group.items.map(renderItem)}</ul>
                        </div>
                    ),
                )}
            </div>

            {/* Utility items pinned to bottom */}
            <div className="mt-1 border-t border-border/30 pt-1.5">
                <ul className="flex flex-col gap-px">{utilityItems.map(renderItem)}</ul>
            </div>
        </nav>
    )
}
