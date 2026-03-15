import type { IMetricGridMetric } from "@/components/dashboard/metrics-grid"
import type {
    IFileDependencyNode,
    IFileDependencyRelation,
} from "@/components/dependency-graphs/file-dependency-graph"
import type {
    IFunctionCallNode,
    IFunctionCallRelation,
} from "@/components/dependency-graphs/function-class-call-graph"
import type {
    IPackageDependencyNode,
    IPackageDependencyRelation,
} from "@/components/dependency-graphs/package-dependency-graph"

/**
 * Уровень риска компонента репозитория.
 */
export type TRepositoryRisk = "critical" | "high" | "low"

/**
 * Цветовая подсветка для Chip-компонентов.
 */
export type THighlight = "danger" | "warning" | "success"

/**
 * Режим расписания периодического рескана.
 */
export type TRescanScheduleMode = "manual" | "hourly" | "daily" | "weekly" | "custom"

/**
 * Описание состояния архитектурного компонента.
 */
export interface IArchitectureSummary {
    /** Компонент архитектуры. */
    readonly area: string
    /** Оценка риска (low/high/critical). */
    readonly risk: TRepositoryRisk
    /** Короткое описание текущего состояния. */
    readonly summary: string
}

/**
 * Элемент технологического стека репозитория.
 */
export interface ITechStackItem {
    /** Название технологии. */
    readonly name: string
    /** Версия (если указана). */
    readonly version: string
    /** Описание применённости. */
    readonly note: string
}

/**
 * Профиль overview репозитория после скана.
 */
export interface IRepositoryOverviewProfile {
    /** Уникальный идентификатор (`owner/repo`). */
    readonly id: string
    /** Владелец репозитория. */
    readonly owner: string
    /** Имя репозитория. */
    readonly name: string
    /** Основная ветка. */
    readonly branch: string
    /** Время последнего скана. */
    readonly lastScanAt: string
    /** Количество проанализированных файлов. */
    readonly filesScanned: number
    /** Количество найденных инцидентов по качеству. */
    readonly totalFindings: number
    /** Уровень health score по последнему скану. */
    readonly healthScore: number
    /** Архитектурное резюме по слоям. */
    readonly architectureSummary: ReadonlyArray<IArchitectureSummary>
    /** Ключевые KPI. */
    readonly keyMetrics: ReadonlyArray<IMetricGridMetric>
    /** Используемый стек. */
    readonly techStack: ReadonlyArray<ITechStackItem>
    /** Значение расписания скана по умолчанию (cron). */
    readonly defaultRescanCron: string
}

/**
 * Профиль зависимостей файлов для графа.
 */
export interface IRepositoryFileDependencyProfile {
    /** Список файлов репозитория для отображения в графе зависимостей. */
    readonly files: ReadonlyArray<IFileDependencyNode>
    /** Список зависимостей между файлами в репозитории. */
    readonly dependencies: ReadonlyArray<IFileDependencyRelation>
}

/**
 * Профиль вызовов функций и классов для call-graph.
 */
export interface IRepositoryFunctionCallProfile {
    /** Сущности (функции и классы) для отображения в call-graph. */
    readonly nodes: ReadonlyArray<IFunctionCallNode>
    /** Связи вызовов между сущностями. */
    readonly callRelations: ReadonlyArray<IFunctionCallRelation>
}

/**
 * Профиль зависимостей пакетов для графа.
 */
export interface IRepositoryPackageDependencyProfile {
    /** Список пакетов в виде зависимых модулей. */
    readonly nodes: ReadonlyArray<IPackageDependencyNode>
    /** Связи между модулями/пакетами. */
    readonly packageRelations: ReadonlyArray<IPackageDependencyRelation>
}

/**
 * Значения формы настройки расписания рескана.
 */
export interface IRescanScheduleValues {
    /** Режим расписания. */
    readonly mode: TRescanScheduleMode
    /** Минута запуска (0-59). */
    readonly minute: number
    /** Час запуска (0-23). */
    readonly hour: number
    /** День недели (0-6, 0 — Sunday). */
    readonly weekday: number
    /** Кастомное cron-выражение для режима `custom`. */
    readonly customCron: string
}

/**
 * Payload колбека при сохранении расписания рескана.
 */
export interface IRescanScheduleChangePayload {
    /** Идентификатор репозитория. */
    readonly repositoryId: string
    /** Итоговое cron-выражение после сохранения. */
    readonly cronExpression: string
    /** Режим расписания после сохранения. */
    readonly mode: TRescanScheduleMode
}

/**
 * Опция выбора режима расписания.
 */
export interface IRescanScheduleOption {
    /** Значение режима. */
    readonly value: TRescanScheduleMode
    /** Человекочитаемая метка. */
    readonly label: string
}

/**
 * Опция выбора дня недели.
 */
export interface IRescanWeekdayOption {
    /** Число дня недели для cron (0-6). */
    readonly value: number
    /** Название дня. */
    readonly label: string
}

/**
 * Props компонента RepositoryOverviewPage.
 */
export interface IRepositoryOverviewProps {
    /** ID репозитория (`owner/repo`). */
    readonly repositoryId: string
    /** Колбек после сохранения расписания рескана. */
    readonly onRescanScheduleChange?: (payload: IRescanScheduleChangePayload) => void
}
