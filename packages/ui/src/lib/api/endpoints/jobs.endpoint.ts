import type { IHttpClient } from "../http-client"

/** Тип длительной операции. */
export type TJobKind = "analytics" | "review" | "scan"

/** Текущий статус выполнения job. */
export type TJobStatus = "canceled" | "completed" | "failed" | "paused" | "queued" | "running" | "stuck"

/** Допустимое действие над job. */
export type TJobAction = "cancel" | "requeue" | "retry"

/** Цель расписания. */
export type TScheduleTarget = "report" | "rescan"

/** Режим расписания. */
export type TScheduleMode = "hourly" | "weekly"

/** Job в системе operations monitor. */
export interface IJob {
    /** Уникальный идентификатор job. */
    readonly id: string
    /** Репозиторий или область применения. */
    readonly scope: string
    /** Тип длительной операции. */
    readonly kind: TJobKind
    /** Текущий статус выполнения. */
    readonly status: TJobStatus
    /** Текущее количество попыток. */
    readonly retryCount: number
    /** Максимально допустимое число попыток. */
    readonly retryLimit: number
    /** ETA до завершения. */
    readonly etaLabel: string
    /** Детали ошибки для drill-down. */
    readonly errorDetails?: string
}

/** Расписание для scheduler target. */
export interface IJobSchedule {
    /** Режим расписания: hourly или weekly. */
    readonly mode: TScheduleMode
    /** Интервал в часах для hourly. */
    readonly intervalHours: number
    /** День недели для weekly (0=Sunday ... 6=Saturday). */
    readonly weekday: number
    /** Час запуска. */
    readonly hour: number
    /** Минута запуска. */
    readonly minute: number
}

/** Запись аудита действий над job. */
export interface IJobAuditEntry {
    /** Идентификатор audit события. */
    readonly id: string
    /** Пользователь или система, инициировавшие действие. */
    readonly actor: string
    /** Применённое действие. */
    readonly action: TJobAction
    /** Job id. */
    readonly jobId: string
    /** Результат операции. */
    readonly outcome: string
    /** Время события. */
    readonly occurredAt: string
}

/** Ответ списка jobs. */
export interface IJobsListResponse {
    /** Массив jobs. */
    readonly jobs: readonly IJob[]
    /** Массив audit записей. */
    readonly audit: readonly IJobAuditEntry[]
}

/** Запрос действия над job. */
export interface IJobActionRequest {
    /** Идентификатор job. */
    readonly jobId: string
    /** Действие. */
    readonly action: TJobAction
}

/** Ответ действия над job. */
export interface IJobActionResponse {
    /** Обновлённый job. */
    readonly job: IJob
    /** Новая запись аудита. */
    readonly auditEntry: IJobAuditEntry
}

/** Ответ списка расписаний. */
export interface IJobSchedulesResponse {
    /** Расписания по target. */
    readonly schedules: Readonly<Record<TScheduleTarget, IJobSchedule>>
}

/** Запрос обновления расписания. */
export interface IUpdateScheduleRequest {
    /** Целевой target расписания. */
    readonly target: TScheduleTarget
    /** Обновлённое расписание. */
    readonly schedule: IJobSchedule
}

/** Контракт Jobs API. */
export interface IJobsApi {
    /** Возвращает список jobs и audit trail. */
    listJobs(): Promise<IJobsListResponse>

    /** Возвращает job по id. */
    getJob(jobId: string): Promise<IJob>

    /** Выполняет действие над job (retry/cancel/requeue). */
    performAction(request: IJobActionRequest): Promise<IJobActionResponse>

    /** Возвращает расписания scheduler targets. */
    getSchedules(): Promise<IJobSchedulesResponse>

    /** Обновляет расписание scheduler target. */
    updateSchedule(request: IUpdateScheduleRequest): Promise<IJobSchedulesResponse>
}

/**
 * Endpoint-слой для Jobs API.
 */
export class JobsApi implements IJobsApi {
    /**
     * HTTP-клиент для выполнения запросов.
     */
    private readonly httpClient: IHttpClient

    /**
     * Создаёт экземпляр JobsApi.
     *
     * @param httpClient - HTTP-клиент.
     */
    public constructor(httpClient: IHttpClient) {
        this.httpClient = httpClient
    }

    /**
     * Возвращает список jobs и audit trail.
     *
     * @returns Список jobs и audit записей.
     */
    public async listJobs(): Promise<IJobsListResponse> {
        return this.httpClient.request<IJobsListResponse>({
            method: "GET",
            path: "/api/v1/jobs",
            credentials: "include",
        })
    }

    /**
     * Возвращает job по id.
     *
     * @param jobId - Идентификатор job.
     * @returns Найденный job.
     */
    public async getJob(jobId: string): Promise<IJob> {
        const normalizedJobId = jobId.trim()
        if (normalizedJobId.length === 0) {
            throw new Error("jobId не должен быть пустым")
        }

        return this.httpClient.request<IJob>({
            method: "GET",
            path: `/api/v1/jobs/${encodeURIComponent(normalizedJobId)}`,
            credentials: "include",
        })
    }

    /**
     * Выполняет действие над job.
     *
     * @param request - Запрос с jobId и action.
     * @returns Обновлённый job и audit entry.
     */
    public async performAction(request: IJobActionRequest): Promise<IJobActionResponse> {
        const normalizedJobId = request.jobId.trim()
        if (normalizedJobId.length === 0) {
            throw new Error("jobId не должен быть пустым")
        }

        return this.httpClient.request<IJobActionResponse>({
            method: "PATCH",
            path: `/api/v1/jobs/${encodeURIComponent(normalizedJobId)}/action`,
            body: { action: request.action },
            credentials: "include",
        })
    }

    /**
     * Возвращает расписания scheduler targets.
     *
     * @returns Расписания по target.
     */
    public async getSchedules(): Promise<IJobSchedulesResponse> {
        return this.httpClient.request<IJobSchedulesResponse>({
            method: "GET",
            path: "/api/v1/jobs/schedules",
            credentials: "include",
        })
    }

    /**
     * Обновляет расписание scheduler target.
     *
     * @param request - Запрос с target и schedule.
     * @returns Обновлённые расписания.
     */
    public async updateSchedule(request: IUpdateScheduleRequest): Promise<IJobSchedulesResponse> {
        return this.httpClient.request<IJobSchedulesResponse>({
            method: "PUT",
            path: "/api/v1/jobs/schedules",
            body: request,
            credentials: "include",
        })
    }
}
