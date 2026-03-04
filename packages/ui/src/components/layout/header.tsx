import { type ReactElement, useEffect, useMemo, useRef, useState } from "react"
import { Bell, Menu } from "lucide-react"

import { Button } from "@/components/ui"

import { ThemeToggle } from "./theme-toggle"
import { UserMenu } from "./user-menu"

/**
 * Опция выбора организации в header switcher.
 */
export interface IHeaderOrganizationOption {
    /** Идентификатор организации/tenant. */
    readonly id: string
    /** Отображаемое название в selector. */
    readonly label: string
}

/**
 * Опция роли для RBAC preview.
 */
export interface IHeaderRoleOption {
    /** Технический id роли. */
    readonly id: string
    /** Человекочитаемая подпись роли. */
    readonly label: string
}

export interface IHeaderSearchRouteOption {
    /** Подпись маршрута. */
    readonly label: string
    /** Путь маршрута. */
    readonly path: string
}

/**
 * Параметры для layout header.
 */
export interface IHeaderProps {
    /** Заголовок в центре навбара. */
    readonly title?: string
    /** Количество непрочитанных уведомлений. */
    readonly notificationCount?: number
    /** Имя пользователя. */
    readonly userName?: string
    /** Почта пользователя для дополнительного текста. */
    readonly userEmail?: string
    /** Действие выхода. */
    readonly onSignOut?: () => void
    /** Открыть мобильную панель навигации. */
    readonly onMobileMenuOpen?: () => void
    /** Список доступных tenant/workspace. */
    readonly organizations?: ReadonlyArray<IHeaderOrganizationOption>
    /** Активная организация. */
    readonly activeOrganizationId?: string
    /** Смена организации/workspace. */
    readonly onOrganizationChange?: (organizationId: string) => void
    /** Доступные роли для RBAC preview. */
    readonly roleOptions?: ReadonlyArray<IHeaderRoleOption>
    /** Активная роль. */
    readonly activeRoleId?: string
    /** Смена роли в UI policy preview. */
    readonly onRoleChange?: (roleId: string) => void
    /** Breadcrumb trail активного экрана. */
    readonly breadcrumbs?: ReadonlyArray<string>
    /** Доступные маршруты для global search shortcut. */
    readonly searchRoutes?: ReadonlyArray<IHeaderSearchRouteOption>
    /** Навигация по выбранному маршруту из global search. */
    readonly onSearchRouteNavigate?: (path: string) => void
}

/**
 * Общий header для приложений с hero ui shell.
 *
 * @param props Параметры header.
 * @returns Navbar c переключателем темы и блоком пользователя.
 */
