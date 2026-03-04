import { type ReactElement, type ReactNode, useEffect, useState } from "react"
import { useLocation, useNavigate } from "@tanstack/react-router"
import { readUiRoleFromStorage, writeUiRoleToStorage, type TUiRole } from "@/lib/permissions/ui-policy"

import { Header } from "./header"
import type { IHeaderOrganizationOption } from "./header"
import type { IHeaderRoleOption } from "./header"
import { Sidebar } from "./sidebar"
import { MobileSidebar } from "./mobile-sidebar"

/**
 * Свойства layout-контейнера для страниц dashboard.
 */
export interface IDashboardLayoutProps {
    /** Основное содержимое страницы. */
    readonly children: ReactNode
    /** Заголовок страницы (рендерится в хедере). */
    readonly title?: string
    /** Имя пользователя для user-menu. */
    readonly userName?: string
    /** Email пользователя для user-menu. */
    readonly userEmail?: string
    /** Действие выхода из системы. */
    readonly onSignOut?: () => Promise<void> | void
}

const ORGANIZATION_OPTIONS: ReadonlyArray<IHeaderOrganizationOption> = [
    {
        id: "platform-team",
        label: "Platform Team",
    },
    {
        id: "frontend-team",
        label: "Frontend Team",
    },
    {
        id: "runtime-team",
        label: "Runtime Team",
    },
]

const DEFAULT_ORGANIZATION_ID = ORGANIZATION_OPTIONS[0].id

const ROLE_OPTIONS: ReadonlyArray<IHeaderRoleOption> = [
    {
        id: "viewer",
        label: "Viewer",
    },
    {
        id: "developer",
        label: "Developer",
    },
    {
        id: "lead",
        label: "Lead",
    },
    {
        id: "admin",
        label: "Admin",
    },
]

const TENANT_ALLOWED_ROUTES: Readonly<Record<string, ReadonlyArray<string>>> = {
    "frontend-team": [
        "/",
        "/dashboard",
        "/reviews",
        "/settings",
        "/settings-appearance",
        "/settings-code-review",
        "/settings-notifications",
        "/settings-rules-library",
    ],
    "platform-team": [
        "/",
        "/dashboard",
        "/reviews",
        "/settings",
        "/settings-audit-logs",
        "/settings-byok",
        "/settings-organization",
        "/settings-sso",
        "/settings-team",
    ],
    "runtime-team": [
        "/",
        "/dashboard",
        "/reviews",
        "/settings",
        "/settings-git-providers",
        "/settings-integrations",
        "/settings-llm-providers",
        "/settings-token-usage",
        "/settings-webhooks",
    ],
}

function canTenantAccessPath(tenantId: string, pathname: string): boolean {
    const allowedRoutes = TENANT_ALLOWED_ROUTES[tenantId]
    if (allowedRoutes === undefined) {
        return false
    }

    return allowedRoutes.some((allowedRoute): boolean => {
        return pathname === allowedRoute || pathname.startsWith(`${allowedRoute}/`)
    })
}

function clearTenantScopedStorage(previousTenantId: string, nextTenantId: string): void {
    if (typeof window === "undefined") {
        return
    }

    Object.keys(window.localStorage).forEach((storageKey): void => {
        if (storageKey.startsWith("codenautic:tenant:")) {
            window.localStorage.removeItem(storageKey)
        }
    })

    window.localStorage.setItem("codenautic:tenant:active", nextTenantId)
    window.sessionStorage.setItem("codenautic:tenant:last-switch", new Date().toISOString())
    window.dispatchEvent(
        new CustomEvent("codenautic:tenant-switched", {
            detail: {
                nextTenantId,
                previousTenantId,
            },
        }),
    )
}

/**
 * Базовый layout для dashboard-экранов с HeroUI navbar и глобальными контролями.
 *
 * @param props Конфигурация контента.
 * @returns Обёрнутый контент с верхней панелью.
 */
export function DashboardLayout(props: IDashboardLayoutProps): ReactElement {
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
    const [activeOrganizationId, setActiveOrganizationId] =
        useState<string>(DEFAULT_ORGANIZATION_ID)
    const [activeRoleId, setActiveRoleId] = useState<TUiRole>(() => {
        return readUiRoleFromStorage()
    })
    const navigate = useNavigate()
    const location = useLocation()

    const handleSignOut = (): void => {
        if (props.onSignOut === undefined) {
            return
        }

        void props.onSignOut()
    }

    const handleOrganizationChange = (organizationId: string): void => {
        if (organizationId === activeOrganizationId) {
            return
        }

        const organization = ORGANIZATION_OPTIONS.find((item): boolean => {
            return item.id === organizationId
        })
        if (organization === undefined) {
            return
        }

        const isConfirmed =
            typeof window === "undefined"
                ? true
                : window.confirm(`Switch workspace to ${organization.label}?`)
        if (isConfirmed !== true) {
            return
        }

        clearTenantScopedStorage(activeOrganizationId, organizationId)
        setActiveOrganizationId(organizationId)
    }

    const handleRoleChange = (roleId: string): void => {
        if (roleId !== "viewer" && roleId !== "developer" && roleId !== "lead" && roleId !== "admin") {
            return
        }

        setActiveRoleId(roleId)
        writeUiRoleToStorage(roleId)
    }

    useEffect((): void => {
        if (canTenantAccessPath(activeOrganizationId, location.pathname)) {
            return
        }

        void navigate({
            to: "/settings",
        })
    }, [activeOrganizationId, location.pathname, navigate])

    return (
        <div className="relative min-h-screen bg-[var(--background)] text-[var(--foreground)]">
            <Header
                activeOrganizationId={activeOrganizationId}
                activeRoleId={activeRoleId}
                onMobileMenuOpen={(): void => {
                    setIsMobileSidebarOpen(true)
                }}
                onOrganizationChange={handleOrganizationChange}
                onRoleChange={handleRoleChange}
                userEmail={props.userEmail}
                userName={props.userName}
                onSignOut={handleSignOut}
                organizations={ORGANIZATION_OPTIONS}
                roleOptions={ROLE_OPTIONS}
                title={props.title}
            />
            <MobileSidebar
                isOpen={isMobileSidebarOpen}
                onOpenChange={setIsMobileSidebarOpen}
                title="Menu"
            />
            <div className="mx-auto flex w-full max-w-screen-xl gap-4 px-4 py-4 sm:px-6">
                <div className="hidden min-h-0 flex-shrink-0 md:block">
                    <Sidebar
                        isCollapsed={isSidebarCollapsed}
                        onNavigate={(): void => {
                            setIsMobileSidebarOpen(false)
                        }}
                        onSidebarToggle={(): void => {
                            setIsSidebarCollapsed((previousValue): boolean => !previousValue)
                        }}
                        title="Menu"
                    />
                </div>
                <div className="min-h-0 flex-1 rounded-lg border border-[var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_88%,transparent)] p-4 shadow-sm">
                    {props.children}
                </div>
            </div>
        </div>
    )
}
