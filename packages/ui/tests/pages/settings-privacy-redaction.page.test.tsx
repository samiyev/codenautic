import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { SettingsPrivacyRedactionPage } from "@/pages/settings-privacy-redaction.page"
import { renderWithProviders } from "../utils/render"

describe("SettingsPrivacyRedactionPage", (): void => {
    it("блокирует небезопасный экспорт и подтверждает safe export после redaction", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsPrivacyRedactionPage />)

        expect(
            screen.getByRole("heading", { level: 1, name: "Privacy-safe export" }),
        ).not.toBeNull()
        expect(screen.getByText("Sensitive fragments detected")).not.toBeNull()

        await user.click(screen.getByRole("button", { name: "Confirm safe export" }))
        await waitFor(() => {
            expect(screen.getByText(/Export blocked/)).not.toBeNull()
        })

        await user.click(screen.getByRole("button", { name: "Apply redaction suggestions" }))
        await waitFor(() => {
            expect(screen.getByRole("textbox", { name: "Privacy redacted preview" })).not.toBeNull()
        })
        expect(screen.getByDisplayValue(/REDACTED_TOKEN/)).not.toBeNull()

        await user.click(screen.getByRole("button", { name: "Confirm safe export" }))
        await waitFor(() => {
            expect(screen.getByText(/Safe export confirmed/)).not.toBeNull()
        })
    })

    it("требует повторного redaction после изменения source text", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsPrivacyRedactionPage />)

        await user.click(screen.getByRole("button", { name: "Apply redaction suggestions" }))
        await waitFor(() => {
            expect(screen.getByDisplayValue(/REDACTED_TOKEN/)).not.toBeNull()
        })

        const sourceTextarea = screen.getByRole("textbox", { name: "Privacy source text" })
        await user.clear(sourceTextarea)
        await user.type(sourceTextarea, "token=updated1234567890")

        await user.click(screen.getByRole("button", { name: "Confirm safe export" }))
        await waitFor(() => {
            expect(screen.getByText(/Export blocked/)).not.toBeNull()
        })
    })
})
