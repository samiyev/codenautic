import { screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { SettingsPage } from "@/pages/settings.page"
import { renderWithProviders } from "../utils/render"

describe("SettingsPage", (): void => {
    beforeEach((): void => {
        window.localStorage.setItem("codenautic:rbac:role", "admin")
    })

    afterEach((): void => {
        window.localStorage.removeItem("codenautic:rbac:role")
    })

    it("renders overview heading and description", (): void => {
        renderWithProviders(<SettingsPage />)

        const heading = screen.getByRole("heading", { level: 1, name: "Settings" })

        expect(heading).not.toBeNull()
        expect(heading.className).toContain("text-foreground")
        expect(
            screen.getAllByText("Workspace defaults, appearance, and notification preferences.")
                .length,
        ).toBeGreaterThan(0)
    })

    it("renders grouped settings cards with canonical labels", (): void => {
        renderWithProviders(<SettingsPage />)

        expect(screen.getByText("Providers")).not.toBeNull()
        expect(screen.getByText("Security & Compliance")).not.toBeNull()
        expect(screen.getByText("Operations")).not.toBeNull()
        expect(screen.getByText("Billing & Usage")).not.toBeNull()
        expect(screen.getAllByText("Organization").length).toBeGreaterThan(0)
        expect(screen.getAllByText("Code Review").length).toBeGreaterThan(0)
    })

    it("renders navigation links from shared data", (): void => {
        renderWithProviders(<SettingsPage />)

        expect(screen.getByRole("link", { name: "LLM Providers" })).not.toBeNull()
        expect(screen.getByRole("link", { name: "Git Providers" })).not.toBeNull()
        expect(screen.getByRole("link", { name: "Webhooks" })).not.toBeNull()
        expect(screen.getByRole("link", { name: "Audit Logs" })).not.toBeNull()
        expect(screen.getByRole("link", { name: "SSO" })).not.toBeNull()
    })

    it("filters out General self-link from the General group", (): void => {
        renderWithProviders(<SettingsPage />)

        const generalLinks = screen.queryAllByRole("link", { name: "General" })
        expect(generalLinks.length).toBe(0)
    })
})
