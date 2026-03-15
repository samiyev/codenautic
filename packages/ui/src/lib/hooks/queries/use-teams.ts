import {
    useMutation,
    useQuery,
    useQueryClient,
    type UseMutationResult,
    type UseQueryResult,
} from "@tanstack/react-query"

import { createApiContracts } from "@/lib/api"
import type {
    ICreateTeamRequest,
    IInviteTeamMemberRequest,
    IListTeamsResponse,
    IRemoveTeamMemberRequest,
    ITeamMemberResponse,
    ITeamResponse,
    ITeamsApi,
    IUpdateTeamMemberRoleRequest,
    IUpdateTeamRepositoriesRequest,
} from "@/lib/api/endpoints/teams.endpoint"
import { queryKeys } from "@/lib/query/query-keys"

const apiInstance: { readonly teams: ITeamsApi } = createApiContracts()

/**
 * Параметры useTeams().
 */
export interface IUseTeamsArgs {
    /**
     * Включить/выключить автозагрузку списка команд.
     */
    readonly enabled?: boolean
}

/**
 * Результат useTeams().
 */
export interface IUseTeamsResult {
    /**
     * Query списка команд.
     */
    readonly teamsQuery: UseQueryResult<IListTeamsResponse, Error>
    /**
     * Мутация создания команды.
     */
    readonly createTeam: UseMutationResult<ITeamResponse, Error, ICreateTeamRequest>
    /**
     * Мутация приглашения участника.
     */
    readonly inviteMember: UseMutationResult<
        ITeamMemberResponse,
        Error,
        IInviteTeamMemberRequest
    >
    /**
     * Мутация обновления роли участника.
     */
    readonly updateMemberRole: UseMutationResult<
        ITeamMemberResponse,
        Error,
        IUpdateTeamMemberRoleRequest
    >
    /**
     * Мутация удаления участника.
     */
    readonly removeMember: UseMutationResult<
        { readonly removed: boolean },
        Error,
        IRemoveTeamMemberRequest
    >
    /**
     * Мутация обновления назначенных репозиториев.
     */
    readonly updateRepositories: UseMutationResult<
        ITeamResponse,
        Error,
        IUpdateTeamRepositoriesRequest
    >
}

/**
 * React Query хук для CRUD-операций над командами.
 *
 * @param args - Конфигурация загрузки.
 * @returns Query списка и мутации create/invite/updateRole/remove/updateRepos.
 */
export function useTeams(args: IUseTeamsArgs = {}): IUseTeamsResult {
    const { enabled = true } = args
    const queryClient = useQueryClient()

    const teamsQuery = useQuery({
        queryKey: queryKeys.teams.list(),
        queryFn: async (): Promise<IListTeamsResponse> => {
            return apiInstance.teams.listTeams()
        },
        enabled,
    })

    const createTeam = useMutation<ITeamResponse, Error, ICreateTeamRequest>({
        mutationFn: async (data: ICreateTeamRequest): Promise<ITeamResponse> => {
            return apiInstance.teams.createTeam(data)
        },
        onSettled: async (): Promise<void> => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.teams.all() })
        },
    })

    const inviteMember = useMutation<
        ITeamMemberResponse,
        Error,
        IInviteTeamMemberRequest
    >({
        mutationFn: async (
            data: IInviteTeamMemberRequest,
        ): Promise<ITeamMemberResponse> => {
            return apiInstance.teams.inviteMember(data)
        },
        onSettled: async (): Promise<void> => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.teams.all() })
        },
    })

    const updateMemberRole = useMutation<
        ITeamMemberResponse,
        Error,
        IUpdateTeamMemberRoleRequest
    >({
        mutationFn: async (
            data: IUpdateTeamMemberRoleRequest,
        ): Promise<ITeamMemberResponse> => {
            return apiInstance.teams.updateMemberRole(data)
        },
        onSettled: async (): Promise<void> => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.teams.all() })
        },
    })

    const removeMember = useMutation<
        { readonly removed: boolean },
        Error,
        IRemoveTeamMemberRequest
    >({
        mutationFn: async (
            data: IRemoveTeamMemberRequest,
        ): Promise<{ readonly removed: boolean }> => {
            return apiInstance.teams.removeMember(data)
        },
        onSettled: async (): Promise<void> => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.teams.all() })
        },
    })

    const updateRepositories = useMutation<
        ITeamResponse,
        Error,
        IUpdateTeamRepositoriesRequest
    >({
        mutationFn: async (
            data: IUpdateTeamRepositoriesRequest,
        ): Promise<ITeamResponse> => {
            return apiInstance.teams.updateRepositories(data)
        },
        onSettled: async (): Promise<void> => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.teams.all() })
        },
    })

    return {
        teamsQuery,
        createTeam,
        inviteMember,
        updateMemberRole,
        removeMember,
        updateRepositories,
    }
}
