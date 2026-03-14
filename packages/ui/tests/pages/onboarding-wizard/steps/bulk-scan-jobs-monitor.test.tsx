import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { OnboardingWizardPage } from "@/pages/onboarding-wizard"
import { renderWithProviders } from "../../../utils/render"

async function navigateToStep1(user: ReturnType<typeof userEvent.setup>): Promise<void> {
    await user.click(screen.getByRole("button", { name: "Connect provider" }))
    await user.click(screen.getByRole("button", { name: "Next" }))
}

async function navigateToBulkFinalStep(user: ReturnType<typeof userEvent.setup>): Promise<void> {
    await navigateToStep1(user)
    await user.click(screen.getByRole("radio", { name: "Bulk onboarding" }))
    await user.type(
        screen.getByRole("textbox", { name: "Repository list (one link per line)" }),
        "https://github.com/org/repo-a\nhttps://github.com/org/repo-b",
    )
    await user.click(screen.getByRole("button", { name: "Next" }))
}

describe("BulkScanJobsMonitor", (): void => {
    it("when in bulk mode on final step before launch, then monitor is hidden", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<OnboardingWizardPage />)
        await navigateToBulkFinalStep(user)

        expect(screen.queryByText("Bulk scan progress")).toBeNull()
    })

    it("when on final step in bulk mode, then launch scan button is visible", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<OnboardingWizardPage />)
        await navigateToBulkFinalStep(user)

        expect(screen.getByRole("button", { name: "Launch scan" })).not.toBeNull()
    })

    it("when bulk scan launched, then shows progress tracking section", async (): Promise<void> => {
        const user = userEvent.setup()
        const onScanStart = vi.fn()
        renderWithProviders(<OnboardingWizardPage onScanStart={onScanStart} />)
        await navigateToBulkFinalStep(user)

        await user.click(screen.getByRole("button", { name: "Launch scan" }))

        expect(screen.queryByText("Bulk scan progress")).not.toBeNull()
    })
})
