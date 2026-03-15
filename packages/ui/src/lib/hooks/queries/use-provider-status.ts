import {
    useMutation,
    useQuery,
    useQueryClient,
    type UseMutationResult,
    type UseQueryResult,
} from "@tanstack/react-query"

import { createApiContracts } from "@/lib/api"
import type {
    IProviderStatusApi,
    IProviderStatusResponse,
    IQueueActionRequest,
    IQueuedAction,
} from "@/lib/api/endpoints/provider-status.endpoint"
import { queryKeys } from "@/lib/query/query-keys"

const apiInstance: { readonly providerStatus: IProviderStatusApi } = createApiContracts()

/**
 * Параметры useProviderStatus().
 */
export interface IUseProviderStatusArgs {
    /**
     * Включить/выключить автозагрузку.
     */
    readonly enabled?: boolean
}

/**
 * Результат useProviderStatus().
 */
export interface IUseProviderStatusResult {
    /**
     * Query данных provider status.
     */
    readonly statusQuery: UseQueryResult<IProviderStatusResponse, Error>
    /**
     * Mutation для добавления действия в очередь.
     */
    readonly queueActionMutation: UseMutationResult<IQueuedAction, Error, IQueueActionRequest>
}

/**
 * React Query хук для загрузки и управления статусом провайдеров.
 *
 * Загружает текущее состояние провайдера и очередь действий.
 * Предоставляет mutation для добавления действий в очередь.
 *
 * @param args - Конфигурация загрузки.
 * @returns Query со статусом и mutation для действий.
 */
export function useProviderStatus(args: IUseProviderStatusArgs = {}): IUseProviderStatusResult {
    const { enabled = true } = args
    const queryClient = useQueryClient()

    const statusQuery = useQuery({
        queryKey: queryKeys.providerStatus.all(),
        queryFn: async (): Promise<IProviderStatusResponse> => {
            return apiInstance.providerStatus.getStatus()
        },
        enabled,
    })

    const queueActionMutation = useMutation({
        mutationFn: async (request: IQueueActionRequest): Promise<IQueuedAction> => {
            return apiInstance.providerStatus.queueAction(request)
        },
        onSuccess: async (): Promise<void> => {
            await queryClient.invalidateQueries({
                queryKey: queryKeys.providerStatus.all(),
            })
        },
    })

    return { statusQuery, queueActionMutation }
}
