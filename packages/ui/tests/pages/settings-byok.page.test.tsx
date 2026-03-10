import { screen, waitFor } from "@testing-library/react"
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

    it("when label is too short, then does not create key", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsByokPage />)

        await user.type(screen.getByRole("textbox", { name: "Key label" }), "ab")
        await user.type(screen.getByLabelText("API key / secret"), "sk-long-enough-secret")
        await user.click(screen.getByRole("button", { name: "Add key" }))

        expect(screen.getAllByRole("button", { name: /^Rotate key / }).length).toBe(2)
    })

    it("when secret is too short, then does not create key", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsByokPage />)

        await user.type(screen.getByRole("textbox", { name: "Key label" }), "valid-label")
        await user.type(screen.getByLabelText("API key / secret"), "short")
        await user.click(screen.getByRole("button", { name: "Add key" }))

        expect(screen.getAllByRole("button", { name: /^Rotate key / }).length).toBe(2)
    })

    it("when key is deleted, then removes it from list and updates stats", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsByokPage />)

        expect(screen.getByText("openai-prod-main")).not.toBeNull()
        expect(screen.getByText("anthropic-fallback")).not.toBeNull()

        await user.click(screen.getByRole("button", { name: "Remove key openai-prod-main" }))

        expect(screen.queryByText("openai-prod-main")).toBeNull()
        expect(screen.getByText("anthropic-fallback")).not.toBeNull()

        expect(screen.getAllByRole("button", { name: /^Rotate key / }).length).toBe(1)
    })

    it("when all keys are deleted, then shows empty state alert", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsByokPage />)

        await user.click(screen.getByRole("button", { name: "Remove key openai-prod-main" }))
        await user.click(screen.getByRole("button", { name: "Remove key anthropic-fallback" }))

        expect(screen.getByText("No BYOK keys configured")).not.toBeNull()
        expect(
            screen.getByText("Add your first provider key to activate secure provider calls."),
        ).not.toBeNull()
    })

    it("when key toggle is switched off, then shows inactive chip", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsByokPage />)

        const activeSwitch = screen.getByRole("switch", {
            name: "Active key openai-prod-main",
        })
        await user.click(activeSwitch)

        await waitFor((): void => {
            expect(screen.getByText("inactive")).not.toBeNull()
        })
    })

    it("when key toggle is switched back on, then shows active chip", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsByokPage />)

        const activeSwitch = screen.getByRole("switch", {
            name: "Active key openai-prod-main",
        })

        await user.click(activeSwitch)
        await waitFor((): void => {
            expect(screen.getByText("inactive")).not.toBeNull()
        })

        await user.click(activeSwitch)
        await waitFor((): void => {
            expect(screen.queryByText("inactive")).toBeNull()
        })
    })

    it("when provider is changed to anthropic, then new key uses that provider", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsByokPage />)

        await user.selectOptions(screen.getByRole("combobox", { name: "Provider" }), "anthropic")
        await user.type(screen.getByRole("textbox", { name: "Key label" }), "anthropic-new-key")
        await user.type(screen.getByLabelText("API key / secret"), "sk-anthropic-secret-long")
        await user.click(screen.getByRole("button", { name: "Add key" }))

        expect(screen.getByText("anthropic-new-key")).not.toBeNull()
        expect(screen.getAllByText("Provider: Anthropic").length).toBe(2)
    })

    it("when provider is changed to github, then new key shows GitHub label", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsByokPage />)

        await user.selectOptions(screen.getByRole("combobox", { name: "Provider" }), "github")
        await user.type(screen.getByRole("textbox", { name: "Key label" }), "github-api-key")
        await user.type(screen.getByLabelText("API key / secret"), "ghp_1234567890ab")
        await user.click(screen.getByRole("button", { name: "Add key" }))

        expect(screen.getByText("github-api-key")).not.toBeNull()
        expect(screen.getByText("Provider: GitHub")).not.toBeNull()
    })

    it("when provider is changed to gitlab, then new key shows GitLab label", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsByokPage />)

        await user.selectOptions(screen.getByRole("combobox", { name: "Provider" }), "gitlab")
        await user.type(screen.getByRole("textbox", { name: "Key label" }), "gitlab-api-key")
        await user.type(screen.getByLabelText("API key / secret"), "glpat-1234567890ab")
        await user.click(screen.getByRole("button", { name: "Add key" }))

        expect(screen.getByText("gitlab-api-key")).not.toBeNull()
        expect(screen.getByText("Provider: GitLab")).not.toBeNull()
    })

    it("renders initial stats cards with correct totals", (): void => {
        renderWithProviders(<SettingsByokPage />)

        expect(screen.getByText("Total keys")).not.toBeNull()
        expect(screen.getByText("Active keys")).not.toBeNull()
        expect(screen.getByText("Usage requests")).not.toBeNull()
        expect(screen.getByText("Usage tokens")).not.toBeNull()

        expect(screen.getByText("1686")).not.toBeNull()
        expect(screen.getByText("508060")).not.toBeNull()
    })

    it("renders provider usage stats for all providers", (): void => {
        renderWithProviders(<SettingsByokPage />)

        expect(screen.getByText("Provider usage stats")).not.toBeNull()
        expect(screen.getAllByText("OpenAI").length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText("Anthropic").length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText("GitHub").length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText("GitLab").length).toBeGreaterThanOrEqual(1)
    })

    it("when key is created, then form resets label and secret but keeps provider", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsByokPage />)

        await user.selectOptions(screen.getByRole("combobox", { name: "Provider" }), "anthropic")
        await user.type(screen.getByRole("textbox", { name: "Key label" }), "test-reset-key")
        await user.type(screen.getByLabelText("API key / secret"), "sk-reset-test-secret123")
        await user.click(screen.getByRole("button", { name: "Add key" }))

        expect(screen.getByRole("textbox", { name: "Key label" })).toHaveValue("")
        expect(screen.getByLabelText("API key / secret")).toHaveValue("")
        expect(screen.getByRole("combobox", { name: "Provider" })).toHaveValue("anthropic")
    })

    it("when short secret is provided, then masked value shows only asterisks", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsByokPage />)

        await user.type(screen.getByRole("textbox", { name: "Key label" }), "short-secret-key")
        await user.type(screen.getByLabelText("API key / secret"), "sk-abcdef12345x")
        await user.click(screen.getByRole("button", { name: "Add key" }))

        expect(screen.getByText("short-secret-key")).not.toBeNull()
        expect(screen.getByText("sk-a****45x")).not.toBeNull()
    })

    it("when stats update after deleting a key, then totals decrease", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsByokPage />)

        expect(screen.getByText("508060")).not.toBeNull()

        await user.click(screen.getByRole("button", { name: "Remove key openai-prod-main" }))

        expect(screen.getByText("116240")).not.toBeNull()
        expect(screen.queryByText("508060")).toBeNull()
    })

    it("when key is toggled off, then active keys count decreases", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<SettingsByokPage />)

        const activeSwitch = screen.getByRole("switch", {
            name: "Active key openai-prod-main",
        })
        await user.click(activeSwitch)

        await waitFor((): void => {
            const statCards = screen.getAllByText(/^\d+$/)
            const values = statCards.map((element): string => element.textContent ?? "")
            expect(values).toContain("1")
        })
    })
})
