import { useQuery, type UseQueryResult } from "@tanstack/react-query"

import { createApiContracts } from "@/lib/api"
import type {
    ITokenUsageApi,
    ITokenUsageResponse,
    TTokenUsageGroupBy,
    TTokenUsageRange,
} from "@/lib/api/endpoints/token-usage.endpoint"
import { queryKeys } from "@/lib/query/query-keys"

const apiInstance: { readonly tokenUsage: ITokenUsageApi } = createApiContracts()

/**
 * Параметры useTokenUsage().
 */
export interface IUseTokenUsageArgs {
    /**
     * Диапазон дат для выборки.
     */
    readonly range: TTokenUsageRange
    /**
     * Режим группировки.
     */
    readonly groupBy: TTokenUsageGroupBy
    /**
     * Включить/выключить автозагрузку.
     */
    readonly enabled?: boolean
}

/**
 * Результат useTokenUsage().
 */
export interface IUseTokenUsageResult {
    /**
     * Query данных token usage.
     */
    readonly usageQuery: UseQueryResult<ITokenUsageResponse, Error>
}

/**
 * React Query хук для загрузки данных о расходе токенов.
 *
 * Загружает агрегированные строки и сырые записи за указанный диапазон
 * с выбранной группировкой (по модели, разработчику или CCR).
 *
 * @param args - Конфигурация загрузки.
 * @returns Query с данными token usage.
 */
export function useTokenUsage(args: IUseTokenUsageArgs): IUseTokenUsageResult {
    const { range, groupBy, enabled = true } = args

    const usageQuery = useQuery({
        queryKey: queryKeys.tokenUsage.byRangeAndGroup(range, groupBy),
        queryFn: async (): Promise<ITokenUsageResponse> => {
            return apiInstance.tokenUsage.getUsage(range, groupBy)
        },
        enabled,
    })

    return { usageQuery }
}
