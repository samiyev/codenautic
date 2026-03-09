import type {
    ICodeCityTreemapFileDescriptor,
    ICodeCityTreemapImpactedFileDescriptor,
    ICodeCityTreemapTemporalCouplingDescriptor,
} from "@/components/graphs/codecity-treemap"
import type { IHealthTrendPoint } from "@/components/graphs/health-trend-chart"

/**
 * Допустимые значения метрики для CodeCity dashboard.
 */
export type TCodeCityDashboardMetric = "complexity" | "coverage" | "churn"

/**
 * Опция выбора метрики в селекторе dashboard.
 */
export interface ICodeCityDashboardMetricOption {
    /**
     * Machine-friendly value.
     */
    readonly value: TCodeCityDashboardMetric
    /**
     * Лейбл опции метрики.
     */
    readonly label: string
}

/**
 * Профиль репозитория для CodeCity dashboard.
 */
export interface ICodeCityDashboardRepositoryProfile {
    /**
     * Уникальный идентификатор репозитория.
     */
    readonly id: string
    /**
     * Короткая подпись в селекторе.
     */
    readonly label: string
    /**
     * Описание дашборда.
     */
    readonly description: string
    /**
     * Набор файлов для treemap.
     */
    readonly files: ReadonlyArray<ICodeCityTreemapFileDescriptor>
    /**
     * Список влияний CCR для визуализации по умолчанию.
     */
    readonly impactedFiles: ReadonlyArray<ICodeCityTreemapImpactedFileDescriptor>
    /**
     * Базовый срез для temporal comparison.
     */
    readonly compareFiles: ReadonlyArray<ICodeCityTreemapFileDescriptor>
    /**
     * Temporal coupling связи между файлами treemap.
     */
    readonly temporalCouplings: ReadonlyArray<ICodeCityTreemapTemporalCouplingDescriptor>
    /**
     * История health score для линейного causal-trend графика.
     */
    readonly healthTrend: ReadonlyArray<IHealthTrendPoint>
    /**
     * Владельцы с цветами и avatar для ownership overlay.
     */
    readonly contributors: ReadonlyArray<ICodeCityDashboardContributorDescriptor>
    /**
     * Маппинг файл -> owner для ownership overlay.
     */
    readonly ownership: ReadonlyArray<ICodeCityDashboardOwnershipDescriptor>
    /**
     * Связи co-authoring между контрибьюторами.
     */
    readonly contributorCollaborations: ReadonlyArray<ICodeCityDashboardContributorCollaborationDescriptor>
}

/**
 * Дескриптор контрибьютора для CodeCity dashboard.
 */
export interface ICodeCityDashboardContributorDescriptor {
    /**
     * Идентификатор владельца.
     */
    readonly ownerId: string
    /**
     * Отображаемое имя владельца.
     */
    readonly ownerName: string
    /**
     * Цвет владельца в city overlay.
     */
    readonly color: string
    /**
     * Ссылка на avatar.
     */
    readonly ownerAvatarUrl?: string
    /**
     * Количество коммитов для contributor graph.
     */
    readonly commitCount: number
}

/**
 * Дескриптор ownership для маппинга файл -> владелец.
 */
export interface ICodeCityDashboardOwnershipDescriptor {
    /**
     * Идентификатор файла.
     */
    readonly fileId: string
    /**
     * Владелец файла.
     */
    readonly ownerId: string
}

/**
 * Дескриптор collaboration между контрибьюторами.
 */
export interface ICodeCityDashboardContributorCollaborationDescriptor {
    /**
     * Source owner id.
     */
    readonly sourceOwnerId: string
    /**
     * Target owner id.
     */
    readonly targetOwnerId: string
    /**
     * Частота совместных коммитов.
     */
    readonly coAuthorCount: number
}

/**
 * Props компонента CodeCityDashboardPage.
 */
export interface ICodeCityDashboardPageProps {
    /**
     * Идентификатор репозитория по умолчанию.
     */
    readonly initialRepositoryId?: string
}

/**
 * Состояние фокуса навигации для explore mode.
 */
export interface IExploreNavigationFocusState {
    /**
     * Заголовок текущей навигации.
     */
    readonly title: string
    /**
     * Цепочка file ids для навигации.
     */
    readonly chainFileIds: ReadonlyArray<string>
    /**
     * Активный file id в фокусе.
     */
    readonly activeFileId?: string
}

/**
 * Идентификатор области onboarding dashboard.
 */
export type TDashboardOnboardingAreaId =
    | "controls"
    | "explore"
    | "hot-areas"
    | "root-cause"
    | "city-3d"

/**
 * Дескриптор области onboarding для dashboard.
 */
export interface ICodeCityDashboardOnboardingAreaDescriptor {
    /**
     * Уникальный идентификатор области.
     */
    readonly id: TDashboardOnboardingAreaId
    /**
     * Название области.
     */
    readonly title: string
    /**
     * Описание области.
     */
    readonly description: string
}
