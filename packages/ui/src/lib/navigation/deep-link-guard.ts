import {
    isRouteAccessible,
    type IRouteGuardContext,
    type TTenantId,
} from "@/lib/navigation/route-guard-map"

type TDeepLinkGuardDecision = "allow" | "deny" | "switch_org"

export interface IDeepLinkGuardResult {
    /** Решение guard-а для deep-link. */
    readonly decision: TDeepLinkGuardDecision
    /** Причина решения guard-а. */
    readonly reason: string
    /** Санитизированный целевой путь. */
    readonly sanitizedPath: string
    /** Tenant для switch-org сценария. */
    readonly switchTenantId?: TTenantId
}

const TENANT_OPTIONS: ReadonlyArray<TTenantId> = ["platform-team", "frontend-team", "runtime-team"]

const FALLBACK_PATH = "/settings"

const SENSITIVE_QUERY_KEYS: ReadonlyArray<string> = [
    "access_token",
    "api_key",
    "auth",
    "key",
    "refresh_token",
    "secret",
    "token",
]

function isSensitiveQueryKey(key: string): boolean {
    return SENSITIVE_QUERY_KEYS.some((sensitiveKey): boolean => {
        return key.toLowerCase().includes(sensitiveKey)
    })
}

/**
 * Санитизирует deep-link от чувствительных query параметров.
 *
 * @param targetPath Сырой target path.
 * @returns Безопасный path для навигации.
 */
export function sanitizeDeepLinkPath(targetPath: string): string {
    const sourcePath = targetPath.trim()
    if (sourcePath.length === 0 || sourcePath.startsWith("/") !== true) {
        return FALLBACK_PATH
    }

    const parsedUrl = new URL(sourcePath, "https://codenautic.local")
    const sanitizedParams = new URLSearchParams()
    parsedUrl.searchParams.forEach((value, key): void => {
        if (isSensitiveQueryKey(key)) {
            return
        }
        sanitizedParams.set(key, value)
    })

    const queryString = sanitizedParams.toString()
    return queryString.length > 0 ? `${parsedUrl.pathname}?${queryString}` : parsedUrl.pathname
}

/**
 * Проверяет deep-link по tenant/role guard и возвращает безопасное решение.
 *
 * @param targetPath Сырой deep-link path.
 * @param context Контекст пользователя.
 * @returns Решение allow/switch_org/deny.
 */
export function resolveDeepLinkGuard(
    targetPath: string,
    context: IRouteGuardContext,
): IDeepLinkGuardResult {
    const sanitizedPath = sanitizeDeepLinkPath(targetPath)
    const canAccessInCurrentTenant = isRouteAccessible(sanitizedPath, context)
    if (canAccessInCurrentTenant) {
        return {
            decision: "allow",
            reason: "Route access granted in current tenant context.",
            sanitizedPath,
        }
    }

    const switchTenantId = TENANT_OPTIONS.find((tenantId): TTenantId | undefined => {
        if (tenantId === context.tenantId) {
            return undefined
        }

        const crossTenantContext: IRouteGuardContext = {
            ...context,
            tenantId,
        }
        return isRouteAccessible(sanitizedPath, crossTenantContext) ? tenantId : undefined
    })

    if (switchTenantId !== undefined) {
        return {
            decision: "switch_org",
            reason: "Route denied in current tenant but accessible in another workspace.",
            sanitizedPath,
            switchTenantId,
        }
    }

    return {
        decision: "deny",
        reason: "Route denied by tenant/role guard matrix.",
        sanitizedPath: FALLBACK_PATH,
    }
}
