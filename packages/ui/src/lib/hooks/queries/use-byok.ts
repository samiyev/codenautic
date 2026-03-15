import {
    useMutation,
    useQuery,
    useQueryClient,
    type UseMutationResult,
    type UseQueryResult,
} from "@tanstack/react-query"

import { createApiContracts } from "@/lib/api"
import type {
    IByokApi,
    IByokKeyResponse,
    IByokListResponse,
    ICreateByokKeyRequest,
    IToggleByokKeyRequest,
} from "@/lib/api/endpoints/byok.endpoint"
import { queryKeys } from "@/lib/query/query-keys"

const apiInstance: { readonly byok: IByokApi } = createApiContracts()

/**
 * Параметры useByok().
 */
export interface IUseByokArgs {
    /**
     * Включить/выключить автозагрузку списка ключей.
     */
    readonly enabled?: boolean
}

/**
 * Результат useByok().
 */
export interface IUseByokResult {
    /**
     * Query списка BYOK ключей.
     */
    readonly keysQuery: UseQueryResult<IByokListResponse, Error>
    /**
     * Мутация создания нового ключа.
     */
    readonly createKey: UseMutationResult<IByokKeyResponse, Error, ICreateByokKeyRequest>
    /**
     * Мутация удаления ключа.
     */
    readonly deleteKey: UseMutationResult<{ readonly removed: boolean }, Error, string>
    /**
     * Мутация ротации секрета ключа.
     */
    readonly rotateKey: UseMutationResult<IByokKeyResponse, Error, string>
    /**
     * Мутация переключения активности ключа.
     */
    readonly toggleKey: UseMutationResult<IByokKeyResponse, Error, IToggleByokKeyRequest>
}

/**
 * React Query хук для CRUD-операций над BYOK ключами.
 *
 * @param args - Конфигурация загрузки.
 * @returns Query списка и мутации create/delete/rotate/toggle.
 */
export function useByok(args: IUseByokArgs = {}): IUseByokResult {
    const { enabled = true } = args
    const queryClient = useQueryClient()

    const keysQuery = useQuery({
        queryKey: queryKeys.byok.list(),
        queryFn: async (): Promise<IByokListResponse> => {
            return apiInstance.byok.listKeys()
        },
        enabled,
    })

    const createKey = useMutation<IByokKeyResponse, Error, ICreateByokKeyRequest>({
        mutationFn: async (data: ICreateByokKeyRequest): Promise<IByokKeyResponse> => {
            return apiInstance.byok.createKey(data)
        },
        onSettled: async (): Promise<void> => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.byok.all() })
        },
    })

    const deleteKey = useMutation<{ readonly removed: boolean }, Error, string>({
        mutationFn: async (keyId: string): Promise<{ readonly removed: boolean }> => {
            return apiInstance.byok.deleteKey(keyId)
        },
        onSettled: async (): Promise<void> => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.byok.all() })
        },
    })

    const rotateKey = useMutation<IByokKeyResponse, Error, string>({
        mutationFn: async (keyId: string): Promise<IByokKeyResponse> => {
            return apiInstance.byok.rotateKey(keyId)
        },
        onSettled: async (): Promise<void> => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.byok.all() })
        },
    })

    const toggleKey = useMutation<IByokKeyResponse, Error, IToggleByokKeyRequest>({
        mutationFn: async (data: IToggleByokKeyRequest): Promise<IByokKeyResponse> => {
            return apiInstance.byok.toggleKey(data)
        },
        onSettled: async (): Promise<void> => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.byok.all() })
        },
    })

    return {
        keysQuery,
        createKey,
        deleteKey,
        rotateKey,
        toggleKey,
    }
}
