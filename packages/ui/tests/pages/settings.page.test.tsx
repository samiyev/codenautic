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

        const heading = screen.getByRole("heading", { level: 1, name: "Настройки" })

        expect(heading).not.toBeNull()
        expect(heading.className).toContain("text-foreground")
        expect(
            screen.getAllByText(
                "Настройки рабочего пространства, внешний вид и уведомления.",
            ).length,
        ).toBeGreaterThan(0)
    })

    it("renders grouped settings cards with canonical labels", (): void => {
        renderWithProviders(<SettingsPage />)

        expect(screen.getByText("Провайдеры")).not.toBeNull()
        expect(screen.getByText("Безопасность и соответствие")).not.toBeNull()
        expect(screen.getByText("Операции")).not.toBeNull()
        expect(screen.getByText("Биллинг и использование")).not.toBeNull()
        expect(screen.getAllByText("Организация").length).toBeGreaterThan(0)
        expect(screen.getAllByText("Code Review").length).toBeGreaterThan(0)
    })

    it("renders navigation links from shared data", (): void => {
        renderWithProviders(<SettingsPage />)

        expect(screen.getByRole("link", { name: "LLM провайдеры" })).not.toBeNull()
        expect(screen.getByRole("link", { name: "Git провайдеры" })).not.toBeNull()
        expect(screen.getByRole("link", { name: "Webhooks" })).not.toBeNull()
        expect(screen.getByRole("link", { name: "Журнал аудита" })).not.toBeNull()
        expect(screen.getByRole("link", { name: "SSO" })).not.toBeNull()
    })

    it("filters out General self-link from the General group", (): void => {
        renderWithProviders(<SettingsPage />)

        const generalLinks = screen.queryAllByRole("link", { name: "Общие" })
        expect(generalLinks.length).toBe(0)
    })
})
