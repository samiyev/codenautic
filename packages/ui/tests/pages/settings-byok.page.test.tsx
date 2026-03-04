import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { SettingsByokPage } from "@/pages/settings-byok.page"
import { renderWithProviders } from "../utils/render"

describe("SettingsByokPage", (): void => {
    it("добавляет ключ с masked display, ротирует его и отражает usage stats", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsByokPage />)

        expect(screen.getByRole("heading", { level: 1, name: "BYOK management" })).not.toBeNull()
        expect(screen.getAllByRole("button", { name: /^Rotate key / }).length).toBe(2)

        const secret = "sk-test-super-secret-key-001"
        await user.selectOptions(screen.getByRole("combobox", { name: "Provider" }), "openai")
        await user.type(screen.getByRole("textbox", { name: "Key label" }), "openai-rotation-test")
        await user.type(screen.getByLabelText("API key / secret"), secret)
        await user.click(screen.getByRole("button", { name: "Add key" }))

        expect(screen.getByText("openai-rotation-test")).not.toBeNull()
        expect(screen.queryByText(secret)).toBeNull()
        expect(screen.getByText("sk-t****001")).not.toBeNull()
        expect(screen.getAllByRole("button", { name: /^Rotate key / }).length).toBe(3)

        await user.click(screen.getByRole("button", { name: "Rotate key openai-rotation-test" }))
        expect(screen.getAllByText("Rotation: 2").length).toBe(2)
    })
})
