import type { ReactElement } from "react"

import { TYPOGRAPHY } from "@/lib/constants/typography"

import {
    BlueprintSection,
    ContractSection,
    DriftAlertsSection,
    DriftTrendSection,
    DriftViolationsSection,
    GuardrailsSection,
} from "./sections"
import { useContractValidationState } from "./use-contract-validation-state"

/**
 * Settings page for import/export contract validation, architecture blueprint editing,
 * drift analysis, drift alerts, and architecture guardrails configuration.
 *
 * @returns The contract validation settings page element.
 */
export function SettingsContractValidationPage(): ReactElement {
    const state = useContractValidationState()

    return (
        <section className="space-y-4">
            <h1 className={TYPOGRAPHY.pageTitle}>Contract validation</h1>
            <p className={TYPOGRAPHY.pageSubtitle}>
                Validate schema/version for import/export payloads and preview before apply.
            </p>

            <ContractSection state={state} />
            <BlueprintSection state={state} />
            <DriftViolationsSection state={state} />
            <DriftTrendSection state={state} />
            <DriftAlertsSection state={state} />
            <GuardrailsSection state={state} />
        </section>
    )
}
