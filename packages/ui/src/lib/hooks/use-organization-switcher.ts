import { useEffect, useState } from "react"

import { type TTenantId, isTenantId } from "@/lib/access/access-types"
import { useAuthAccess } from "@/lib/auth/auth-access"
import {
    MULTI_TAB_SYNC_CHANNEL,
    TENANT_STORAGE_KEY,
    type TMultiTabSyncMessage,
} from "@/lib/sync/multi-tab-consistency"

import type { IHeaderOrganizationOption } from "@/components/layout/header"

/**
 * Список организаций, доступных для переключения.
 */
const ORGANIZATION_OPTIONS: ReadonlyArray<IHeaderOrganizationOption> = [
    { id: "platform-team", label: "Platform Team" },
    { id: "frontend-team", label: "Frontend Team" },
    { id: "runtime-team", label: "Runtime Team" },
]

/**
 * ID организации по умолчанию.
 */
const DEFAULT_ORGANIZATION_ID = resolveDefaultOrganizationId()

/**
 * Определяет ID организации по умолчанию из первого элемента списка.
 *
 * @returns ID организации-fallback.
 */
function resolveDefaultOrganizationId(): TTenantId {
    const firstOrganization = ORGANIZATION_OPTIONS[0]
    if (firstOrganization === undefined) {
        return "platform-team"
    }

    return firstOrganization.id as TTenantId
}

/**
 * Читает сохранённый ID организации из localStorage.
 *
 * @param fallbackTenantId Fallback tenant ID при отсутствии сохранённого.
 * @returns Активный tenant ID.
 */
function readStoredActiveOrganizationId(fallbackTenantId: TTenantId | undefined): TTenantId {
    if (typeof window !== "undefined") {
        try {
            const storedTenantId = window.localStorage.getItem(TENANT_STORAGE_KEY)
            if (storedTenantId !== null && isTenantId(storedTenantId)) {
                return storedTenantId
            }
        } catch {
            return fallbackTenantId ?? DEFAULT_ORGANIZATION_ID
        }
    }

    return fallbackTenantId ?? DEFAULT_ORGANIZATION_ID
}

/**
 * Очищает tenant-scoped хранилище при смене организации.
 *
 * @param previousTenantId ID предыдущей организации.
 * @param nextTenantId ID следующей организации.
 */
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
            detail: { nextTenantId, previousTenantId },
        }),
    )
}

/**
 * Результат хука переключения организаций.
 */
export interface IOrganizationSwitcherResult {
    /** Текущий активный ID организации. */
    readonly activeOrganizationId: TTenantId
    /** Прямой сеттер для обновления ID из multi-tab sync. */
    readonly setActiveOrganizationId: (id: TTenantId) => void
    /** Список доступных организаций. */
    readonly organizations: ReadonlyArray<IHeaderOrganizationOption>
    /** Обработчик смены организации. */
    readonly handleOrganizationChange: (organizationId: string) => void
}

/**
 * Управление переключением организаций с синхронизацией через localStorage и BroadcastChannel.
 *
 * @returns Состояние и обработчики переключения организации.
 */
export function useOrganizationSwitcher(): IOrganizationSwitcherResult {
    const authAccess = useAuthAccess()
    const [activeOrganizationId, setActiveOrganizationId] = useState<TTenantId>(() => {
        return readStoredActiveOrganizationId(authAccess?.tenantId)
    })

    useEffect((): void => {
        if (authAccess === undefined) {
            return
        }

        setActiveOrganizationId(readStoredActiveOrganizationId(authAccess.tenantId))
    }, [authAccess])

    const handleOrganizationChange = (organizationId: string): void => {
        if (isTenantId(organizationId) !== true) {
            return
        }

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
        window.localStorage.setItem(TENANT_STORAGE_KEY, organizationId)
        if (typeof window.BroadcastChannel === "function") {
            const channel = new window.BroadcastChannel(MULTI_TAB_SYNC_CHANNEL)
            channel.postMessage({
                tenantId: organizationId,
                type: "tenant",
            } satisfies TMultiTabSyncMessage)
            channel.close()
        }
    }

    return {
        activeOrganizationId,
        handleOrganizationChange,
        organizations: ORGANIZATION_OPTIONS,
        setActiveOrganizationId,
    }
}
