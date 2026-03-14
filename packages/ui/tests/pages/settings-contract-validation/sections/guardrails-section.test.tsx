import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { GuardrailsSection } from "@/pages/settings-contract-validation/sections/guardrails-section"
import { renderWithProviders } from "../../../utils/render"
import { createMockContractState } from "./mock-contract-state"

describe("GuardrailsSection", (): void => {
    it("when rendered, then shows guardrails yaml editor and action buttons", (): void => {
        const state = createMockContractState()
        renderWithProviders(<GuardrailsSection state={state} />)

        expect(screen.getByLabelText("Architecture guardrails yaml")).not.toBeNull()
        expect(screen.getByRole("button", { name: "Validate guardrails" })).not.toBeNull()
        expect(screen.getByRole("button", { name: "Apply guardrails" })).not.toBeNull()
    })

    it("when guardrails are valid, then shows success alert with parsed rule count", (): void => {
        const state = createMockContractState()
        renderWithProviders(<GuardrailsSection state={state} />)

        expect(screen.getByText("Guardrails are valid")).not.toBeNull()
        expect(screen.getByText("Parsed 1 guardrail rules.")).not.toBeNull()
    })

    it("when rendered, then shows visual rules list with mode badges", (): void => {
        const state = createMockContractState()
        renderWithProviders(<GuardrailsSection state={state} />)

        expect(screen.getByLabelText("Guardrail visual rules list")).not.toBeNull()
        expect(screen.getByText("forbid")).not.toBeNull()
        expect(screen.getByText("Import direction is explicitly forbidden.")).not.toBeNull()
    })

    it("when guardrails have errors, then shows validation errors alert", (): void => {
        const state = createMockContractState({
            guardrailsValidationResult: {
                errors: ["Invalid YAML", "Rule source missing"],
                rules: [],
            },
        })
        renderWithProviders(<GuardrailsSection state={state} />)

        expect(screen.getByText("Guardrails validation errors")).not.toBeNull()
        expect(screen.getByText("Invalid YAML")).not.toBeNull()
        expect(screen.getByText("Rule source missing")).not.toBeNull()
    })
})
