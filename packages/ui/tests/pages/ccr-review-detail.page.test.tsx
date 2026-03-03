import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { CcrReviewDetailPage } from "@/pages/ccr-review-detail.page"
import { MOCK_CCR_ROWS } from "@/pages/ccr-data"
import { renderWithProviders } from "../utils/render"

describe("ccr review detail page", (): void => {
    it("рендерит карточку CCR и заголовок чата", (): void => {
        const ccr = MOCK_CCR_ROWS[0]

        renderWithProviders(<CcrReviewDetailPage ccr={ccr} />)

        expect(screen.getByText(ccr.title)).not.toBeNull()
        expect(screen.getByRole("heading", { name: `Conversation · ${ccr.id}` })).not.toBeNull()
    })

    it("добавляет сообщение в чат по quick action", async (): Promise<void> => {
        const user = userEvent.setup()
        const ccr = MOCK_CCR_ROWS[1]

        renderWithProviders(<CcrReviewDetailPage ccr={ccr} />)

        const explainButton = screen.getByRole("button", { name: "explain this file" })
        await user.click(explainButton)

        expect(screen.getByText(/Please explain the current diff/)).not.toBeNull()
        expect(screen.getByText("You")).not.toBeNull()
    })
})
