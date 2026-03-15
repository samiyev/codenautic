import {
    useMutation,
    useQuery,
    useQueryClient,
    type UseMutationResult,
    type UseQueryResult,
} from "@tanstack/react-query"

import { createApiContracts } from "@/lib/api"
import type {
    ICreateReportRequest,
    IDeleteReportResponse,
    IReport,
    IReportData,
    IReportsApi,
    IReportsListResponse,
} from "@/lib/api/endpoints/reports.endpoint"
import { queryKeys } from "@/lib/query/query-keys"

const api: { readonly reports: IReportsApi } = createApiContracts()

/**
 * Параметры useReports().
 */
export interface IUseReportsArgs {
    /**
     * Включить/выключить автозагрузку.
     */
    readonly enabled?: boolean
}

/**
 * Результат useReports().
 */
export interface IUseReportsResult {
    /**
     * Query списка отчётов.
     */
    readonly reportsQuery: UseQueryResult<IReportsListResponse, Error>
    /**
     * Мутация создания отчёта.
     */
    readonly createReport: UseMutationResult<IReport, Error, ICreateReportRequest>
    /**
     * Мутация удаления отчёта.
     */
    readonly deleteReport: UseMutationResult<IDeleteReportResponse, Error, string>
}

/**
 * React Query хук для CRUD-операций над отчётами.
 *
 * Предоставляет query для списка и мутации create/delete
 * с автоматической инвалидацией кеша после мутаций.
 *
 * @param args - Конфигурация загрузки.
 * @returns Query списка и мутации create/delete.
 */
export function useReports(args: IUseReportsArgs = {}): IUseReportsResult {
    const { enabled = true } = args
    const queryClient = useQueryClient()

    const reportsQuery = useQuery({
        queryKey: queryKeys.reports.list(),
        queryFn: async (): Promise<IReportsListResponse> => {
            return api.reports.listReports()
        },
        enabled,
    })

    const createReport = useMutation<IReport, Error, ICreateReportRequest>({
        mutationFn: async (request: ICreateReportRequest): Promise<IReport> => {
            return api.reports.createReport(request)
        },
        onSettled: async (): Promise<void> => {
            await queryClient.invalidateQueries({
                queryKey: queryKeys.reports.all(),
            })
        },
    })

    const deleteReport = useMutation<IDeleteReportResponse, Error, string>({
        mutationFn: async (id: string): Promise<IDeleteReportResponse> => {
            return api.reports.deleteReport(id)
        },
        onSettled: async (): Promise<void> => {
            await queryClient.invalidateQueries({
                queryKey: queryKeys.reports.all(),
            })
        },
    })

    return { reportsQuery, createReport, deleteReport }
}

/**
 * Параметры useReportData().
 */
export interface IUseReportDataArgs {
    /**
     * Идентификатор отчёта.
     */
    readonly reportId: string
    /**
     * Включить/выключить автозагрузку.
     */
    readonly enabled?: boolean
}

/**
 * Результат useReportData().
 */
export interface IUseReportDataResult {
    /**
     * Query полных данных отчёта.
     */
    readonly reportDataQuery: UseQueryResult<IReportData, Error>
}

/**
 * React Query хук для загрузки полных данных отчёта.
 *
 * Загружает отчёт с трендами и распределением по ID.
 *
 * @param args - Конфигурация с reportId.
 * @returns Query для полных данных отчёта.
 */
export function useReportData(args: IUseReportDataArgs): IUseReportDataResult {
    const { reportId, enabled = true } = args

    const reportDataQuery = useQuery({
        queryKey: queryKeys.reports.byId(reportId),
        queryFn: async (): Promise<IReportData> => {
            return api.reports.getReport(reportId)
        },
        enabled: enabled && reportId.length > 0,
    })

    return { reportDataQuery }
}
