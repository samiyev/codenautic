import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { SettingsWebhooksPage } from "@/pages/settings-webhooks.page"
import { renderWithProviders } from "../utils/render"

describe("SettingsWebhooksPage", (): void => {
    it("рендерит webhook endpoints и delivery logs", (): void => {
        renderWithProviders(<SettingsWebhooksPage />)

        expect(screen.getByRole("heading", { level: 1, name: "Webhook Management" })).not.toBeNull()
        expect(screen.getByText("https://hooks.acme.dev/code-review")).not.toBeNull()
        expect(screen.getByRole("button", { name: /whsec_\*{4}32af/ })).not.toBeNull()
        expect(screen.getByText("Delivered review.completed payload.")).not.toBeNull()
    })

    it("позволяет фильтровать endpoints по поиску", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsWebhooksPage />)

        const searchInput = screen.getByPlaceholderText("Search URL or event...")
        await user.type(searchInput, "provider-health")

        expect(screen.getByText("https://hooks.acme.dev/provider-health")).not.toBeNull()
        expect(screen.queryByText("https://hooks.acme.dev/code-review")).toBeNull()
    })

    it("генерирует новый webhook id без коллизии после удаления endpoint", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsWebhooksPage />)

        const scanEventsUrl = screen.getByText("https://hooks.acme.dev/scan-events")
        const scanEventsRow = scanEventsUrl.closest("article")
        if (scanEventsRow === null) {
            throw new Error("Scan events row not found")
        }

        await user.click(within(scanEventsRow).getByRole("button", { name: "Delete" }))

        await user.type(
            screen.getByRole("textbox", { name: "Endpoint URL" }),
            "https://hooks.acme.dev/new-endpoint",
        )
        await user.type(screen.getByRole("textbox", { name: "Event types" }), "scan.completed")
        await user.click(screen.getByRole("button", { name: "Create endpoint" }))

        expect(screen.getByText("https://hooks.acme.dev/new-endpoint")).not.toBeNull()
        expect(screen.getByText(/· wh-1004/u)).not.toBeNull()
    })
})
