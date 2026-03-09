import type { IFormSelectOption } from "@/components/forms"

const SCAN_MODE_OPTIONS = ["incremental", "full", "delta"] as const
const SCAN_SCHEDULE_OPTIONS = ["manual", "hourly", "daily", "weekly"] as const
const ONBOARDING_MODE_OPTIONS = ["single", "bulk"] as const
const GIT_PROVIDER_OPTIONS = ["github", "gitlab", "bitbucket"] as const
const ONBOARDING_TEMPLATE_IDS = [
    "custom",
    "security-baseline",
    "quality-scan",
    "fast-onboarding",
] as const

/**
 * Идентификатор шаблона "Ручная настройка".
 */
const CUSTOM_TEMPLATE_ID = ONBOARDING_TEMPLATE_IDS[0]

/**
 * Режим сканирования репозитория.
 */
export type TScanMode = (typeof SCAN_MODE_OPTIONS)[number]

/**
 * Расписание сканирования.
 */
export type TScanSchedule = (typeof SCAN_SCHEDULE_OPTIONS)[number]

/**
 * Режим онбординга: одиночный или массовый.
 */
export type TOnboardingMode = (typeof ONBOARDING_MODE_OPTIONS)[number]

/**
 * Git-провайдер.
 */
export type TGitProvider = (typeof GIT_PROVIDER_OPTIONS)[number]

/**
 * Статус задачи массового сканирования.
 */
export type TBulkScanStatus = "queued" | "running" | "paused" | "completed" | "error" | "cancelled"

/**
 * Идентификатор шаблона онбординга.
 */
export type TOnboardingTemplateId = (typeof ONBOARDING_TEMPLATE_IDS)[number]

/**
 * Описание шаблона onboarding.
 */
export interface IOnboardingTemplate {
    /** Идентификатор шаблона. */
    readonly id: TOnboardingTemplateId
    /** Название шаблона. */
    readonly name: string
    /** Версия шаблона. */
    readonly version: string
    /** Короткое описание шаблона. */
    readonly description: string
    /** Пресет правил сканирования. */
    readonly rulesPreset: string
    /** Режим сканирования. */
    readonly scanMode: TScanMode
    /** Каденс сканирования. */
    readonly scanSchedule: TScanSchedule
    /** Число воркеров. */
    readonly scanThreads: number
    /** Подмешиваем сабмодули. */
    readonly includeSubmodules: boolean
    /** Сканировать историю. */
    readonly includeHistory: boolean
    /** Email по умолчанию для уведомлений. */
    readonly notifyEmail: string
    /** Теги для репозиториев. */
    readonly tags: ReadonlyArray<string>
}

/**
 * Снимок состояния формы, связанный с шаблоном.
 */
export interface IOnboardingTemplateFormState {
    /** Режим сканирования. */
    readonly scanMode: TScanMode
    /** Расписание сканирования. */
    readonly scanSchedule: TScanSchedule
    /** Число воркеров. */
    readonly scanThreads: number
    /** Подмешиваем сабмодули. */
    readonly includeSubmodules: boolean
    /** Сканировать историю. */
    readonly includeHistory: boolean
    /** Email для уведомлений. */
    readonly notifyEmail: string
    /** Теги после нормализации. */
    readonly tags: ReadonlyArray<string>
}

/**
 * Запись аудита применения шаблона.
 */
export interface IOnboardingTemplateAuditEntry {
    /** Идентификатор примененного шаблона. */
    readonly templateId: TOnboardingTemplateId
    /** Название шаблона. */
    readonly templateName: string
    /** Версия шаблона. */
    readonly templateVersion: string
    /** Время применения. */
    readonly appliedAt: string
    /** Состояние до применения. */
    readonly before: IOnboardingTemplateFormState
    /** Состояние после применения. */
    readonly after: IOnboardingTemplateFormState
}

/**
 * Метаинформация примененного шаблона (прикрепляется к payload запуска).
 */
