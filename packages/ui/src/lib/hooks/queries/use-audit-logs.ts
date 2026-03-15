import { useQuery, type UseQueryResult } from "@tanstack/react-query"

import { createApiContracts } from "@/lib/api"
import type {
    IAuditFilters,
    IAuditLogsApi,
    IAuditLogsPaginatedResponse,
} from "@/lib/api/endpoints/audit-logs.endpoint"
import { queryKeys } from "@/lib/query/query-keys"

const apiInstance: { readonly auditLogs: IAuditLogsApi } = createApiContracts()

/**
 * Параметры useAuditLogs().
 */
export interface IUseAuditLogsArgs {
    /**
     * Фильтры для запроса.
     */
    readonly filters: IAuditFilters
    /**
     * Включить/выключить автозагрузку.
     */
    readonly enabled?: boolean
}

/**
 * Результат useAuditLogs().
 */
export interface IUseAuditLogsResult {
    /**
     * Query списка аудит-логов.
     */
    readonly logsQuery: UseQueryResult<IAuditLogsPaginatedResponse, Error>
}

/**
 * React Query хук для загрузки аудит-логов.
 *
 * Загружает пагинированный и фильтрованный список аудит-логов.
 * Поддерживает фильтрацию по актору, типу действия и диапазону дат.
 *
 * @param args - Конфигурация загрузки.
 * @returns Query с пагинированными аудит-логами.
 */
export function useAuditLogs(args: IUseAuditLogsArgs): IUseAuditLogsResult {
    const { filters, enabled = true } = args

    const logsQuery = useQuery({
        queryKey: queryKeys.auditLogs.list(filters),
        queryFn: async (): Promise<IAuditLogsPaginatedResponse> => {
            return apiInstance.auditLogs.listLogs(filters)
        },
        enabled,
    })

    return { logsQuery }
}
