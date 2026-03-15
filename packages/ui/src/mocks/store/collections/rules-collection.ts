import type {
    ICustomRule,
    ICustomRuleExample,
    TCustomRuleScope,
    TCustomRuleSeverity,
    TCustomRuleStatus,
    TCustomRuleType,
} from "@/lib/api/endpoints/custom-rules.endpoint"

/**
 * Входные данные для создания custom-правила (без id).
 */
export interface ICreateRuleData {
    /** Заголовок правила. */
    readonly title: string
    /** Тело/regex/prompt правила. */
    readonly rule: string
    /** Тип исполнения. */
    readonly type: TCustomRuleType
    /** Область применения. */
    readonly scope: TCustomRuleScope
    /** Уровень severity. */
    readonly severity: TCustomRuleSeverity
    /** Статус custom-правила. */
    readonly status: TCustomRuleStatus
    /** Примеры для подтверждения поведения. */
    readonly examples: readonly ICustomRuleExample[]
}

/**
 * Частичные данные для обновления custom-правила.
 */
export interface IUpdateRuleData {
    /** Заголовок правила. */
    readonly title?: string
    /** Тело/regex/prompt правила. */
    readonly rule?: string
    /** Тип исполнения. */
    readonly type?: TCustomRuleType
    /** Область применения. */
    readonly scope?: TCustomRuleScope
    /** Уровень severity. */
    readonly severity?: TCustomRuleSeverity
    /** Статус custom-правила. */
    readonly status?: TCustomRuleStatus
    /** Примеры для подтверждения поведения. */
    readonly examples?: readonly ICustomRuleExample[]
}

/**
 * Коллекция custom-правил для mock API.
 *
 * Хранит in-memory данные правил пайплайна.
 * Поддерживает CRUD, текстовый поиск, seed и clear.
 */
export class RulesCollection {
    /**
     * Хранилище правил по ID.
     */
    private rules: Map<string, ICustomRule> = new Map()

    /**
     * Счётчик для генерации уникальных ID.
     */
    private idCounter: number = 0

    /**
     * Возвращает отфильтрованный список правил.
     *
     * Фильтрует по совпадению подстроки в title или rule (case-insensitive).
     * Если запрос не указан, возвращает все правила.
     *
     * @param q - Опциональная строка поиска по title/rule.
     * @returns Массив правил, соответствующих фильтру.
     */
    public listRules(q?: string): ReadonlyArray<ICustomRule> {
        const all = Array.from(this.rules.values())

        if (q === undefined || q.trim().length === 0) {
            return all
        }

        const lower = q.toLowerCase()
        return all.filter(
            (r) =>
                r.title.toLowerCase().includes(lower) ||
                r.rule.toLowerCase().includes(lower),
        )
    }

    /**
     * Возвращает правило по идентификатору.
     *
     * @param id - Идентификатор правила.
     * @returns Правило или undefined, если не найдено.
     */
    public getRuleById(id: string): ICustomRule | undefined {
        return this.rules.get(id)
    }

    /**
     * Создаёт новое правило с автогенерированным ID.
     *
     * @param data - Данные для создания правила (без id).
     * @returns Созданное правило с назначенным id.
     */
    public createRule(data: ICreateRuleData): ICustomRule {
        this.idCounter += 1
        const id = `rule-${String(this.idCounter).padStart(3, "0")}`

        const rule: ICustomRule = {
            id,
            title: data.title,
            rule: data.rule,
            type: data.type,
            scope: data.scope,
            severity: data.severity,
            status: data.status,
            examples: data.examples,
        }

        this.rules.set(id, rule)
        return rule
    }

    /**
     * Обновляет существующее правило частичными данными.
     *
     * @param id - Идентификатор правила.
     * @param patch - Частичные данные для обновления.
     * @returns Обновлённое правило или undefined, если не найдено.
     */
    public updateRule(id: string, patch: IUpdateRuleData): ICustomRule | undefined {
        const existing = this.rules.get(id)
        if (existing === undefined) {
            return undefined
        }

        const updated: ICustomRule = {
            ...existing,
            ...patch,
            id: existing.id,
        }

        this.rules.set(id, updated)
        return updated
    }

    /**
     * Удаляет правило по идентификатору.
     *
     * @param id - Идентификатор правила.
     * @returns true если правило было удалено, false если не найдено.
     */
    public deleteRule(id: string): boolean {
        return this.rules.delete(id)
    }

    /**
     * Заполняет коллекцию начальными данными.
     *
     * Очищает текущее состояние и загружает переданные правила.
     * Обновляет счётчик ID на основе максимального числового суффикса.
     *
     * @param rules - Массив правил для загрузки.
     */
    public seed(rules: ReadonlyArray<ICustomRule>): void {
        this.clear()

        for (const rule of rules) {
            this.rules.set(rule.id, rule)
        }

        this.idCounter = rules.length
    }

    /**
     * Полностью очищает коллекцию правил и сбрасывает счётчик.
     */
    public clear(): void {
        this.rules.clear()
        this.idCounter = 0
    }
}
