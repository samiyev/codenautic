import { useQuery, type UseQueryResult } from "@tanstack/react-query"

import { createApiContracts } from "@/lib/api"
import type {
    IListRepositoriesResponse,
    IRepositoryApi,
    IRepositoryOverviewResponse,
} from "@/lib/api/endpoints/repository.endpoint"
import { queryKeys } from "@/lib/query/query-keys"

const api: { readonly repositories: IRepositoryApi } = createApiContracts()

/**
 * Параметры useRepositories().
 */
export interface IUseRepositoriesArgs {
    /**
     * Включить/выключить автозагрузку списка.
     */
    readonly enabled?: boolean
}

/**
 * Результат useRepositories().
 */
export interface IUseRepositoriesResult {
    /**
     * Query списка репозиториев.
     */
    readonly repositoriesQuery: UseQueryResult<IListRepositoriesResponse, Error>
}

/**
 * React Query хук для загрузки списка репозиториев.
 *
 * @param args - Конфигурация загрузки.
 * @returns Query для списка репозиториев.
 */
export function useRepositories(args: IUseRepositoriesArgs = {}): IUseRepositoriesResult {
    const { enabled = true } = args

    const repositoriesQuery = useQuery({
        queryKey: queryKeys.repositories.list(),
        queryFn: async (): Promise<IListRepositoriesResponse> => {
            return api.repositories.listRepositories()
        },
        enabled,
    })

    return { repositoriesQuery }
}

/**
 * Параметры useRepositoryOverview().
 */
export interface IUseRepositoryOverviewArgs {
    /**
     * Идентификатор репозитория.
     */
    readonly repositoryId: string
    /**
     * Включить/выключить автозагрузку.
     */
    readonly enabled?: boolean
}

/**
 * Результат useRepositoryOverview().
 */
export interface IUseRepositoryOverviewResult {
    /**
     * Query overview репозитория.
     */
    readonly overviewQuery: UseQueryResult<IRepositoryOverviewResponse, Error>
}

/**
 * React Query хук для загрузки overview конкретного репозитория.
 *
 * @param args - Конфигурация с repositoryId.
 * @returns Query для overview репозитория.
 */
export function useRepositoryOverview(args: IUseRepositoryOverviewArgs): IUseRepositoryOverviewResult {
    const { repositoryId, enabled = true } = args

    const overviewQuery = useQuery({
        queryKey: queryKeys.repositories.overview(repositoryId),
        queryFn: async (): Promise<IRepositoryOverviewResponse> => {
            return api.repositories.getOverview(repositoryId)
        },
        enabled: enabled && repositoryId.length > 0,
    })

    return { overviewQuery }
}
