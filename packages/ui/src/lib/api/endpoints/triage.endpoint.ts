import type { IHttpClient } from "../http-client"

/** Категория triage item. */
export type TTriageCategory =
    | "assigned_ccr"
    | "critical_issue"
    | "inbox_notification"
    | "pending_approval"
    | "stuck_job"

/** Приоритет/severity triage item. */
export type TTriageSeverity = "critical" | "high" | "medium"

/** Scope фильтрации triage. */
export type TTriageScope = "mine" | "repo" | "team"

/** Статус жизненного цикла triage item. */
export type TTriageStatus = "assigned" | "blocked" | "done" | "in_progress" | "snoozed" | "unassigned"

/** Владелец triage item. */
export type TTriageOwner = "me" | "team" | "unassigned"

/** Уровень эскалации. */
export type TTriageEscalationLevel = "none" | "warn" | "critical"

/** Действие над triage item. */
export type TTriageAction =
    | "assign_to_me"
    | "escalate"
    | "mark_done"
    | "mark_read"
    | "open_context"
    | "snooze"
    | "start_work"

/** Triage item в unified triage hub. */
export interface ITriageItem {
    /** Идентификатор triage item. */
    readonly id: string
    /** Категория triage. */
    readonly category: TTriageCategory
    /** Заголовок item. */
    readonly title: string
    /** Приоритет/severity. */
    readonly severity: TTriageSeverity
    /** Репозиторий источника. */
    readonly repository: string
    /** Owner item. */
    readonly owner: TTriageOwner
    /** Deep-link в целевой контекст. */
    readonly deepLink: string
    /** Временная метка (ISO 8601). */
    readonly timestamp: string
    /** Read status. */
    readonly isRead: boolean
    /** Lifecycle status. */
    readonly status: TTriageStatus
    /** Deadline для SLA (ISO 8601). */
    readonly dueAt: string
    /** Целевой SLA в минутах. */
    readonly slaMinutes: number
    /** Уровень эскалации. */
    readonly escalationLevel: TTriageEscalationLevel
}

/** Ответ списка triage items. */
export interface ITriageListResponse {
    /** Отфильтрованный список triage items. */
    readonly items: readonly ITriageItem[]
    /** Полное количество для пагинации. */
    readonly total: number
}

/** Параметры фильтрации triage. */
export interface IListTriageQuery {
    /** Scope фильтрации (mine/team/repo). */
    readonly scope?: TTriageScope
}

/** Запрос на выполнение действия над triage item. */
export interface IPerformTriageActionRequest {
    /** Идентификатор triage item. */
    readonly id: string
    /** Действие для выполнения. */
    readonly action: TTriageAction
}

/** Результат выполнения действия над triage item. */
export interface IPerformTriageActionResponse {
    /** Обновлённый triage item после действия. */
    readonly item: ITriageItem
}

/** Контракт triage API. */
export interface ITriageApi {
    /** Возвращает отфильтрованный список triage items. */
    listItems(query?: IListTriageQuery): Promise<ITriageListResponse>

    /** Выполняет действие над triage item. */
    performAction(request: IPerformTriageActionRequest): Promise<IPerformTriageActionResponse>
}

/** Endpoint-слой для triage API. */
export class TriageApi implements ITriageApi {
    private readonly httpClient: IHttpClient

    public constructor(httpClient: IHttpClient) {
        this.httpClient = httpClient
    }

    public async listItems(query: IListTriageQuery = {}): Promise<ITriageListResponse> {
        const requestQuery = query as Readonly<Record<string, string | undefined>>

        return this.httpClient.request<ITriageListResponse>({
            method: "GET",
            path: "/api/v1/triage",
            query: requestQuery,
            credentials: "include",
        })
    }

    public async performAction(
        request: IPerformTriageActionRequest,
    ): Promise<IPerformTriageActionResponse> {
        const normalizedId = request.id.trim()
        if (normalizedId.length === 0) {
            throw new Error("triageItemId не должен быть пустым")
        }

        return this.httpClient.request<IPerformTriageActionResponse>({
            method: "PATCH",
            path: `/api/v1/triage/${encodeURIComponent(normalizedId)}/action`,
            body: { action: request.action },
            credentials: "include",
        })
    }
}
