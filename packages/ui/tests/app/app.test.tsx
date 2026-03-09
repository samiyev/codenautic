import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { App } from "@/app/app"

describe("App bootstrap", (): void => {
    it("поднимает router и рендерит главную страницу", async (): Promise<void> => {
        render(<App />)

        expect((await screen.findAllByText("Дашборд")).length).toBeGreaterThan(0)
    })
})
