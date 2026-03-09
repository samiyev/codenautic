import type { ReactElement } from "react"

import { Alert, Button, Checkbox } from "@/components/ui"
import {
    FormRadioGroupField,
    FormTextField,
    FormTextareaField,
} from "@/components/forms"

import type { IOnboardingWizardState } from "../use-onboarding-wizard-state"
import type { IOnboardingFormValues } from "../onboarding-wizard-types"
import {
    BULK_PROGRESS_PREVIEW_LABEL_LIMIT,
    ONBOARDING_MODE_SELECT_OPTIONS,
} from "../onboarding-wizard-types"

/**
 * Параметры компонента шага выбора репозитория.
 */
export interface IRepositorySelectionStepProps {
    /** Состояние визарда. */
    readonly state: IOnboardingWizardState
}

/**
 * Шаг 1: выбор репозитория (одиночный URL или bulk-режим с чекбоксами).
 *
 * @param props Конфигурация.
 * @returns Компонент шага выбора репозитория.
 */
export function RepositorySelectionStep({
    state,
}: IRepositorySelectionStepProps): ReactElement | null {
    if (state.activeStep !== 1) {
        return null
    }

    return (
        <section className="space-y-3">
            <FormRadioGroupField<IOnboardingFormValues, "onboardingMode">
                control={state.form.control}
                helperText="Выберите формат запуска."
                label="Режим onboarding"
                name="onboardingMode"
                options={ONBOARDING_MODE_SELECT_OPTIONS}
            />

            {state.isSingleMode ? (
                <FormTextField<IOnboardingFormValues, "repositoryUrl">
                    control={state.form.control}
                    id="repository-url"
                    label="URL репозитория"
                    name="repositoryUrl"
                    helperText="Поддерживаются GitHub, GitLab, Bitbucket."
                    inputProps={{
                        placeholder: "https://github.com/owner/repository",
                        type: "url",
                    }}
                />
            ) : (
                <>
                    <FormTextareaField<IOnboardingFormValues, "repositoryUrlList">
                        control={state.form.control}
                        id="repository-url-list"
                        label="Список репозиториев (по одной ссылке на строку)"
                        name="repositoryUrlList"
                        textareaProps={{
                            minRows: 6,
                            placeholder: `https://github.com/owner/repo-a
https://github.com/owner/repo-b`,
                        }}
                    />

                    <div className="flex items-center justify-between">
                        <p className="text-sm text-foreground">
                            Выбрано{" "}
                            <span className="font-semibold">
                                {state.selectedRepositoryUrls.length}
                            </span>{" "}
                            из{" "}
                            <span className="font-semibold">
                                {state.parsedBulkList.repositories.length}
                            </span>{" "}
                            репозиториев
                        </p>
                        <div className="flex gap-2">
                            <Button
                                onPress={(): void => {
                                    state.selectAllRepositories()
                                }}
                                size="sm"
                                type="button"
                                variant="light"
                            >
                                Выбрать все
                            </Button>
                            <Button
                                onPress={(): void => {
                                    state.clearAllRepositories()
                                }}
                                size="sm"
                                type="button"
                                variant="light"
                            >
                                Снять все
                            </Button>
                        </div>
                    </div>

                    <div className="max-h-60 space-y-2 overflow-auto rounded-md border border-border p-2">
                        {state.parsedBulkList.repositories.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                Добавьте URL репозиториев в поле выше.
                            </p>
                        ) : null}

                        {state.parsedBulkList.repositories.map(
                            (repositoryUrl): ReactElement => (
                                <div
                                    className="rounded-md border border-border p-2"
                                    key={repositoryUrl}
                                >
                                    <Checkbox
                                        isSelected={state.selectedRepositoryUrls.includes(
                                            repositoryUrl,
                                        )}
                                        onValueChange={(): void => {
                                            state.toggleRepositorySelection(repositoryUrl)
                                        }}
                                    >
                                        {repositoryUrl}
                                    </Checkbox>
                                </div>
                            ),
                        )}
                    </div>

                    {state.parsedBulkList.invalidLines.length > 0 ? (
                        <Alert color="danger">
                            Некорректные строки
                            <ul className="mt-1 list-disc space-y-1 pl-5">
                                {state.parsedBulkList.invalidLines.map(
                                    (line): ReactElement => (
                                        <li key={`invalid-line-${String(line.line)}`}>
                                            {line.line}: {line.value}
                                        </li>
                                    ),
                                )}
                            </ul>
                        </Alert>
                    ) : null}

                    {state.parsedBulkList.repositories.length >
                    BULK_PROGRESS_PREVIEW_LABEL_LIMIT ? (
                        <Alert color="primary">
                            Будет применен единый шаблон сканирования ко всем выбранным
                            репозиториям.
                        </Alert>
                    ) : null}
                </>
            )}

            {state.isSingleMode || state.isStarted ? null : (
                <Alert color="primary">
                    В bulk-режиме все выбранные репозитории запускаются по общему шаблону
                    настроек.
                </Alert>
            )}
        </section>
    )
}
