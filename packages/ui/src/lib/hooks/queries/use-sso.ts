import {
    useMutation,
    useQuery,
    useQueryClient,
    type UseMutationResult,
    type UseQueryResult,
} from "@tanstack/react-query"

import { createApiContracts } from "@/lib/api"
import type {
    IOidcConfig,
    IOidcConfigResponse,
    ISamlConfig,
    ISamlConfigResponse,
    ISsoApi,
    ISsoTestRequest,
    ISsoTestResponse,
} from "@/lib/api/endpoints/sso.endpoint"
import { queryKeys } from "@/lib/query/query-keys"

const apiInstance: { readonly sso: ISsoApi } = createApiContracts()

/**
 * Параметры useSso().
 */
export interface IUseSsoArgs {
    /**
     * Включить/выключить автозагрузку конфигураций.
     */
    readonly enabled?: boolean
}

/**
 * Результат useSso().
 */
export interface IUseSsoResult {
    /**
     * Query SAML конфигурации.
     */
    readonly samlQuery: UseQueryResult<ISamlConfigResponse, Error>
    /**
     * Query OIDC конфигурации.
     */
    readonly oidcQuery: UseQueryResult<IOidcConfigResponse, Error>
    /**
     * Мутация обновления SAML конфигурации.
     */
    readonly updateSaml: UseMutationResult<ISamlConfigResponse, Error, ISamlConfig>
    /**
     * Мутация обновления OIDC конфигурации.
     */
    readonly updateOidc: UseMutationResult<IOidcConfigResponse, Error, IOidcConfig>
    /**
     * Мутация тестирования SSO подключения.
     */
    readonly testConnection: UseMutationResult<ISsoTestResponse, Error, ISsoTestRequest>
}

/**
 * React Query хук для SSO конфигурации (SAML + OIDC).
 *
 * @param args - Конфигурация загрузки.
 * @returns Queries SAML/OIDC и мутации updateSaml/updateOidc/testConnection.
 */
export function useSso(args: IUseSsoArgs = {}): IUseSsoResult {
    const { enabled = true } = args
    const queryClient = useQueryClient()

    const samlQuery = useQuery({
        queryKey: queryKeys.sso.saml(),
        queryFn: async (): Promise<ISamlConfigResponse> => {
            return apiInstance.sso.getSamlConfig()
        },
        enabled,
    })

    const oidcQuery = useQuery({
        queryKey: queryKeys.sso.oidc(),
        queryFn: async (): Promise<IOidcConfigResponse> => {
            return apiInstance.sso.getOidcConfig()
        },
        enabled,
    })

    const updateSaml = useMutation<ISamlConfigResponse, Error, ISamlConfig>({
        mutationFn: async (data: ISamlConfig): Promise<ISamlConfigResponse> => {
            return apiInstance.sso.updateSamlConfig(data)
        },
        onSettled: async (): Promise<void> => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.sso.all() })
        },
    })

    const updateOidc = useMutation<IOidcConfigResponse, Error, IOidcConfig>({
        mutationFn: async (data: IOidcConfig): Promise<IOidcConfigResponse> => {
            return apiInstance.sso.updateOidcConfig(data)
        },
        onSettled: async (): Promise<void> => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.sso.all() })
        },
    })

    const testConnection = useMutation<ISsoTestResponse, Error, ISsoTestRequest>({
        mutationFn: async (data: ISsoTestRequest): Promise<ISsoTestResponse> => {
            return apiInstance.sso.testConnection(data)
        },
    })

    return {
        samlQuery,
        oidcQuery,
        updateSaml,
        updateOidc,
        testConnection,
    }
}
