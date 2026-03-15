import type { IHttpClient } from "../http-client"

/**
 * Допустимые названия тарифных планов.
 */
export type TPlanName = "enterprise" | "pro" | "starter"

/**
 * Допустимые статусы биллинга.
 */
export type TBillingStatus = "active" | "past_due" | "trial"

/**
 * Допустимые роли участника организации.
 */
export type TOrgMemberRole = "admin" | "developer" | "lead" | "viewer"

/**
 * Профиль организации.
 */
export interface IOrganizationProfile {
    /**
     * Название организации.
     */
    readonly name: string
    /**
     * URL slug организации.
     */
    readonly slug: string
    /**
     * Часовой пояс по умолчанию.
     */
    readonly timezone: string
    /**
     * Email-домен организации.
     */
    readonly domain: string
}

/**
 * Состояние биллинга организации.
 */
export interface IBillingState {
    /**
     * Текущий тарифный план.
     */
    readonly plan: TPlanName
    /**
     * Статус биллинга.
     */
    readonly status: TBillingStatus
    /**
     * Количество используемых мест.
     */
    readonly seatsUsed: number
    /**
     * Общее количество мест в плане.
     */
    readonly seatsTotal: number
    /**
     * Дата следующего продления (ISO 8601).
     */
    readonly renewalAt: string
    /**
     * Метка платёжного метода.
     */
    readonly paymentMethod: string
}

/**
 * Участник организации.
 */
export interface IOrgMember {
    /**
     * Уникальный идентификатор участника.
     */
    readonly id: string
    /**
     * Отображаемое имя.
     */
    readonly name: string
    /**
     * Рабочий email.
     */
    readonly email: string
    /**
     * Роль в организации.
     */
    readonly role: TOrgMemberRole
}

/**
 * Запрос на обновление профиля организации.
 */
export interface IUpdateOrgProfileRequest {
    /**
     * Новое название организации.
     */
    readonly name?: string
    /**
     * Новый URL slug.
     */
    readonly slug?: string
    /**
     * Новый часовой пояс.
     */
    readonly timezone?: string
    /**
     * Новый email-домен.
     */
    readonly domain?: string
}

/**
 * Запрос на приглашение участника в организацию.
 */
export interface IInviteOrgMemberRequest {
    /**
     * Email приглашаемого участника.
     */
    readonly email: string
    /**
     * Назначаемая роль.
     */
    readonly role: TOrgMemberRole
}

/**
 * Запрос на обновление роли участника организации.
 */
export interface IUpdateOrgMemberRoleRequest {
    /**
     * Идентификатор участника.
     */
    readonly memberId: string
    /**
     * Новая роль.
     */
    readonly role: TOrgMemberRole
}

/**
 * Запрос на удаление участника из организации.
 */
export interface IRemoveOrgMemberRequest {
    /**
     * Идентификатор участника.
     */
    readonly memberId: string
}

/**
 * Запрос на обновление тарифного плана.
 */
export interface IUpdatePlanRequest {
    /**
     * Новый тарифный план.
     */
    readonly plan: TPlanName
}

/**
 * Ответ с профилем организации.
 */
export interface IOrgProfileResponse {
    /**
     * Профиль организации.
     */
    readonly profile: IOrganizationProfile
}

/**
 * Ответ со списком участников организации.
 */
export interface IOrgMembersResponse {
    /**
     * Массив участников.
     */
    readonly members: ReadonlyArray<IOrgMember>
    /**
     * Общее количество.
     */
    readonly total: number
}

/**
 * Ответ с данными одного участника организации.
 */
export interface IOrgMemberResponse {
    /**
     * Данные участника.
     */
    readonly member: IOrgMember
}

/**
 * Ответ с состоянием биллинга.
 */
export interface IBillingResponse {
    /**
     * Данные биллинга.
     */
    readonly billing: IBillingState
}

/**
 * API-контракт управления организацией.
 */
export interface IOrganizationApi {
    /**
     * Возвращает профиль организации.
     */
    getProfile(): Promise<IOrgProfileResponse>

    /**
     * Обновляет профиль организации.
     *
     * @param data - Частичные данные для обновления.
     */
    updateProfile(data: IUpdateOrgProfileRequest): Promise<IOrgProfileResponse>

    /**
     * Возвращает список участников организации.
     */
    getMembers(): Promise<IOrgMembersResponse>

    /**
     * Приглашает нового участника в организацию.
     *
     * @param data - Данные приглашения.
     */
    inviteMember(data: IInviteOrgMemberRequest): Promise<IOrgMemberResponse>

