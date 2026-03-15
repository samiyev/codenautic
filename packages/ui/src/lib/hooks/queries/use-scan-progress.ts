import { useQuery, type UseQueryResult } from "@tanstack/react-query"

import { createApiContracts } from "@/lib/api"
import type {
    IScanProgressApi,
    IScanProgressResponse,
} from "@/lib/api/endpoints/scan-progress.endpoint"
import { queryKeys } from "@/lib/query/query-keys"

/**
 * Интервал polling в миллисекундах.
 */
const POLL_INTERVAL_MS = 3000

const apiInstance: { readonly scanProgress: IScanProgressApi } = createApiContracts()

/**
 * Параметры useScanProgress().
 */
export interface IUseScanProgressArgs {
    /**
     * Идентификатор задания сканирования.
     */
    readonly jobId: string
    /**
     * Включить/выключить автозагрузку и polling.
     */
    readonly enabled?: boolean
}

/**
 * Результат useScanProgress().
 */
export interface IUseScanProgressResult {
    /**
     * Query данных прогресса сканирования.
     */
    readonly progressQuery: UseQueryResult<IScanProgressResponse, Error>
}

/**
 * React Query хук для polling прогресса сканирования.
 *
 * Загружает события прогресса для заданного jobId.
 * Использует refetchInterval для автоматического polling.
 * Polling останавливается при percent >= 100.
 *
 * @param args - Конфигурация загрузки.
 * @returns Query с данными прогресса.
 */
export function useScanProgress(args: IUseScanProgressArgs): IUseScanProgressResult {
    const { jobId, enabled = true } = args

    const progressQuery = useQuery({
        queryKey: queryKeys.scanProgress.byJobId(jobId),
        queryFn: async (): Promise<IScanProgressResponse> => {
            return apiInstance.scanProgress.getProgress(jobId)
        },
        enabled,
        refetchInterval: (query): number | false => {
            const data = query.state.data
            if (data === undefined) {
                return POLL_INTERVAL_MS
            }
            const lastEvent = data.events.at(-1)
            if (lastEvent !== undefined && lastEvent.percent >= 100) {
                return false
            }
            return POLL_INTERVAL_MS
        },
    })

    return { progressQuery }
}
