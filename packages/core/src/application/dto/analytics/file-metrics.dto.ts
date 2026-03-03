/**
 * Структура метрик по отдельному файлу в CodeCity-модуле.
 */
export interface IFileMetricsDTO {
    /**
     * Относительный путь к файлу.
     */
    readonly filePath: string
    /**
     * Количество строк кода (LOC).
     */
    readonly loc: number
    /**
     * Оценочный коэффициент сложности кода.
     */
    readonly complexity: number
    /**
     * Покрытие тестами в процентах, если доступно.
     */
    readonly coverage?: number
    /**
     * Показатель churn за анализируемый период.
     */
    readonly churn: number
    /**
     * Число найденных дефектов/вопросов.
     */
    readonly issueCount: number
    /**
     * Дата последнего ревью файла в формате ISO-строки.
     */
    readonly lastReviewDate?: string
}