export function Header(props: IHeaderProps): ReactElement {
    const [searchQuery, setSearchQuery] = useState("")
    const searchInputRef = useRef<HTMLInputElement | null>(null)
    const hasNotifications = props.notificationCount !== undefined && props.notificationCount > 0
    const activeOrganization = props.organizations?.find((organization): boolean => {
        return organization.id === props.activeOrganizationId
    })
    const activeRole = props.roleOptions?.find((role): boolean => {
        return role.id === props.activeRoleId
    })
    const filteredSearchRoutes = useMemo((): ReadonlyArray<IHeaderSearchRouteOption> => {
        if (props.searchRoutes === undefined) {
            return []
        }

        const normalizedQuery = searchQuery.trim().toLowerCase()
        if (normalizedQuery.length === 0) {
            return props.searchRoutes
        }

        return props.searchRoutes.filter((route): boolean => {
            return `${route.label} ${route.path}`.toLowerCase().includes(normalizedQuery)
        })
    }, [props.searchRoutes, searchQuery])

    useEffect((): (() => void) | void => {
        if (typeof window === "undefined") {
            return
        }

        const handleKeyboardShortcut = (event: KeyboardEvent): void => {
            if ((event.ctrlKey !== true && event.metaKey !== true) || event.key.toLowerCase() !== "k") {
                return
            }

            event.preventDefault()
            searchInputRef.current?.focus()
            searchInputRef.current?.select()
        }

        window.addEventListener("keydown", handleKeyboardShortcut)

        return (): void => {
            window.removeEventListener("keydown", handleKeyboardShortcut)
        }
    }, [])

    return (
        <div className="border-b border-[var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_88%,transparent)] backdrop-blur">
            <div className="mx-auto flex h-16 items-center gap-3 px-3">
                <div className={props.title === undefined ? "md:hidden" : "hidden md:flex"}>
                    <Button
                        isIconOnly
                        radius="full"
                        variant="light"
                        aria-label="Open navigation menu"
                        onPress={props.onMobileMenuOpen}
                    >
                        <Menu size={20} />
                    </Button>
                </div>
                <p className="text-sm font-semibold tracking-wide text-[var(--foreground)]">CodeNautic</p>
                <div className="mx-auto hidden md:block">
                    {props.title !== undefined ? (
                        <div className="space-y-0.5">
                            <p className="text-sm font-medium text-[var(--foreground)]/80">{props.title}</p>
                            {props.breadcrumbs === undefined ? null : (
                                <p className="text-[11px] text-[var(--foreground)]/60">
                                    {props.breadcrumbs.join(" / ")}
                                </p>
                            )}
                        </div>
                    ) : null}
                </div>
                {props.searchRoutes === undefined ? null : (
                    <div className="hidden min-w-[230px] md:block">
                        <input
                            aria-label="Global route search"
                            className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--foreground)]"
                            list="header-global-route-search"
                            placeholder="Global search (Ctrl+K)"
                            ref={searchInputRef}
                            type="text"
                            value={searchQuery}
                            onChange={(event): void => {
                                setSearchQuery(event.currentTarget.value)
                            }}
                            onKeyDown={(event): void => {
                                if (event.key !== "Enter") {
                                    return
                                }

                                const targetRoute = filteredSearchRoutes[0]
                                if (targetRoute === undefined) {
                                    return
                                }

                                props.onSearchRouteNavigate?.(targetRoute.path)
                                setSearchQuery("")
                            }}
                        />
                        <datalist id="header-global-route-search">
                            {filteredSearchRoutes.map((route): ReactElement => (
                                <option key={route.path} value={`${route.label} (${route.path})`} />
                            ))}
                        </datalist>
                    </div>
                )}
                {props.organizations === undefined && props.roleOptions === undefined ? null : (
                    <div className="hidden items-start gap-2 md:flex">
                        {props.organizations === undefined ? null : (
                            <div className="min-w-[220px]">
                                <label
                                    className="text-[11px] uppercase tracking-[0.08em] text-[var(--foreground)]/60"
                                    htmlFor="header-organization-switcher"
                                >
                                    Workspace
                                </label>
                                <select
                                    aria-label="Organization workspace switcher"
                                    className="mt-0.5 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--foreground)]"
                                    id="header-organization-switcher"
                                    value={props.activeOrganizationId}
                                    onChange={(event): void => {
                                        props.onOrganizationChange?.(event.currentTarget.value)
                                    }}
                                >
                                    {props.organizations.map((organization): ReactElement => (
                                        <option key={organization.id} value={organization.id}>
                                            {organization.label}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-[11px] text-[var(--foreground)]/60">
                                    Current: {activeOrganization?.label ?? "Unknown workspace"}
                                </p>
                            </div>
                        )}
                        {props.roleOptions === undefined ? null : (
                            <div className="min-w-[170px]">
                                <label
                                    className="text-[11px] uppercase tracking-[0.08em] text-[var(--foreground)]/60"
                                    htmlFor="header-rbac-role-switcher"
                                >
                                    Role preview
                                </label>
                                <select
                                    aria-label="RBAC role switcher"
                                    className="mt-0.5 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--foreground)]"
                                    id="header-rbac-role-switcher"
                                    value={props.activeRoleId}
                                    onChange={(event): void => {
                                        props.onRoleChange?.(event.currentTarget.value)
                                    }}
                                >
                                    {props.roleOptions.map((role): ReactElement => (
                                        <option key={role.id} value={role.id}>
                                            {role.label}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-[11px] text-[var(--foreground)]/60">
                                    Active: {activeRole?.label ?? "Unknown role"}
                                </p>
                            </div>
                        )}
                    </div>
                )}
                <div className="ml-auto flex items-center gap-2">
                    <Button
                        isIconOnly
                        radius="full"
                        variant="light"
                        aria-label={`Notifications (${props.notificationCount ?? 0})`}
                    >
                        <span className="relative inline-flex">
                            <Bell size={16} />
                            {hasNotifications ? (
                                <span
                                    aria-hidden="true"
                                    className="absolute -right-1.5 -top-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] leading-none text-white"
                                >
                                    {props.notificationCount}
                                </span>
                            ) : null}
                        </span>
                    </Button>
                    <ThemeToggle />
                    <UserMenu
                        onSignOut={props.onSignOut}
                        userEmail={props.userEmail}
                        userName={props.userName}
                    />
                </div>
            </div>
            {props.title === undefined ? null : (
                <div className="border-t border-[var(--border)] px-3 py-2 md:hidden">
                    <p className="text-sm text-[var(--foreground)]/80">{props.title}</p>
                </div>
            )}
        </div>
    )
}
