import type { IHttpClient } from "../http-client"

/**
 * Допустимые роли участника команды.
 */
export type TTeamMemberRole = "admin" | "developer" | "lead" | "viewer"

/**
 * Участник команды.
 */
export interface ITeamMember {
    /**
     * Уникальный идентификатор участника в пределах команды.
     */
    readonly id: string
    /**
     * Отображаемое имя участника.
     */
    readonly name: string
    /**
     * Рабочий email участника.
     */
    readonly email: string
    /**
     * Роль участника внутри команды.
     */
    readonly role: TTeamMemberRole
}

/**
 * Команда с участниками и назначенными репозиториями.
 */
export interface ITeam {
    /**
     * Уникальный идентификатор команды.
     */
    readonly id: string
    /**
     * Название команды.
     */
    readonly name: string
    /**
     * Краткое описание команды.
     */
    readonly description: string
    /**
     * Назначенные репозитории.
     */
    readonly repositories: ReadonlyArray<string>
    /**
     * Участники команды.
     */
    readonly members: ReadonlyArray<ITeamMember>
}

/**
 * Запрос на создание новой команды.
 */
export interface ICreateTeamRequest {
    /**
     * Название команды.
     */
    readonly name: string
    /**
     * Краткое описание команды.
     */
    readonly description: string
}

/**
 * Запрос на приглашение участника в команду.
 */
export interface IInviteTeamMemberRequest {
    /**
     * Идентификатор команды.
     */
    readonly teamId: string
    /**
     * Email приглашаемого участника.
     */
    readonly email: string
    /**
     * Назначаемая роль.
     */
    readonly role: TTeamMemberRole
}

/**
 * Запрос на обновление роли участника команды.
 */
export interface IUpdateTeamMemberRoleRequest {
    /**
     * Идентификатор команды.
     */
    readonly teamId: string
    /**
     * Идентификатор участника.
     */
    readonly memberId: string
    /**
     * Новая роль.
     */
    readonly role: TTeamMemberRole
}

/**
 * Запрос на удаление участника из команды.
 */
export interface IRemoveTeamMemberRequest {
    /**
     * Идентификатор команды.
     */
    readonly teamId: string
    /**
     * Идентификатор участника.
     */
    readonly memberId: string
}

/**
 * Запрос на обновление назначенных репозиториев.
 */
export interface IUpdateTeamRepositoriesRequest {
    /**
     * Идентификатор команды.
     */
    readonly teamId: string
    /**
     * Обновлённый набор идентификаторов репозиториев.
     */
    readonly repositoryIds: ReadonlyArray<string>
}

/**
 * Ответ списка команд.
 */
export interface IListTeamsResponse {
    /**
     * Массив команд.
     */
    readonly teams: ReadonlyArray<ITeam>
    /**
     * Общее количество.
     */
    readonly total: number
}

/**
 * Ответ с одной командой.
 */
export interface ITeamResponse {
    /**
     * Данные команды.
     */
    readonly team: ITeam
}

/**
 * Ответ с участником команды.
 */
export interface ITeamMemberResponse {
    /**
     * Данные участника.
     */
    readonly member: ITeamMember
}

/**
 * API-контракт управления командами.
 */
export interface ITeamsApi {
    /**
     * Возвращает список всех команд с участниками.
     */
    listTeams(): Promise<IListTeamsResponse>

    /**
     * Создаёт новую команду.
     *
     * @param data - Данные для создания команды.
     */
    createTeam(data: ICreateTeamRequest): Promise<ITeamResponse>

    /**
     * Приглашает участника в команду.
     *
     * @param data - Данные приглашения.
     */
    inviteMember(data: IInviteTeamMemberRequest): Promise<ITeamMemberResponse>

    /**
     * Обновляет роль участника команды.
     *
     * @param data - Данные обновления роли.
     */
    updateMemberRole(data: IUpdateTeamMemberRoleRequest): Promise<ITeamMemberResponse>

    /**
     * Удаляет участника из команды.
     *
     * @param data - Данные удаления.
     */
    removeMember(data: IRemoveTeamMemberRequest): Promise<{ readonly removed: boolean }>

    /**
     * Обновляет назначенные репозитории команды.
     *
     * @param data - Данные обновления.
     */
    updateRepositories(data: IUpdateTeamRepositoriesRequest): Promise<ITeamResponse>
}

/**
 * Endpoint-клиент Teams API.
 */
export class TeamsApi implements ITeamsApi {
    /**
     * HTTP-клиент для запросов.
     */
    private readonly httpClient: IHttpClient

    /**
     * Создаёт экземпляр TeamsApi.
     *
     * @param httpClient - HTTP-клиент.
     */
    public constructor(httpClient: IHttpClient) {
        this.httpClient = httpClient
    }

    /**
     * Возвращает список всех команд с участниками.
     *
     * @returns Ответ со списком команд и общим количеством.
     */
    public async listTeams(): Promise<IListTeamsResponse> {
        return this.httpClient.request<IListTeamsResponse>({
            method: "GET",
            path: "/api/v1/teams",
            credentials: "include",
        })
    }

    /**
     * Создаёт новую команду.
     *
     * @param data - Данные для создания команды.
     * @returns Ответ с созданной командой.
     */
    public async createTeam(data: ICreateTeamRequest): Promise<ITeamResponse> {
        return this.httpClient.request<ITeamResponse>({
            method: "POST",
            path: "/api/v1/teams",
            body: data,
            credentials: "include",
        })
    }

    /**
     * Приглашает участника в команду.
     *
     * @param data - Данные приглашения.
     * @returns Ответ с данными нового участника.
     */
    public async inviteMember(data: IInviteTeamMemberRequest): Promise<ITeamMemberResponse> {
        return this.httpClient.request<ITeamMemberResponse>({
            method: "POST",
            path: `/api/v1/teams/${encodeURIComponent(data.teamId)}/members`,
            body: { email: data.email, role: data.role },
            credentials: "include",
        })
    }

    /**
     * Обновляет роль участника команды.
     *
     * @param data - Данные обновления роли.
     * @returns Ответ с обновлёнными данными участника.
     */
    public async updateMemberRole(
        data: IUpdateTeamMemberRoleRequest,
    ): Promise<ITeamMemberResponse> {
        return this.httpClient.request<ITeamMemberResponse>({
            method: "PATCH",
            path: `/api/v1/teams/${encodeURIComponent(data.teamId)}/members/${encodeURIComponent(data.memberId)}`,
            body: { role: data.role },
            credentials: "include",
        })
    }

    /**
     * Удаляет участника из команды.
     *
     * @param data - Данные удаления.
     * @returns Ответ с флагом успешности.
     */
    public async removeMember(
        data: IRemoveTeamMemberRequest,
    ): Promise<{ readonly removed: boolean }> {
        return this.httpClient.request<{ readonly removed: boolean }>({
            method: "DELETE",
            path: `/api/v1/teams/${encodeURIComponent(data.teamId)}/members/${encodeURIComponent(data.memberId)}`,
            credentials: "include",
        })
    }

    /**
     * Обновляет назначенные репозитории команды.
     *
     * @param data - Данные обновления.
     * @returns Ответ с обновлённой командой.
     */
    public async updateRepositories(
        data: IUpdateTeamRepositoriesRequest,
    ): Promise<ITeamResponse> {
        return this.httpClient.request<ITeamResponse>({
            method: "PUT",
            path: `/api/v1/teams/${encodeURIComponent(data.teamId)}/repositories`,
            body: { repositoryIds: data.repositoryIds },
            credentials: "include",
        })
    }
}
