import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { SettingsJobsPage } from "@/pages/settings-jobs.page"
import { renderWithProviders } from "../utils/render"

describe("SettingsJobsPage", (): void => {
    it("показывает jobs monitor, recovery actions и audit trail", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsJobsPage />)

        expect(screen.getByRole("heading", { level: 1, name: "Operations jobs monitor" })).not.toBeNull()
        expect(screen.getByText("Failed/Stuck: 2")).not.toBeNull()
        expect(screen.getByText("JOB-4102 · scan")).not.toBeNull()

        const retryButtons = screen.getAllByRole("button", { name: "Retry" })
        const retryButton = retryButtons.find((button): boolean => {
            return button.getAttribute("disabled") === null
        })
        if (retryButton === undefined) {
            throw new Error("Enabled Retry button not found")
        }
        await user.click(retryButton)
        await waitFor(() => {
            expect(screen.getByText("Retry queued with updated attempt counter.")).not.toBeNull()
        })

        const cancelButtons = screen.getAllByRole("button", { name: "Cancel" })
        const firstCancelButton = cancelButtons[0]
        if (firstCancelButton !== undefined) {
            await user.click(firstCancelButton)
        }
        await waitFor(() => {
            expect(screen.getByText("Job cancelled by operator from monitor center.")).not.toBeNull()
        })

        await user.click(screen.getByRole("button", { name: "Open JOB-4103 details" }))
        expect(screen.getByText("Latest error trace")).not.toBeNull()
        expect(screen.getByText(/Analytics aggregation failed/)).not.toBeNull()

        const requeueButtons = screen.getAllByRole("button", { name: "Requeue" })
        const firstRequeueButton = requeueButtons[0]
        if (firstRequeueButton !== undefined) {
            await user.click(firstRequeueButton)
        }
        await waitFor(() => {
            expect(screen.getByText("Job moved back to queue for safe recovery.")).not.toBeNull()
        })
    })

    it("показывает timezone-aware schedule preview с absolute и relative временем", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsJobsPage />)

        expect(screen.getByText("Timezone + schedule preview")).not.toBeNull()
        expect(screen.getByText(/Schedule is evaluated on server timezone/)).not.toBeNull()

        await user.selectOptions(
            screen.getByRole("combobox", { name: "Organization timezone override" }),
            "America/New_York",
        )
        await user.selectOptions(
            screen.getByRole("combobox", { name: "Schedule frequency" }),
            "weekly",
        )

        const previewItems = screen.getAllByRole("listitem")
        expect(previewItems.length).toBeGreaterThan(4)

        await user.click(screen.getByRole("button", { name: "Save schedule" }))
        expect(screen.getByText(/Saved rescan runs weekly/)).not.toBeNull()
    })
})