export interface IOnboardingAppliedTemplateMeta {
    /** Идентификатор источника конфигурации. */
    readonly id: TOnboardingTemplateId
    /** Название источника конфигурации. */
    readonly name: string
    /** Версия шаблона. */
    readonly version: string
    /** Preset правил. */
    readonly rulesPreset: string
    /** Набор тегов в виде массива. */
    readonly tags: ReadonlyArray<string>
}

/**
 * Проблема при разборе строки bulk-списка репозиториев.
 */
export interface IBulkRepositoryParseIssue {
    /** Номер строки с некорректным значением. */
    readonly line: number
    /** Некорректное значение. */
    readonly value: string
}

/**
 * Результат парсинга bulk-списка репозиториев.
 */
export interface IParsedBulkRepositoryList {
    /** Нормализованный список валидных URL. */
    readonly repositories: ReadonlyArray<string>
    /** Список проблемных строк. */
    readonly invalidLines: ReadonlyArray<IBulkRepositoryParseIssue>
}

/**
 * Задача массового сканирования одного репозитория.
 */
export interface IBulkScanJob {
    /** Идентификатор задачи сканирования. */
    readonly id: string
    /** URL репозитория в этой задаче. */
    readonly repositoryUrl: string
    /** Текущий статус задачи. */
    readonly status: TBulkScanStatus
    /** Прогресс выполнения (0..100). */
    readonly progress: number
    /** Краткая ошибка, если статус error. */
    readonly errorMessage?: string
    /** Детальные причины ошибки. */
    readonly errorDetails?: ReadonlyArray<string>
}

/**
 * Агрегированная статистика массового сканирования.
 */
export interface IBulkScanSummary {
    /** Задачи в работе. */
    readonly running: number
    /** Задачи в очереди. */
    readonly queued: number
    /** Задачи на паузе. */
    readonly paused: number
    /** Задачи с ошибкой. */
    readonly error: number
    /** Завершенные задачи. */
    readonly completed: number
    /** Отмененные задачи. */
    readonly cancelled: number
}

/**
 * Значения формы мастера onboarding.
 */
export interface IOnboardingFormValues {
    /** Git-провайдер для подключения репозитория. */
    readonly provider: TGitProvider
    /** Идентификатор выбранного шаблона. */
    readonly onboardingTemplateId: TOnboardingTemplateId
    /** Режим онбординга: одиночный или массовый. */
    readonly onboardingMode: TOnboardingMode
    /** URL репозитория для одиночного режима. */
    readonly repositoryUrl: string
    /** Сырая строка со списком репозиториев для bulk. */
    readonly repositoryUrlList: string
    /** Режим сканирования. */
    readonly scanMode: TScanMode
    /** Режим расписания сканирования. */
    readonly scanSchedule: TScanSchedule
    /** Количество воркеров сканирования. */
    readonly scanThreads: number
    /** Складывать ли подпроекты. */
    readonly includeSubmodules: boolean
    /** Проверять ли историю git при первом запуске. */
    readonly includeHistory: boolean
    /** Теги репозитория или шаблона. */
    readonly tags: string
    /** Email для уведомлений (необязателен). */
    readonly notifyEmail: string
}

/**
 * Payload, передаваемый при запуске сканирования из мастера.
 */
export interface IOnboardingScanStartPayload extends IOnboardingFormValues {
    /** Целевые репозитории для сканирования. */
    readonly targetRepositories: ReadonlyArray<string>
    /** Метаинформация примененного шаблона. */
    readonly appliedTemplate: IOnboardingAppliedTemplateMeta
}

/**
 * Props компонента OnboardingWizardPage.
 */
export interface IOnboardingWizardPageProps {
    /** Callback после подтверждения запуска сканирования. */
    readonly onScanStart?: (values: IOnboardingScanStartPayload) => void
}

/**
 * Шаги мастера onboarding.
 */
