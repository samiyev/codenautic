import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { SettingsAppearancePage } from "@/pages/settings-appearance.page"
import { THEME_PRESETS } from "@/lib/theme/theme-provider"
import { renderWithProviders } from "../utils/render"

describe("SettingsAppearancePage", (): void => {
    it("переключает mode/preset и сбрасывает тему к default", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsAppearancePage />)

        expect(screen.getByRole("heading", { level: 1, name: "Appearance settings" })).not.toBeNull()

        const darkModeButton = screen.getByRole("button", { name: "Use dark theme" })
        const systemModeButton = screen.getByRole("button", { name: "Use system theme" })

        await user.click(darkModeButton)
        await waitFor(() => {
            expect(darkModeButton.getAttribute("aria-pressed")).toBe("true")
        })

        const secondPreset = THEME_PRESETS.at(1)
        if (secondPreset !== undefined) {
            await user.click(
                screen.getByRole("button", { name: `Set ${secondPreset.label} theme preset` }),
            )
            await waitFor(() => {
                expect(screen.getByText(`preset: ${secondPreset.id}`)).not.toBeNull()
            })
        }

        await user.click(screen.getByRole("button", { name: "Reset to default" }))
        await waitFor(() => {
            expect(systemModeButton.getAttribute("aria-pressed")).toBe("true")
        })
    })
})
