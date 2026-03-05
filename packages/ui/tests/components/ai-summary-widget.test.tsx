import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { AiSummaryWidget } from "@/components/reports/ai-summary-widget"
import { renderWithProviders } from "../utils/render"

describe("AiSummaryWidget", (): void => {
    it("перегенерирует narrative summary по кнопке regenerate", async (): Promise<void> => {
        const user = userEvent.setup()
        renderWithProviders(<AiSummaryWidget initialSummary="Initial narrative summary." />)

        expect(screen.getByText("Initial narrative summary.")).not.toBeNull()
        await user.click(screen.getByRole("button", { name: "Regenerate summary" }))

        await waitFor(() => {
            expect(screen.getByText("Summary regenerated.")).not.toBeNull()
        })
        expect(screen.queryByText("Initial narrative summary.")).toBeNull()
    })

    it("копирует summary в clipboard по кнопке copy", async (): Promise<void> => {
        const user = userEvent.setup()
        const writeText = vi.fn<(_: string) => Promise<void>>().mockResolvedValue(undefined)

        Object.defineProperty(globalThis.navigator, "clipboard", {
            configurable: true,
            value: {
                writeText,
            },
        })

        renderWithProviders(<AiSummaryWidget initialSummary="Clipboard summary body." />)

        await user.click(screen.getByRole("button", { name: "Copy summary" }))
        await waitFor(() => {
            expect(screen.getByText("Summary copied to clipboard.")).not.toBeNull()
        })
        expect(writeText).toHaveBeenCalledWith("Clipboard summary body.")
    })
})
