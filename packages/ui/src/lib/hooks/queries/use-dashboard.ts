import { useQuery, type UseQueryResult } from "@tanstack/react-query"

import { createApiContracts } from "@/lib/api"
import type {
    IDashboardApi,
    IDashboardFlowMetricsResponse,
    IDashboardMetricsResponse,
    IDashboardStatusDistributionResponse,
    IDashboardTeamActivityResponse,
    IDashboardTimelineResponse,
    IDashboardTokenUsageResponse,
    IDashboardWorkQueueResponse,
    TDashboardDateRange,
} from "@/lib/api/endpoints/dashboard.endpoint"
import { queryKeys } from "@/lib/query/query-keys"

const api: { readonly dashboard: IDashboardApi } = createApiContracts()

/**
 * Параметры хука dashboard.
 */
export interface IUseDashboardArgs {
    /** Диапазон дат для запросов с фильтрацией по времени. */
    readonly range?: TDashboardDateRange
    /** Включить/выключить автозагрузку. */
    readonly enabled?: boolean
}

/**
 * Возврат хука `useDashboard`.
 */
export interface IUseDashboardResult {
    /** Query KPI-метрик. */
    readonly metricsQuery: UseQueryResult<IDashboardMetricsResponse, Error>
    /** Query распределения статусов. */
    readonly statusDistributionQuery: UseQueryResult<IDashboardStatusDistributionResponse, Error>
    /** Query активности команды. */
    readonly teamActivityQuery: UseQueryResult<IDashboardTeamActivityResponse, Error>
    /** Query flow-метрик. */
    readonly flowMetricsQuery: UseQueryResult<IDashboardFlowMetricsResponse, Error>
    /** Query использования токенов. */
    readonly tokenUsageQuery: UseQueryResult<IDashboardTokenUsageResponse, Error>
    /** Query рабочей очереди. */
    readonly workQueueQuery: UseQueryResult<IDashboardWorkQueueResponse, Error>
    /** Query временной шкалы. */
    readonly timelineQuery: UseQueryResult<IDashboardTimelineResponse, Error>
}

/**
 * Хук для загрузки всех данных dashboard.
 *
 * Запускает параллельные запросы к 7 эндпоинтам dashboard API.
 * Диапазон дат применяется к 5 из 7 запросов (work queue и timeline не зависят от range).
 *
 * @param args Настройки.
 * @returns Состояние всех dashboard-запросов.
 */
export function useDashboard(args: IUseDashboardArgs = {}): IUseDashboardResult {
    const { range = "7d", enabled = true } = args

    const metricsQuery = useQuery({
        queryKey: queryKeys.dashboard.metrics(range),
        queryFn: async (): Promise<IDashboardMetricsResponse> => {
            return api.dashboard.getMetrics(range)
        },
        enabled,
    })

    const statusDistributionQuery = useQuery({
        queryKey: queryKeys.dashboard.statusDistribution(range),
        queryFn: async (): Promise<IDashboardStatusDistributionResponse> => {
            return api.dashboard.getStatusDistribution(range)
        },
        enabled,
    })

    const teamActivityQuery = useQuery({
        queryKey: queryKeys.dashboard.teamActivity(range),
        queryFn: async (): Promise<IDashboardTeamActivityResponse> => {
            return api.dashboard.getTeamActivity(range)
        },
        enabled,
    })

    const flowMetricsQuery = useQuery({
        queryKey: queryKeys.dashboard.flowMetrics(range),
        queryFn: async (): Promise<IDashboardFlowMetricsResponse> => {
            return api.dashboard.getFlowMetrics(range)
        },
        enabled,
    })

    const tokenUsageQuery = useQuery({
        queryKey: queryKeys.dashboard.tokenUsage(range),
        queryFn: async (): Promise<IDashboardTokenUsageResponse> => {
            return api.dashboard.getTokenUsage(range)
        },
        enabled,
    })

    const workQueueQuery = useQuery({
        queryKey: queryKeys.dashboard.workQueue(),
        queryFn: async (): Promise<IDashboardWorkQueueResponse> => {
            return api.dashboard.getWorkQueue()
        },
        enabled,
    })

    const timelineQuery = useQuery({
        queryKey: queryKeys.dashboard.timeline(),
        queryFn: async (): Promise<IDashboardTimelineResponse> => {
            return api.dashboard.getTimeline()
        },
        enabled,
    })

    return {
        metricsQuery,
        statusDistributionQuery,
        teamActivityQuery,
        flowMetricsQuery,
        tokenUsageQuery,
        workQueueQuery,
        timelineQuery,
    }
}
