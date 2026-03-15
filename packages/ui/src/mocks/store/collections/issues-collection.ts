import type {
    IIssue,
    TIssueAction,
    TIssueSeverity,
    TIssueStatus,
} from "@/lib/api/endpoints/issues.endpoint"

/** Параметры фильтрации списка issues. */
export interface IIssuesFilterParams {
    /** Фильтр по статусу. */
    readonly status?: TIssueStatus
    /** Фильтр по критичности. */
    readonly severity?: TIssueSeverity
    /** Поиск по тексту (id, title, repository, filePath). */
    readonly search?: string
}

/**
 * Коллекция issues для mock API.
 *
 * Хранит in-memory данные проблем.
 * Поддерживает фильтрацию, действия, seed и clear.
 */
export class IssuesCollection {
    /**
     * Хранилище issues по ID.
     */
    private issues: Map<string, IIssue> = new Map()

    /**
     * Возвращает отфильтрованный список issues.
     *
     * @param params Параметры фильтрации.
     * @returns Массив issues, соответствующих фильтрам.
     */
    public listIssues(params: IIssuesFilterParams = {}): ReadonlyArray<IIssue> {
        const all = Array.from(this.issues.values())

        return all.filter((issue): boolean => {
            if (params.status !== undefined && issue.status !== params.status) {
                return false
            }

            if (params.severity !== undefined && issue.severity !== params.severity) {
                return false
            }

            if (params.search !== undefined && params.search.trim().length > 0) {
                const query = params.search.trim().toLowerCase()
                const matchesSearch =
                    issue.id.toLowerCase().includes(query) ||
                    issue.title.toLowerCase().includes(query) ||
                    issue.repository.toLowerCase().includes(query) ||
                    issue.filePath.toLowerCase().includes(query)

                if (matchesSearch !== true) {
                    return false
                }
            }

            return true
        })
    }

    /**
     * Возвращает issue по идентификатору.
     *
     * @param id Идентификатор issue.
     * @returns Issue или undefined, если не найдена.
     */
    public getIssueById(id: string): IIssue | undefined {
        return this.issues.get(id)
    }

    /**
     * Выполняет действие над issue и возвращает обновлённую запись.
     *
     * @param id Идентификатор issue.
     * @param action Действие для выполнения.
     * @returns Обновлённая issue или undefined, если не найдена.
     */
    public performAction(id: string, action: TIssueAction): IIssue | undefined {
        const existing = this.issues.get(id)
        if (existing === undefined) {
            return undefined
        }

        const updated = applyAction(existing, action)
        this.issues.set(id, updated)
        return updated
    }

    /**
     * Заполняет коллекцию начальными данными.
     *
     * @param issues Массив issues для загрузки.
     */
    public seed(issues: ReadonlyArray<IIssue>): void {
        this.clear()

        for (const issue of issues) {
            this.issues.set(issue.id, issue)
        }
    }

    /**
     * Полностью очищает коллекцию issues.
     */
    public clear(): void {
        this.issues.clear()
    }
}

/**
 * Применяет действие к issue и возвращает обновлённую копию.
 *
 * @param issue Исходная issue.
 * @param action Действие.
 * @returns Обновлённая issue.
 */
function applyAction(issue: IIssue, action: TIssueAction): IIssue {
    if (action === "fix") {
        return { ...issue, status: "fixed" }
    }
    if (action === "ignore") {
        return { ...issue, status: "dismissed" }
    }
    if (action === "snooze") {
        return { ...issue, status: "dismissed" }
    }
    if (action === "acknowledge") {
        return { ...issue, status: "in_progress" }
    }
    return issue
}
