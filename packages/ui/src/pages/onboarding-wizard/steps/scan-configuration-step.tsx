import type { ReactElement } from "react"

import { Alert, Button, Chip } from "@/components/ui"
import {
    FormNumberField,
    FormRadioGroupField,
    FormSelectField,
    FormSwitchField,
    FormTextField,
} from "@/components/forms"

import type { IOnboardingWizardState } from "../use-onboarding-wizard-state"
import type { IOnboardingFormValues } from "../onboarding-wizard-types"
import {
    PREVIEW_REPOSITORY_LIMIT,
    PREVIEW_TEMPLATE_DIFF_LIMIT,
    SCAN_MODE_SELECT_OPTIONS,
    SCAN_SCHEDULE_SELECT_OPTIONS,
} from "../onboarding-wizard-types"
import {
    formatBooleanForSummary,
    formatTemplateTags,
    mapProviderLabel,
    splitTemplateTagsForPreview,
    TEMPLATE_OPTIONS,
} from "../onboarding-templates"

/**
 * Параметры компонента шага настройки сканирования.
 */
export interface IScanConfigurationStepProps {
    /** Состояние визарда. */
    readonly state: IOnboardingWizardState
}

/**
 * Шаг 2: настройка параметров сканирования (шаблоны, режим, расписание, воркеры, email, итоговая сводка).
 *
 * @param props Конфигурация.
 * @returns Компонент шага настройки сканирования.
 */