const WIZARD_STEPS = [
    {
        id: "provider",
        label: "Подключить провайдера",
        description: "Выберите Git-провайдера и подтвердите подключение.",
    },
    {
        id: "repository",
        label: "Выбрать репозиторий",
        description: "Укажите URL/список репозиториев для сканирования.",
    },
    {
        id: "launch",
        label: "Запустить скан",
        description: "Проверьте параметры и стартаньте процесс.",
    },
] as const

/**
 * Варианты режима сканирования для select-поля.
 */
const SCAN_MODE_SELECT_OPTIONS: ReadonlyArray<IFormSelectOption> = [
    {
        label: "Incremental",
        value: "incremental",
    },
    {
        label: "Full",
        value: "full",
    },
    {
        label: "Delta",
        value: "delta",
    },
]

/**
 * Варианты расписания сканирования для select-поля.
 */
const SCAN_SCHEDULE_SELECT_OPTIONS: ReadonlyArray<IFormSelectOption> = [
    {
        description: "Запуск только вручную",
        label: "Manual",
        value: "manual",
    },
    {
        description: "Каждый 1 час",
        label: "Hourly",
        value: "hourly",
    },
    {
        description: "Раз в день",
        label: "Daily",
        value: "daily",
    },
    {
        description: "Раз в неделю",
        label: "Weekly",
        value: "weekly",
    },
]

/**
 * Варианты режима onboarding для select-поля.
 */
const ONBOARDING_MODE_SELECT_OPTIONS: ReadonlyArray<IFormSelectOption> = [
    {
        label: "Одиночный репозиторий",
        value: "single",
    },
    {
        label: "Массовый onboarding (bulk)",
        value: "bulk",
    },
]

/**
 * Варианты Git-провайдера для select-поля.
 */
const GIT_PROVIDER_SELECT_OPTIONS: ReadonlyArray<IFormSelectOption> = [
    {
        description: "OAuth + API token flow",
        label: "GitHub",
        value: "github",
    },
    {
        description: "OAuth + project/repo scopes",
        label: "GitLab",
        value: "gitlab",
    },
    {
        description: "Workspace app or app password",
        label: "Bitbucket",
        value: "bitbucket",
    },
]

/**
 * Маппинг полей формы по шагам визарда.
 */
const STEP_FIELDS: Record<
    (typeof WIZARD_STEPS)[number]["id"],
    ReadonlyArray<keyof IOnboardingFormValues>
> = {
    provider: ["provider"],
    repository: ["onboardingMode", "repositoryUrl", "repositoryUrlList"],
    launch: [
        "onboardingTemplateId",
        "scanMode",
        "scanSchedule",
        "scanThreads",
        "includeSubmodules",
        "includeHistory",
        "tags",
        "notifyEmail",
    ],
}

/**
 * Лимит отображаемых задач в превью bulk-прогресса.
 */
const BULK_PROGRESS_PREVIEW_LABEL_LIMIT = 3

/**
 * Лимит отображаемых репозиториев в превью.
 */
const PREVIEW_REPOSITORY_LIMIT = 5

/**
 * Лимит отображаемых строк diff-шаблона в превью.
 */
const PREVIEW_TEMPLATE_DIFF_LIMIT = 6

export {
    SCAN_MODE_OPTIONS,
    SCAN_SCHEDULE_OPTIONS,
    ONBOARDING_MODE_OPTIONS,
    GIT_PROVIDER_OPTIONS,
    ONBOARDING_TEMPLATE_IDS,
    CUSTOM_TEMPLATE_ID,
    WIZARD_STEPS,
    SCAN_MODE_SELECT_OPTIONS,
    SCAN_SCHEDULE_SELECT_OPTIONS,
    ONBOARDING_MODE_SELECT_OPTIONS,
    GIT_PROVIDER_SELECT_OPTIONS,
    STEP_FIELDS,
    BULK_PROGRESS_PREVIEW_LABEL_LIMIT,
    PREVIEW_REPOSITORY_LIMIT,
    PREVIEW_TEMPLATE_DIFF_LIMIT,
}
