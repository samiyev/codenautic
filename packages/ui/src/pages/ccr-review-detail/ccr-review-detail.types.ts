/**
 * Типы и интерфейсы страницы детального просмотра CCR review.
 */

/**
 * Решение по результатам review: утверждение, ожидание, отклонение.
 */
type TReviewDecision = "approved" | "pending" | "rejected"

/**
 * Карта сообщений по thread ID.
 * Ключ — идентификатор треда, значение — массив сообщений.
 */
type TThreadMessagesMap = Readonly<
    Record<string, ReadonlyArray<import("@/components/chat/chat-panel").IChatPanelMessage>>
>

/**
 * Идентификатор фильтра SafeGuard pipeline.
 */
type TSafeGuardFilterId = "dedup" | "hallucination" | "severity"

/**
 * Статус прохождения шага SafeGuard pipeline.
 */
type TSafeGuardStepStatus = "applied" | "filtered_out" | "passed"

/**
 * Причина feedback от reviewer.
 */
type TReviewerFeedbackReason = "duplicate" | "false_positive" | "irrelevant"

/**
 * Статус применения reviewer feedback.
 */
type TReviewerFeedbackStatus = "accepted" | "rejected"

/**
 * Временное окно для истории review.
 */
type TReviewHistoryWindow = "7d" | "30d" | "90d"

/**
 * Уровень риска review.
 */
type TReviewRiskLevel = "low" | "medium" | "high" | "critical"

/**
 * Запись тепловой карты истории review по файлу.
 */
interface IReviewHistoryHeatEntry {
    /**
     * Путь к файлу.
     */
    readonly filePath: string
    /**
     * Количество review по каждому временному окну.
     */
    readonly reviewsByWindow: Readonly<Record<TReviewHistoryWindow, number>>
}

/**
 * Детали окружения файла: зависимости и последние изменения.
 */
interface IFileNeighborhoodDetails {
    /**
     * Список зависимостей файла.
     */
    readonly dependencies: ReadonlyArray<string>
    /**
     * Описания последних изменений.
     */
    readonly recentChanges: ReadonlyArray<string>
}

/**
 * Индикатор риска review с уровнем, оценкой и причинами.
 */
interface IReviewRiskIndicator {
    /**
     * Уровень риска.
     */
    readonly level: TReviewRiskLevel
    /**
     * Причины, формирующие оценку риска.
     */
    readonly reasons: ReadonlyArray<string>
    /**
     * Числовая оценка риска (0-100).
     */
    readonly score: number
}

/**
 * Шаг прохождения SafeGuard pipeline для отдельного замечания.
 */
interface ISafeGuardTraceStep {
    /**
     * Идентификатор фильтра SafeGuard.
     */
    readonly filterId: TSafeGuardFilterId
    /**
     * Результат прохождения фильтра.
     */
    readonly status: TSafeGuardStepStatus
    /**
     * Объяснение принятого решения.
     */
    readonly reason: string
}

/**
 * Trace-запись SafeGuard pipeline для одного замечания.
 */
interface ISafeGuardTraceItem {
    /**
     * Идентификатор trace-записи.
     */
    readonly id: string
    /**
     * Итоговый статус замечания после SafeGuard pipeline.
     */
    readonly finalDecision: "hidden" | "shown"
    /**
     * Файл, к которому относится замечание.
     */
    readonly filePath: string
    /**
     * Причина скрытия замечания, если применимо.
     */
    readonly hiddenReason?: string
    /**
     * Краткое содержание замечания.
     */
    readonly remark: string
    /**
     * Шаги pipeline по фильтрам.
     */
    readonly steps: ReadonlyArray<ISafeGuardTraceStep>
}

/**
 * Запись feedback от reviewer.
 */
interface IReviewerFeedbackRecord {
    /**
     * Время отправки feedback.
     */
    readonly createdAt: string
    /**
     * Детализированный outcome или причина отказа.
     */
    readonly details: string
    /**
     * Идентификатор feedback события.
     */
    readonly id: string
    /**
     * Связанный remark id, если feedback смержен как duplicate.
     */
    readonly linkedTraceId?: string
    /**
     * Причина из quick action.
     */
    readonly reason: TReviewerFeedbackReason
    /**
     * Статус применения feedback.
     */
    readonly status: TReviewerFeedbackStatus
    /**
     * Trace item, к которому относится feedback.
     */
    readonly traceId: string
}

export type {
    IFileNeighborhoodDetails,
    IReviewerFeedbackRecord,
    IReviewHistoryHeatEntry,
    IReviewRiskIndicator,
    ISafeGuardTraceItem,
    ISafeGuardTraceStep,
    TReviewDecision,
    TReviewerFeedbackReason,
    TReviewerFeedbackStatus,
    TReviewHistoryWindow,
    TReviewRiskLevel,
    TSafeGuardFilterId,
    TSafeGuardStepStatus,
    TThreadMessagesMap,
}
