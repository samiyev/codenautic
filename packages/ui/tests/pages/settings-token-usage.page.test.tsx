import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { SettingsTokenUsagePage } from "@/pages/settings-token-usage.page"
import { renderWithProviders } from "../utils/render"

describe("SettingsTokenUsagePage", (): void => {
    it("показывает freshness/provenance и обновляет data window по range фильтру", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsTokenUsagePage />)

        expect(screen.getByText("Token Usage")).not.toBeNull()
        expect(screen.getByText("Usage freshness")).not.toBeNull()
        expect(screen.getByText("Explainability for token cost signal")).not.toBeNull()

        const thirtyDayButton = screen.getByRole("button", { name: "30d" })
        await user.click(thirtyDayButton)
        await waitFor((): void => {
            expect(thirtyDayButton.className).toContain("button--primary")
        })
        await user.click(screen.getByRole("button", { name: "Open provenance" }))
        expect(await screen.findByText("Source data provenance")).not.toBeNull()
        expect(await screen.findByText("token-usage-range:30d (Last 30 days)")).not.toBeNull()
    })

    it("открывает explainability drawer и экспортирует snippet", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsTokenUsagePage />)

        await user.click(screen.getByRole("button", { name: "Why this score?" }))
        expect(await screen.findByText("Explainability")).not.toBeNull()
        await user.click(screen.getByRole("button", { name: "Export explanation snippet" }))
        expect(await screen.findByLabelText("Explainability export snippet")).not.toBeNull()
    })

    it("показывает статус действий refresh/rescan", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsTokenUsagePage />)

        await user.click(screen.getByRole("button", { name: "Refresh" }))
        expect(screen.getByText("Token usage refresh requested.")).not.toBeNull()

        await user.click(screen.getByRole("button", { name: "Rescan" }))
        expect(screen.getByText("Token usage rescan queued from settings.")).not.toBeNull()
    })
})
