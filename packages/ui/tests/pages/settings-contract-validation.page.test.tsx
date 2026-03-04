import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { SettingsContractValidationPage } from "@/pages/settings-contract-validation.page"
import { renderWithProviders } from "../utils/render"

describe("SettingsContractValidationPage", (): void => {
    it("валидирует контракт, показывает migration hints и применяет preview", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsContractValidationPage />)

        expect(screen.getByRole("heading", { level: 1, name: "Contract validation" })).not.toBeNull()

        await user.click(screen.getByRole("button", { name: "Validate contract" }))
        await waitFor(() => {
            expect(screen.getByText("Contract is valid")).not.toBeNull()
        })
        expect(screen.getByText("Migration hints")).not.toBeNull()

        await user.click(screen.getByRole("button", { name: "Apply validated contract" }))
        await waitFor(() => {
            expect(screen.getByText(/Applied theme-library contract v1/)).not.toBeNull()
        })
    })

    it("возвращает actionable errors для некорректного JSON", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsContractValidationPage />)

        await user.clear(screen.getByRole("textbox", { name: "Contract json" }))
        await user.type(screen.getByRole("textbox", { name: "Contract json" }), "{bad json")
        await user.click(screen.getByRole("button", { name: "Validate contract" }))

        await waitFor(() => {
            expect(screen.getByText("Contract validation errors")).not.toBeNull()
        })
        expect(screen.getByText(/Invalid JSON format/)).not.toBeNull()
    })
})
