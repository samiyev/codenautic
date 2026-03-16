import {
    useMutation,
    useQuery,
    useQueryClient,
    type UseMutationResult,
    type UseQueryResult,
} from "@tanstack/react-query"

import { createApiContracts } from "@/lib/api"
import type {
    ILlmProviderConfig,
    ILlmProvidersApi,
    ILlmProvidersListResponse,
    ITestLlmProviderRequest,
    ITestLlmProviderResponse,
    IUpdateLlmProviderRequest,
    IUpdateLlmProviderResponse,
} from "@/lib/api/endpoints/llm-providers.endpoint"
import { queryKeys } from "@/lib/query/query-keys"

/**
 * Контекст для optimistic update при обновлении провайдера.
 */
type TLlmProvidersOptimisticContext = {
    readonly previousProviders?: ILlmProvidersListResponse
}

const apiInstance: { readonly llmProviders: ILlmProvidersApi } = createApiContracts()

/**
 * Параметры useLlmProviders().
 */
export interface IUseLlmProvidersArgs {
    /**
     * Включить/выключить автозагрузку конфигурации.
     */
    readonly enabled?: boolean
}

/**
 * Результат useLlmProviders().
 */
export interface IUseLlmProvidersResult {
    /**
     * Query списка конфигураций LLM провайдеров.
     */
    readonly configQuery: UseQueryResult<ILlmProvidersListResponse, Error>
    /**
     * Мутация обновления конфигурации провайдера.
     */
    readonly updateConfig: UseMutationResult<
        IUpdateLlmProviderResponse,
        Error,
        IUpdateLlmProviderRequest,
        TLlmProvidersOptimisticContext
    >
    /**
     * Мутация тестирования соединения с провайдером.
     */
    readonly testConnection: UseMutationResult<
        ITestLlmProviderResponse,
        Error,
        ITestLlmProviderRequest
    >
}

/**
 * Заменяет провайдера в списке по id.
 *
 * @param list - Текущий список провайдеров.
 * @param updated - Обновлённый провайдер.
 * @returns Новый список с заменённым провайдером.
 */
function replaceProviderInList(
    list: ILlmProvidersListResponse,
    updated: ILlmProviderConfig,
): ILlmProvidersListResponse {
    return {
        total: list.total,
        providers: list.providers.map((item): ILlmProviderConfig => {
            if (item.id !== updated.id) {
                return item
            }
            return updated
        }),
    }
}

/**
 * React Query хук для управления конфигурацией LLM провайдеров.
 *
 * @param args - Конфигурация загрузки.
 * @returns Query конфигурации и мутации update/test.
 */
export function useLlmProviders(args: IUseLlmProvidersArgs = {}): IUseLlmProvidersResult {
    const { enabled = true } = args
    const queryClient = useQueryClient()
    const listQueryKey = queryKeys.llmProviders.list()

    const configQuery = useQuery({
        queryKey: listQueryKey,
        queryFn: async (): Promise<ILlmProvidersListResponse> => {
            return apiInstance.llmProviders.getConfig()
        },
        enabled,
    })

    const updateConfig = useMutation<
        IUpdateLlmProviderResponse,
        Error,
        IUpdateLlmProviderRequest,
        TLlmProvidersOptimisticContext
    >({
        mutationFn: async (
            request: IUpdateLlmProviderRequest,
        ): Promise<IUpdateLlmProviderResponse> => {
            return apiInstance.llmProviders.updateConfig(request)
        },
        onMutate: async (
            request: IUpdateLlmProviderRequest,
        ): Promise<TLlmProvidersOptimisticContext> => {
            await queryClient.cancelQueries({ queryKey: listQueryKey })
            const previousProviders =
                queryClient.getQueryData<ILlmProvidersListResponse>(listQueryKey)
            if (previousProviders === undefined) {
                return { previousProviders }
            }

            queryClient.setQueryData<ILlmProvidersListResponse>(listQueryKey, {
                total: previousProviders.total,
                providers: previousProviders.providers.map((item): ILlmProviderConfig => {
                    if (item.id !== request.id) {
                        return item
                    }
                    return {
                        ...item,
                        model: request.model ?? item.model,
                        endpoint: request.endpoint ?? item.endpoint,
                    }
                }),
            })

            return { previousProviders }
        },
        onError: (_error, _request, context): void => {
            if (context?.previousProviders !== undefined) {
                queryClient.setQueryData(listQueryKey, context.previousProviders)
            }
        },
        onSuccess: (response): void => {
            const currentProviders =
                queryClient.getQueryData<ILlmProvidersListResponse>(listQueryKey)
            if (currentProviders === undefined) {
                return
            }

            queryClient.setQueryData(
                listQueryKey,
                replaceProviderInList(currentProviders, response.provider),
            )
        },
        onSettled: async (): Promise<void> => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.llmProviders.all() })
        },
    })

    const testConnection = useMutation<
        ITestLlmProviderResponse,
        Error,
        ITestLlmProviderRequest
    >({
        mutationFn: async (
            request: ITestLlmProviderRequest,
        ): Promise<ITestLlmProviderResponse> => {
            return apiInstance.llmProviders.testConnection(request)
        },
        onSuccess: (response): void => {
            const currentProviders =
                queryClient.getQueryData<ILlmProvidersListResponse>(listQueryKey)
            if (currentProviders === undefined) {
                return
            }

            queryClient.setQueryData<ILlmProvidersListResponse>(listQueryKey, {
                total: currentProviders.total,
                providers: currentProviders.providers.map((item): ILlmProviderConfig => {
                    if (item.id !== response.id) {
                        return item
                    }
                    return {
                        ...item,
                        connected: response.ok,
                        status: response.ok ? "CONNECTED" : "DEGRADED",
                        lastTestedAt: new Date().toISOString(),
                    }
                }),
            })
        },
        onSettled: async (): Promise<void> => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.llmProviders.all() })
        },
    })

    return {
        configQuery,
        updateConfig,
        testConnection,
    }
}
