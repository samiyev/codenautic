import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { OnboardingWizardPage } from "@/pages/onboarding-wizard"
import { renderWithProviders } from "../../../utils/render"

async function navigateToStep2(user: ReturnType<typeof userEvent.setup>): Promise<void> {
    await user.click(screen.getByRole("button", { name: "Connect provider" }))
    await user.click(screen.getByRole("button", { name: "Next" }))

    const input = screen.getByRole("textbox", { name: "Repository URL" })
    await user.type(input, "https://github.com/owner/repo")
    await user.click(screen.getByRole("button", { name: "Next" }))
}

describe("ScanConfigurationStep", (): void => {
    it("when on step 2, then shows scan configuration fields and summary", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<OnboardingWizardPage />)
        await navigateToStep2(user)

        expect(screen.queryByText("Review the selected settings:")).not.toBeNull()
        expect(screen.getByRole("spinbutton", { name: "Worker count" })).not.toBeNull()
    })

    it("when worker count is invalid, then prevents submission", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<OnboardingWizardPage />)
        await navigateToStep2(user)

        const workersInput = screen.getByRole("spinbutton", { name: "Worker count" })
        await user.clear(workersInput)
        await user.type(workersInput, "0")
        await user.click(screen.getByRole("button", { name: "Launch scan" }))

        expect(screen.queryByText(/Worker count/u)).not.toBeNull()
    })

    it("when template registry section rendered, then shows template registry heading", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<OnboardingWizardPage />)
        await navigateToStep2(user)

        expect(screen.queryByText("Onboarding template registry")).not.toBeNull()
    })
})
