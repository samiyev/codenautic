import {
    useMutation,
    useQuery,
    useQueryClient,
    type UseMutationResult,
    type UseQueryResult,
} from "@tanstack/react-query"

import { createApiContracts } from "@/lib/api"
import type {
    IChannelPreferencesResponse,
    IInAppMuteRules,
    IMarkReadResponse,
    INotificationsApi,
    INotificationsListResponse,
    IMuteRulesResponse,
    TChannelPreferencesMap,
} from "@/lib/api/endpoints/notifications.endpoint"
import { queryKeys } from "@/lib/query/query-keys"

const api: { readonly notifications: INotificationsApi } = createApiContracts()

/**
 * Параметры useNotifications().
 */
export interface IUseNotificationsArgs {
    /**
     * Включить/выключить автозагрузку.
     */
    readonly enabled?: boolean
}

/**
 * Результат useNotifications().
 */
export interface IUseNotificationsResult {
    /**
     * Query истории уведомлений.
     */
    readonly historyQuery: UseQueryResult<INotificationsListResponse, Error>
    /**
     * Query канальных предпочтений.
     */
    readonly channelsQuery: UseQueryResult<IChannelPreferencesResponse, Error>
    /**
     * Query правил приглушения.
     */
    readonly muteRulesQuery: UseQueryResult<IMuteRulesResponse, Error>
    /**
     * Мутация отметки уведомления как прочитанного.
     */
    readonly markRead: UseMutationResult<IMarkReadResponse, Error, string>
    /**
     * Мутация обновления канальных предпочтений.
     */
    readonly updateChannels: UseMutationResult<
        IChannelPreferencesResponse,
        Error,
        TChannelPreferencesMap
    >
    /**
     * Мутация обновления правил приглушения.
     */
    readonly updateMuteRules: UseMutationResult<IMuteRulesResponse, Error, IInAppMuteRules>
}

/**
 * React Query хук для операций над уведомлениями.
 *
 * Предоставляет 3 query (история, каналы, mute rules) и 3 мутации
 * (markRead, updateChannels, updateMuteRules) с автоматической
 * инвалидацией кеша после мутаций.
 *
 * @param args - Конфигурация загрузки.
 * @returns Queries и мутации домена уведомлений.
 */
export function useNotifications(args: IUseNotificationsArgs = {}): IUseNotificationsResult {
    const { enabled = true } = args
    const queryClient = useQueryClient()

    const historyQuery = useQuery({
        queryKey: queryKeys.notifications.history(),
        queryFn: async (): Promise<INotificationsListResponse> => {
            return api.notifications.getHistory()
        },
        enabled,
    })

    const channelsQuery = useQuery({
        queryKey: queryKeys.notifications.channels(),
        queryFn: async (): Promise<IChannelPreferencesResponse> => {
            return api.notifications.getChannels()
        },
        enabled,
    })

    const muteRulesQuery = useQuery({
        queryKey: queryKeys.notifications.muteRules(),
        queryFn: async (): Promise<IMuteRulesResponse> => {
            return api.notifications.getMuteRules()
        },
        enabled,
    })

    const markRead = useMutation<IMarkReadResponse, Error, string>({
        mutationFn: async (id: string): Promise<IMarkReadResponse> => {
            return api.notifications.markRead(id)
        },
        onSettled: async (): Promise<void> => {
            await queryClient.invalidateQueries({
                queryKey: queryKeys.notifications.all(),
            })
        },
    })

    const updateChannels = useMutation<
        IChannelPreferencesResponse,
        Error,
        TChannelPreferencesMap
    >({
        mutationFn: async (
            channels: TChannelPreferencesMap,
        ): Promise<IChannelPreferencesResponse> => {
            return api.notifications.updateChannels(channels)
        },
        onSettled: async (): Promise<void> => {
            await queryClient.invalidateQueries({
                queryKey: queryKeys.notifications.channels(),
            })
        },
    })

    const updateMuteRules = useMutation<IMuteRulesResponse, Error, IInAppMuteRules>({
        mutationFn: async (muteRules: IInAppMuteRules): Promise<IMuteRulesResponse> => {
            return api.notifications.updateMuteRules(muteRules)
        },
        onSettled: async (): Promise<void> => {
            await queryClient.invalidateQueries({
                queryKey: queryKeys.notifications.muteRules(),
            })
        },
    })

    return {
        historyQuery,
        channelsQuery,
        muteRulesQuery,
        markRead,
        updateChannels,
        updateMuteRules,
    }
}
