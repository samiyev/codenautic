import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { App } from "@/app/app"
import { renderWithProviders } from "../utils/render"

/**
 * Рендерит приложение на целевом route для route-level regression тестов.
 *
 * @param path Начальный URL route.
 */
function renderAppAtRoute(path: string): void {
    window.history.replaceState({}, "", path)
    renderWithProviders(<App />)
}

describe("settings adoption analytics route", (): void => {
    it("рендерит layout настроек и контент adoption analytics", async (): Promise<void> => {
        renderAppAtRoute("/settings-adoption-analytics")

        expect(await screen.findByText("Usage & adoption analytics")).not.toBeNull()
        expect(screen.getByText("Adoption funnel")).not.toBeNull()
        expect(screen.getByText("Workflow health")).not.toBeNull()
        expect(
            screen.getAllByRole("navigation", { name: "Main navigation" }).length,
        ).toBeGreaterThan(1)
        expect(screen.getAllByText("Adoption Analytics").length).toBeGreaterThan(0)
    })
})
