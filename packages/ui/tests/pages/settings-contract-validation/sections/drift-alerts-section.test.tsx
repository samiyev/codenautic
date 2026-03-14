import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { DriftAlertsSection } from "@/pages/settings-contract-validation/sections/drift-alerts-section"
import { renderWithProviders } from "../../../utils/render"
import { createMockContractState } from "./mock-contract-state"

describe("DriftAlertsSection", (): void => {
    it("when rendered, then shows severity threshold and violation threshold controls", (): void => {
        const state = createMockContractState()
        renderWithProviders(<DriftAlertsSection state={state} />)

        expect(screen.getByLabelText("Drift alert severity threshold")).not.toBeNull()
        expect(screen.getByLabelText("Drift alert violation threshold")).not.toBeNull()
    })

    it("when rendered, then shows notification channel checkboxes", (): void => {
        const state = createMockContractState()
        renderWithProviders(<DriftAlertsSection state={state} />)

        expect(screen.getByText("Notification channels")).not.toBeNull()
        expect(screen.getByRole("button", { name: "Save drift alert config" })).not.toBeNull()
    })

    it("when alert would not trigger, then shows informational preview", (): void => {
        const state = createMockContractState({
            driftAlertWouldTrigger: false,
            driftAlertRelevantViolationCount: 1,
        })
        renderWithProviders(<DriftAlertsSection state={state} />)

        expect(screen.getByText(/Alert will not trigger/)).not.toBeNull()
        expect(screen.getByText(/Violations at or above threshold: 1/)).not.toBeNull()
    })

    it("when alert would trigger, then shows danger preview", (): void => {
        const state = createMockContractState({
            driftAlertWouldTrigger: true,
            driftAlertRelevantViolationCount: 5,
        })
        renderWithProviders(<DriftAlertsSection state={state} />)

        expect(screen.getByText(/Alert will trigger/)).not.toBeNull()
    })
})
