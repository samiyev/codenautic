import {
    useMutation,
    useQuery,
    useQueryClient,
    type UseMutationResult,
    type UseQueryResult,
} from "@tanstack/react-query"

import { createApiContracts } from "@/lib/api"
import type {
    ICreateWebhookRequest,
    IDeleteWebhookRequest,
    IDeleteWebhookResponse,
    IUpdateWebhookRequest,
    IWebhookEndpoint,
    IWebhooksApi,
    IWebhooksListResponse,
} from "@/lib/api/endpoints/webhooks.endpoint"
import { queryKeys } from "@/lib/query/query-keys"

const apiInstance: { readonly webhooks: IWebhooksApi } = createApiContracts()

/**
 * Параметры useWebhooks().
 */
export interface IUseWebhooksArgs {
    /**
     * Включить/выключить автозагрузку.
     */
    readonly enabled?: boolean
}

/**
 * Результат useWebhooks().
 */
export interface IUseWebhooksResult {
    /**
     * Query списка webhook endpoints и delivery logs.
     */
    readonly webhooksQuery: UseQueryResult<IWebhooksListResponse, Error>
    /**
     * Мутация создания webhook endpoint.
     */
    readonly createWebhook: UseMutationResult<IWebhookEndpoint, Error, ICreateWebhookRequest>
    /**
     * Мутация обновления webhook endpoint.
     */
    readonly updateWebhook: UseMutationResult<IWebhookEndpoint, Error, IUpdateWebhookRequest>
    /**
     * Мутация удаления webhook endpoint.
     */
    readonly deleteWebhook: UseMutationResult<
        IDeleteWebhookResponse,
        Error,
        IDeleteWebhookRequest
    >
}

/**
 * React Query хук для webhook management.
 *
 * Загружает endpoints и delivery logs.
 * Предоставляет мутации для CRUD операций над webhooks.
 *
 * @param args - Конфигурация загрузки.
 * @returns Query и мутации для webhooks.
 */
export function useWebhooks(args: IUseWebhooksArgs = {}): IUseWebhooksResult {
    const { enabled = true } = args
    const queryClient = useQueryClient()

    const webhooksQuery = useQuery({
        queryKey: queryKeys.webhooks.all(),
        queryFn: async (): Promise<IWebhooksListResponse> => {
            return apiInstance.webhooks.list()
        },
        enabled,
    })

    const createWebhook = useMutation<IWebhookEndpoint, Error, ICreateWebhookRequest>({
        mutationFn: async (request: ICreateWebhookRequest): Promise<IWebhookEndpoint> => {
            return apiInstance.webhooks.create(request)
        },
        onSettled: async (): Promise<void> => {
            await queryClient.invalidateQueries({
                queryKey: queryKeys.webhooks.all(),
            })
        },
    })

    const updateWebhook = useMutation<IWebhookEndpoint, Error, IUpdateWebhookRequest>({
        mutationFn: async (request: IUpdateWebhookRequest): Promise<IWebhookEndpoint> => {
            return apiInstance.webhooks.update(request)
        },
        onSettled: async (): Promise<void> => {
            await queryClient.invalidateQueries({
                queryKey: queryKeys.webhooks.all(),
            })
        },
    })

    const deleteWebhook = useMutation<IDeleteWebhookResponse, Error, IDeleteWebhookRequest>({
        mutationFn: async (request: IDeleteWebhookRequest): Promise<IDeleteWebhookResponse> => {
            return apiInstance.webhooks.remove(request)
        },
        onSettled: async (): Promise<void> => {
            await queryClient.invalidateQueries({
                queryKey: queryKeys.webhooks.all(),
            })
        },
    })

    return {
        webhooksQuery,
        createWebhook,
        updateWebhook,
        deleteWebhook,
    }
}
