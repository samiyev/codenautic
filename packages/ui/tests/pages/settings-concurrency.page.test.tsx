import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { SettingsConcurrencyPage } from "@/pages/settings-concurrency.page"
import { renderWithProviders } from "../utils/render"

describe("SettingsConcurrencyPage", (): void => {
    it("разрешает etag конфликт через merge/reload/retry flow", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsConcurrencyPage />)

        expect(
            screen.getByRole("heading", { level: 1, name: "Concurrent config resolver" }),
        ).not.toBeNull()

        await user.type(screen.getByRole("textbox", { name: "Ignore paths" }), ",temp/**")
        await user.click(screen.getByRole("button", { name: "Simulate external update" }))
        await user.click(screen.getByRole("button", { name: "Save settings (optimistic)" }))

        await waitFor(() => {
            expect(screen.getByText("Config conflict detected")).not.toBeNull()
        })
        expect(screen.getByText("Ignore paths")).not.toBeNull()

        await user.click(screen.getByRole("button", { name: "Merge and save" }))
        await waitFor(() => {
            expect(screen.getByText("Conflict resolution audit")).not.toBeNull()
        })
        expect(screen.getByText(/Conflict merged with local priority/)).not.toBeNull()
    })
})