export function ScanConfigurationStep({
    state,
}: IScanConfigurationStepProps): ReactElement | null {
    if (state.activeStep !== 2) {
        return null
    }

    return (
        <>
            <section className="space-y-3">
                <div className="rounded-md border border-border p-3">
                    <p className="text-sm font-semibold text-foreground">
                        Registry шаблонов onboarding
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Выберите шаблон — сначала preview, потом примените в один клик.
                    </p>
                    <div className="mt-2">
                        <FormRadioGroupField<IOnboardingFormValues, "onboardingTemplateId">
                            control={state.form.control}
                            helperText="Шаблон влияет только на настройки сканирования."
                            label="Шаблон"
                            name="onboardingTemplateId"
                            options={TEMPLATE_OPTIONS}
                        />
                    </div>

                    {state.selectedTemplate !== undefined ? (
                        <details className="mt-2">
                            <summary className="cursor-pointer text-sm font-semibold">
                                Что будет применено
                            </summary>
                            <div className="mt-2 space-y-1 text-xs text-foreground">
                                <p>
                                    <span className="font-semibold">ID:</span>{" "}
                                    {state.selectedTemplate.id}
                                </p>
                                <p>
                                    <span className="font-semibold">Version:</span>{" "}
                                    {state.selectedTemplate.version}
                                </p>
                                <p>
                                    <span className="font-semibold">Rules:</span>{" "}
                                    {state.selectedTemplate.rulesPreset}
                                </p>
                                <p>
                                    <span className="font-semibold">Description:</span>{" "}
                                    {state.selectedTemplate.description}
                                </p>
                                {state.templateDiff
                                    .slice(0, PREVIEW_TEMPLATE_DIFF_LIMIT)
                                    .map(
                                        (line): ReactElement => (
                                            <p key={line}>{line}</p>
                                        ),
                                    )}
                            </div>
                        </details>
                    ) : null}

                    {state.canApplyTemplate ? (
                        <div className="mt-2">
                            <Button
                                isDisabled={state.hasTemplateChanges === false}
                                onPress={(): void => {
                                    state.applyTemplateToForm()
                                }}
                                size="sm"
                                type="button"
                                variant="light"
                            >
                                Применить шаблон
                            </Button>
                        </div>
                    ) : null}

                    <details className="mt-2">
                        <summary className="cursor-pointer text-sm font-semibold">
                            Применённые шаблоны (audit log)
                        </summary>
                        {state.templateAuditLog.length === 0 ? (
                            <p className="mt-2 text-sm text-muted-foreground">
                                Пока шаблоны не применялись.
                            </p>
                        ) : null}
                        {state.templateAuditLog.length === 0 ? null : (
                            <div className="mt-2 space-y-2">
                                {state.templateAuditLog
                                    .slice()
                                    .reverse()
                                    .map(
                                        (entry): ReactElement => (
                                            <article
                                                className="rounded-md border p-2"
                                                key={`${entry.templateId}-${entry.appliedAt}`}
                                            >
                                                <p className="text-xs">
                                                    {entry.templateName} —{" "}
                                                    {entry.templateVersion}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {entry.appliedAt}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    From:{" "}
                                                    {formatTemplateTags(entry.before.tags)} →
                                                    {formatTemplateTags(entry.after.tags)}
                                                </p>
                                            </article>
                                        ),
                                    )}
                                <Button
                                    color="warning"
                                    isDisabled={state.lastTemplateAudit === undefined}
                                    onPress={(): void => {
                                        state.handleRollbackTemplate()
                                    }}
                                    size="sm"
                                    type="button"
                                    variant="ghost"
                                >
                                    Откатить последнее применение
                                </Button>
                            </div>
                        )}
                    </details>
                </div>

                <FormSelectField<IOnboardingFormValues, "scanMode">
                    control={state.form.control}
                    id="scan-mode"
                    helperText="Incremental — быстрее, full — полная проверка."
                    label="Режим сканирования"
                    name="scanMode"
                    options={SCAN_MODE_SELECT_OPTIONS}
                />
                <FormTextField<IOnboardingFormValues, "tags">
                    control={state.form.control}
                    helperText="Через запятую."
                    id="onboarding-tags"
                    inputProps={{
                        placeholder: "security, core, baseline",
                        type: "text",
                    }}
                    label="Теги"
                    name="tags"
                />
                <FormSelectField<IOnboardingFormValues, "scanSchedule">
                    control={state.form.control}
                    id="scan-schedule"
                    label="Расписание"
                    name="scanSchedule"
                    options={SCAN_SCHEDULE_SELECT_OPTIONS}
                />
                <FormNumberField<IOnboardingFormValues, "scanThreads">
                    control={state.form.control}
                    id="scan-threads"
                    helperText="1..32 параллельных воркера."
                    inputProps={{
                        min: 1,
                        max: 32,
                        placeholder: "4",
                    }}
                    label="Количество воркеров"
                    name="scanThreads"
                />
                <FormSwitchField<IOnboardingFormValues, "includeSubmodules">
                    control={state.form.control}
                    label="Включать сабмодули"
                    name="includeSubmodules"
                />
                <FormSwitchField<IOnboardingFormValues, "includeHistory">
                    control={state.form.control}
                    helperText="Если включено, соберём больше индексов."
                    label="Сканировать историю"
                    name="includeHistory"
                />
                <FormTextField<IOnboardingFormValues, "notifyEmail">
                    control={state.form.control}
                    helperText="Email для уведомлений о статусе."
                    id="notify-email"
                    inputProps={{
                        placeholder: "dev@company.com",
                        type: "email",
                    }}
                    label="Email для уведомлений (необязательно)"
                    name="notifyEmail"
                />
            </section>

            <section className="space-y-3">
                <p className="text-sm font-semibold text-foreground">
                    Проверьте выбранные настройки:
                </p>
                <div className="grid gap-2 rounded-lg border border-border p-3">
                    {state.isSingleMode ? (
                        <p className="text-sm">
                            <span className="font-semibold">Repository:</span>{" "}
                            {state.values.repositoryUrl}
                        </p>
                    ) : null}
                    <details className="rounded-md border border-border p-2">
                        <summary className="cursor-pointer text-sm font-semibold">
                            Шаблон onboarding
                        </summary>
                        <p className="mt-1 text-sm text-foreground">
                            {state.appliedTemplateMeta.name} (
                            {state.appliedTemplateMeta.version})
                        </p>
                        <p className="text-sm text-foreground">
                            Rules: {state.appliedTemplateMeta.rulesPreset}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                            {splitTemplateTagsForPreview(
                                state.appliedTemplateMeta.tags,
                            ).map(
                                (tag): ReactElement => (
                                    <Chip key={tag} size="sm">
                                        {tag}
                                    </Chip>
                                ),
                            )}
                        </div>
                    </details>
                    {state.isSingleMode ? null : (
                        <details className="rounded-md border border-border p-2">
                            <summary className="cursor-pointer text-sm font-semibold">
                                Применяемый профиль
                            </summary>
                            <p className="mt-1 text-sm text-foreground">
                                Один шаблон на {state.selectedRepositoryUrls.length}{" "}
                                репозиториев: {state.values.scanMode}/
                                {state.values.scanSchedule}
                            </p>
                            {state.selectedRepositoryUrls.length === 0 ? null : (
                                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                                    {state.selectedRepositoryUrls
                                        .slice(0, PREVIEW_REPOSITORY_LIMIT)
                                        .map(
                                            (repositoryUrl): ReactElement => (
                                                <li key={`summary-repo-${repositoryUrl}`}>
                                                    {repositoryUrl}
                                                </li>
                                            ),
                                        )}
                                    {state.selectedRepositoryUrls.length >
                                    PREVIEW_REPOSITORY_LIMIT ? (
                                        <li>
                                            ...и еще{" "}
                                            {String(
                                                state.selectedRepositoryUrls.length -
                                                    PREVIEW_REPOSITORY_LIMIT,
                                            )}{" "}
                                            репозиториев.
                                        </li>
                                    ) : null}
                                </ul>
                            )}
                        </details>
                    )}
                    <p className="text-sm">
                        <span className="font-semibold">Provider:</span>{" "}
                        {mapProviderLabel(state.values.provider)} (
                        {state.isProviderConnected ? "connected" : "not connected"})
                    </p>
                    <p className="text-sm">
                        <span className="font-semibold">Mode:</span>{" "}
                        {state.values.scanMode}
                    </p>
                    <p className="text-sm">
                        <span className="font-semibold">Schedule:</span>{" "}
                        {state.values.scanSchedule}
                    </p>
                    <p className="text-sm">
                        <span className="font-semibold">Workers:</span>{" "}
                        {state.values.scanThreads}
                    </p>
                    <p className="text-sm">
                        <span className="font-semibold">Submodules:</span>{" "}
                        {formatBooleanForSummary(state.values.includeSubmodules)}
                    </p>
                    <p className="text-sm">
                        <span className="font-semibold">History:</span>{" "}
                        {formatBooleanForSummary(state.values.includeHistory)}
                    </p>
                    <p className="text-sm">
                        <span className="font-semibold">Email:</span>{" "}
                        {state.values.notifyEmail.length === 0
                            ? "не указан"
                            : state.values.notifyEmail}
                    </p>
                </div>

                {state.isSingleMode ? (
                    <Alert color="success">
                        {state.isStarted
                            ? "Сканирование запущено. Вы можете повторить запуск после правок."
                            : "После запуска будет начат первичный скан."}
                    </Alert>
                ) : null}
                {state.isSingleMode || state.isStarted ? null : (
                    <Alert color="primary">
                        После запуска вы увидите единый статус для всех репозиториев.
                    </Alert>
                )}
            </section>
        </>
    )
}