    /**
     * Обновляет роль участника организации.
     *
     * @param data - Данные обновления роли.
     */
    updateMemberRole(data: IUpdateOrgMemberRoleRequest): Promise<IOrgMemberResponse>

    /**
     * Удаляет участника из организации.
     *
     * @param data - Данные удаления.
     */
    removeMember(data: IRemoveOrgMemberRequest): Promise<{ readonly removed: boolean }>

    /**
     * Возвращает состояние биллинга.
     */
    getBilling(): Promise<IBillingResponse>

    /**
     * Обновляет тарифный план организации.
     *
     * @param data - Данные обновления плана.
     */
    updatePlan(data: IUpdatePlanRequest): Promise<IBillingResponse>
}

/**
 * Endpoint-клиент Organization API.
 */
export class OrganizationApi implements IOrganizationApi {
    /**
     * HTTP-клиент для запросов.
     */
    private readonly httpClient: IHttpClient

    /**
     * Создаёт экземпляр OrganizationApi.
     *
     * @param httpClient - HTTP-клиент.
     */
    public constructor(httpClient: IHttpClient) {
        this.httpClient = httpClient
    }

    /**
     * Возвращает профиль организации.
     *
     * @returns Ответ с профилем организации.
     */
    public async getProfile(): Promise<IOrgProfileResponse> {
        return this.httpClient.request<IOrgProfileResponse>({
            method: "GET",
            path: "/api/v1/organization/profile",
            credentials: "include",
        })
    }

    /**
     * Обновляет профиль организации.
     *
     * @param data - Частичные данные для обновления.
     * @returns Ответ с обновлённым профилем.
     */
    public async updateProfile(data: IUpdateOrgProfileRequest): Promise<IOrgProfileResponse> {
        return this.httpClient.request<IOrgProfileResponse>({
            method: "PATCH",
            path: "/api/v1/organization/profile",
            body: data,
            credentials: "include",
        })
    }

    /**
     * Возвращает список участников организации.
     *
     * @returns Ответ со списком участников.
     */
    public async getMembers(): Promise<IOrgMembersResponse> {
        return this.httpClient.request<IOrgMembersResponse>({
            method: "GET",
            path: "/api/v1/organization/members",
            credentials: "include",
        })
    }

    /**
     * Приглашает нового участника в организацию.
     *
     * @param data - Данные приглашения.
     * @returns Ответ с данными нового участника.
     */
    public async inviteMember(data: IInviteOrgMemberRequest): Promise<IOrgMemberResponse> {
        return this.httpClient.request<IOrgMemberResponse>({
            method: "POST",
            path: "/api/v1/organization/members",
            body: data,
            credentials: "include",
        })
    }

    /**
     * Обновляет роль участника организации.
     *
     * @param data - Данные обновления роли.
     * @returns Ответ с обновлёнными данными участника.
     */
    public async updateMemberRole(
        data: IUpdateOrgMemberRoleRequest,
    ): Promise<IOrgMemberResponse> {
        return this.httpClient.request<IOrgMemberResponse>({
            method: "PATCH",
            path: `/api/v1/organization/members/${encodeURIComponent(data.memberId)}`,
            body: { role: data.role },
            credentials: "include",
        })
    }

    /**
     * Удаляет участника из организации.
     *
     * @param data - Данные удаления.
     * @returns Ответ с флагом успешности.
     */
    public async removeMember(
        data: IRemoveOrgMemberRequest,
    ): Promise<{ readonly removed: boolean }> {
        return this.httpClient.request<{ readonly removed: boolean }>({
            method: "DELETE",
            path: `/api/v1/organization/members/${encodeURIComponent(data.memberId)}`,
            credentials: "include",
        })
    }

    /**
     * Возвращает состояние биллинга.
     *
     * @returns Ответ с данными биллинга.
     */
    public async getBilling(): Promise<IBillingResponse> {
        return this.httpClient.request<IBillingResponse>({
            method: "GET",
            path: "/api/v1/organization/billing",
            credentials: "include",
        })
    }

    /**
     * Обновляет тарифный план организации.
     *
     * @param data - Данные обновления плана.
     * @returns Ответ с обновлённым состоянием биллинга.
     */
    public async updatePlan(data: IUpdatePlanRequest): Promise<IBillingResponse> {
        return this.httpClient.request<IBillingResponse>({
            method: "PATCH",
            path: "/api/v1/organization/billing/plan",
            body: data,
            credentials: "include",
        })
    }
}
