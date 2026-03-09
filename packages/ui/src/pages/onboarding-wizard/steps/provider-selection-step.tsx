import type { ReactElement } from "react"

import { Alert, Button, Chip } from "@/components/ui"
import { FormSelectField } from "@/components/forms"

import type { IOnboardingWizardState } from "../use-onboarding-wizard-state"
import type { IOnboardingFormValues } from "../onboarding-wizard-types"
import { GIT_PROVIDER_SELECT_OPTIONS } from "../onboarding-wizard-types"
import { mapProviderLabel } from "../onboarding-templates"

/**
 * Параметры компонента шага выбора провайдера.
 */
export interface IProviderSelectionStepProps {
    /** Состояние визарда. */
    readonly state: IOnboardingWizardState
}

/**
 * Шаг 0: выбор Git-провайдера и подтверждение подключения.
 *
 * @param props Конфигурация.
 * @returns Компонент шага выбора провайдера.
 */
export function ProviderSelectionStep({ state }: IProviderSelectionStepProps): ReactElement | null {
    if (state.activeStep !== 0) {
        return null
    }

    return (
        <section className="space-y-3">
            <FormSelectField<IOnboardingFormValues, "provider">
                control={state.form.control}
                id="provider"
                label="Git-провайдер"
                name="provider"
                options={GIT_PROVIDER_SELECT_OPTIONS}
                helperText="Подключение нужно для доступа к репозиториям и запуску скана."
            />
            <div className="flex flex-wrap items-center gap-2">
                <Button
                    onPress={(): void => {
                        state.handleConnectProvider()
                    }}
                    type="button"
                >
                    Connect provider
                </Button>
                <Chip
                    color={state.isProviderConnected ? "success" : "warning"}
                    size="sm"
                    variant="flat"
                >
                    {state.isProviderConnected
                        ? `${mapProviderLabel(state.values.provider)} connected`
                        : "Not connected"}
                </Chip>
            </div>
            {state.providerConnectionError === undefined ? null : (
                <Alert color="danger">{state.providerConnectionError}</Alert>
            )}
        </section>
    )
}
